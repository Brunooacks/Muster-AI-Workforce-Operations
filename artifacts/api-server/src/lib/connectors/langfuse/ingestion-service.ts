import type { ExternalAgentEnvelope } from "@workspace/api-zod";
import type { LangfuseReadableClient } from "./client";
import { mapLangfuseToEnvelopeV2 } from "./map-to-envelope-v2";
import { pullLangfuseWindow } from "./pull-window";

export const INITIAL_LANGFUSE_WINDOW_MS = 60 * 60 * 1_000;
export const LANGFUSE_RECONCILIATION_LOOKBACK_MS = 24 * 60 * 60 * 1_000;

export interface LangfuseWindowIngestion {
  orgId: string;
  connectorId: string;
  previousWatermark: Date | null;
  now: Date;
  maxTraces?: number;
  client: LangfuseReadableClient;
  ingest: (
    orgId: string,
    connectorId: string,
    envelope: ExternalAgentEnvelope,
  ) => Promise<unknown>;
  saveWatermark: (watermark: Date) => Promise<void>;
}

export async function ingestLangfuseWindow({
  orgId,
  connectorId,
  previousWatermark,
  now,
  maxTraces,
  client,
  ingest,
  saveWatermark,
}: LangfuseWindowIngestion): Promise<{
  from: Date;
  to: Date;
  traces: number;
  envelopes: number;
  warnings: string[];
}> {
  // Reconsulta o trecho recente para que traces que estavam abertas (ou sem
  // campos suficientes) possam ser materializadas quando o Langfuse as
  // atualizar. Envelopes já concluídos continuam protegidos pela receipt v2.
  const from = previousWatermark
    ? new Date(previousWatermark.getTime() - LANGFUSE_RECONCILIATION_LOOKBACK_MS)
    : new Date(now.getTime() - INITIAL_LANGFUSE_WINDOW_MS);
  const pulled = await pullLangfuseWindow(client, { from, to: now, ...(maxTraces ? { maxTraces } : {}) });
  if (pulled.truncated) {
    throw new Error("A janela Langfuse foi truncada; a marca d'água foi preservada para repetição.");
  }
  const warnings = [...pulled.warnings];
  let envelopes = 0;

  for (const trace of pulled.traces) {
    // O cliente de leitura mantém o payload da API permissivo; o mapeador é a
    // fronteira que conhece os campos exigidos depois do saneamento da janela.
    const mapped = mapLangfuseToEnvelopeV2(trace as unknown as Parameters<typeof mapLangfuseToEnvelopeV2>[0], {
      projectId: pulled.projectId,
      connectorId,
      validation: { scoreName: "quality" },
    });
    warnings.push(...mapped.warnings);
    if (mapped.envelopes.length === 0) {
      warnings.push("pending_trace:missing_envelope");
      continue;
    }
    if (mapped.envelopes.some((envelope) => envelope.execution?.status === "running")) {
      warnings.push("pending_trace:running");
      continue;
    }
    for (const envelope of mapped.envelopes) {
      await ingest(orgId, connectorId, envelope as ExternalAgentEnvelope);
      envelopes += 1;
    }
  }

  // A janela só é considerada concluída depois de cada envelope ser aceito.
  // Em uma falha, a próxima execução repete a mesma janela e a ingestão v2
  // elimina os eventos que já tenham sido materializados.
  await saveWatermark(now);
  return { from, to: now, traces: pulled.traces.length, envelopes, warnings };
}
