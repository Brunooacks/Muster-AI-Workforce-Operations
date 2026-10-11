import { describe, expect, it, vi } from "vitest";
import piiTrace from "./fixtures/trace-with-io-pii.json";
import type { LangfuseObservation, LangfuseReadableClient, LangfuseScore } from "./client";
import { ingestLangfuseWindow, LANGFUSE_RECONCILIATION_LOOKBACK_MS } from "./ingestion-service";

const windowEnd = new Date("2026-10-11T12:00:00.000Z");
const previousWatermark = new Date("2026-10-11T11:00:00.000Z");

describe("ingestLangfuseWindow", () => {
  it("mapeia a janela pelo contrato v2, não persiste PII e só então avança a marca d'água", async () => {
    const ingest = vi.fn().mockResolvedValue({ accepted: true, duplicate: false });
    const saveWatermark = vi.fn().mockResolvedValue(undefined);

    const result = await ingestLangfuseWindow({
      orgId: "org-l3",
      connectorId: "connector-l3",
      previousWatermark,
      now: windowEnd,
      client: clientForTrace(piiTrace),
      ingest,
      saveWatermark,
    });

    expect(result).toMatchObject({
      traces: 1,
      envelopes: 1,
      from: new Date(previousWatermark.getTime() - LANGFUSE_RECONCILIATION_LOOKBACK_MS),
      to: windowEnd,
    });
    expect(ingest).toHaveBeenCalledWith(
      "org-l3",
      "connector-l3",
      expect.objectContaining({
        contractVersion: "muster.agent-ingestion.v2",
        source: expect.objectContaining({ platform: "langfuse", connectorId: "connector-l3" }),
      }),
    );
    expect(JSON.stringify(ingest.mock.calls[0]?.[2])).not.toContain("123.456.789-09");
    expect(JSON.stringify(ingest.mock.calls[0]?.[2])).not.toContain("pessoa.teste@example.invalid");
    expect(saveWatermark).toHaveBeenCalledWith(windowEnd);
  });

  it("não avança a marca d'água se uma gravação da janela falhar", async () => {
    const ingest = vi.fn().mockRejectedValue(new Error("banco indisponível"));
    const saveWatermark = vi.fn().mockResolvedValue(undefined);

    await expect(
      ingestLangfuseWindow({
        orgId: "org-l3",
        connectorId: "connector-l3",
        previousWatermark,
        now: windowEnd,
        client: clientForTrace(piiTrace),
        ingest,
        saveWatermark,
      }),
    ).rejects.toThrow("banco indisponível");

    expect(saveWatermark).not.toHaveBeenCalled();
  });

  it("não avança a marca d'água quando a janela é truncada", async () => {
    const saveWatermark = vi.fn().mockResolvedValue(undefined);

    await expect(ingestLangfuseWindow({
      orgId: "org-l3",
      connectorId: "connector-l3",
      previousWatermark,
      now: windowEnd,
      maxTraces: 1,
      client: clientForObservations([observation("trace-1"), observation("trace-2")]),
      ingest: vi.fn().mockResolvedValue({ accepted: true, duplicate: false }),
      saveWatermark,
    })).rejects.toThrow("truncada");

    expect(saveWatermark).not.toHaveBeenCalled();
  });

  it("mantém traces em execução elegíveis no lookback sem paralisar o cursor", async () => {
    const ingest = vi.fn().mockResolvedValue({ accepted: true, duplicate: false });
    const saveWatermark = vi.fn().mockResolvedValue(undefined);

    const result = await ingestLangfuseWindow({
      orgId: "org-l3",
      connectorId: "connector-l3",
      previousWatermark,
      now: windowEnd,
      client: clientForObservations([observation("trace-running", { endTime: undefined })]),
      ingest,
      saveWatermark,
    });

    expect(ingest).not.toHaveBeenCalled();
    expect(result.warnings).toContain("pending_trace:running");
    expect(saveWatermark).toHaveBeenCalledWith(windowEnd);
  });

  it("mantém traces sem envelope elegíveis no lookback sem paralisar o cursor", async () => {
    const saveWatermark = vi.fn().mockResolvedValue(undefined);

    const result = await ingestLangfuseWindow({
      orgId: "org-l3",
      connectorId: "connector-l3",
      previousWatermark,
      now: windowEnd,
      client: clientForObservations([{ id: "sem-agente", traceId: "trace-sem-agente", startTime: "2026-10-11T11:00:00.000Z", type: "EVENT" }]),
      ingest: vi.fn(),
      saveWatermark,
    });

    expect(result.warnings).toContain("pending_trace:missing_envelope");
    expect(saveWatermark).toHaveBeenCalledWith(windowEnd);
  });
});

function clientForTrace(trace: unknown): LangfuseReadableClient {
  const typed = trace as {
    observations: Array<Record<string, unknown>>;
    scores: Array<Record<string, unknown>>;
  };
  return {
    listProjects: async () => [{ id: "project-pii", name: "Projeto PII" }],
    async *listObservations() {
      yield typed.observations as LangfuseObservation[];
    },
    async *listScores() {
      yield typed.scores as LangfuseScore[];
    },
  };
}

function clientForObservations(observations: Array<Record<string, unknown>>): LangfuseReadableClient {
  return {
    listProjects: async () => [{ id: "project-pii", name: "Projeto PII" }],
    async *listObservations() {
      yield observations as LangfuseObservation[];
    },
    async *listScores() {
      yield [] as LangfuseScore[];
    },
  };
}

function observation(traceId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `observation-${traceId}`,
    traceId,
    traceName: "Agente L3",
    startTime: "2026-10-11T11:00:00.000Z",
    endTime: "2026-10-11T11:00:01.000Z",
    type: "AGENT",
    isRootObservation: true,
    ...overrides,
  };
}
