import { and, eq, sql } from "drizzle-orm";
import {
  connectorCredentials,
  connectors,
  connectorSyncCursors,
  db,
} from "@workspace/db";
import { ingestExternalAgentEnvelope } from "../../external-ingestion";
import { materializeConnectorCredentialForAdapter } from "../credential-crypto";
import { createLangfuseClient } from "./client";
import { parseLangfuseCredential } from "./credential";
import { ingestLangfuseWindow } from "./ingestion-service";

export interface LangfuseSyncResult {
  connectorId: string;
  orgId: string;
  traces: number;
  envelopes: number;
  warnings: string[];
}

/** Executa uma janela para um conector Langfuse já registrado. */
export async function syncLangfuseConnector(input: {
  orgId: string;
  connectorId: string;
  now?: Date;
}): Promise<LangfuseSyncResult> {
  const [connector] = await db
    .select({ id: connectors.id, orgId: connectors.orgId, platform: connectors.platform })
    .from(connectors)
    .where(and(eq(connectors.id, input.connectorId), eq(connectors.orgId, input.orgId)))
    .limit(1);
  if (!connector || connector.platform !== "langfuse") {
    throw new Error("Conector Langfuse não encontrado nesta organização.");
  }

  const [credentialRow] = await db
    .select({ credential: connectorCredentials.credential })
    .from(connectorCredentials)
    .where(eq(connectorCredentials.connectorId, connector.id))
    .limit(1);
  const token = await materializeConnectorCredentialForAdapter({
    storedCredential: credentialRow?.credential,
    connectorId: connector.id,
  });
  const credential = await parseLangfuseCredential(token);
  const [cursor] = await db
    .select({ watermark: connectorSyncCursors.watermark })
    .from(connectorSyncCursors)
    .where(
      and(
        eq(connectorSyncCursors.orgId, connector.orgId),
        eq(connectorSyncCursors.connectorId, connector.id),
      ),
    )
    .limit(1);
  const now = input.now ?? new Date();

  await db
    .update(connectors)
    .set({ status: "syncing" })
    .where(and(eq(connectors.id, connector.id), eq(connectors.orgId, connector.orgId)));

  try {
    const synced = await ingestLangfuseWindow({
      orgId: connector.orgId,
      connectorId: connector.id,
      previousWatermark: cursor?.watermark ?? null,
      now,
      client: createLangfuseClient({ credential }),
      ingest: async (orgId, connectorId, envelope) => {
        const result = await ingestExternalAgentEnvelope({
          orgId,
          authenticatedConnectorId: connectorId,
          envelope,
        });
        if (result.status >= 400 || result.body.mapped !== true) {
          throw new Error(
            typeof result.body.error === "string"
              ? result.body.error
              : "O envelope Langfuse não pôde ser materializado.",
          );
        }
        return result;
      },
      saveWatermark: async (watermark) => {
        await db
          .insert(connectorSyncCursors)
          .values({ orgId: connector.orgId, connectorId: connector.id, watermark, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [connectorSyncCursors.orgId, connectorSyncCursors.connectorId],
            // Execuções concorrentes nunca podem fazer a marca d'água voltar.
            set: {
              watermark: sql`greatest(${connectorSyncCursors.watermark}, excluded.watermark)`,
              updatedAt: new Date(),
            },
          });
      },
    });
    await db
      .update(connectors)
      .set({ status: "connected", health: "healthy", lastSyncAt: now })
      .where(and(eq(connectors.id, connector.id), eq(connectors.orgId, connector.orgId)));
    return { connectorId: connector.id, orgId: connector.orgId, ...synced };
  } catch (error) {
    await db
      .update(connectors)
      .set({ status: "degraded", health: "degraded" })
      .where(and(eq(connectors.id, connector.id), eq(connectors.orgId, connector.orgId)));
    throw error;
  }
}

/** Função chamável pelo cron interno; não agenda nem chama serviços externos por si. */
export async function syncAllLangfuseConnectors(): Promise<{
  completed: LangfuseSyncResult[];
  failed: Array<{ connectorId: string; error: string }>;
}> {
  const rows = await db
    .select({ id: connectors.id, orgId: connectors.orgId })
    .from(connectors)
    .where(eq(connectors.platform, "langfuse"));
  const settled = await Promise.allSettled(
    rows.map((row) => syncLangfuseConnector({ orgId: row.orgId, connectorId: row.id })),
  );
  const completed: LangfuseSyncResult[] = [];
  const failed: Array<{ connectorId: string; error: string }> = [];
  settled.forEach((result, index) => {
    const connectorId = rows[index]!.id;
    if (result.status === "fulfilled") completed.push(result.value);
    else failed.push({ connectorId, error: result.reason instanceof Error ? result.reason.message : "Falha desconhecida." });
  });
  return { completed, failed };
}
