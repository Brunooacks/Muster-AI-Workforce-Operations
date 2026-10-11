import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentEvents,
  connectorSyncCursors,
  connectors,
  organizations,
} from "@workspace/db/schema";
import { ingestLangfuseWindow } from "./ingestion-service";
import type { LangfuseObservation, LangfuseReadableClient, LangfuseScore } from "./client";

const runIntegration = process.env.RUN_CONNECTOR_INGESTION_DB_TESTS === "true";
const suffix = randomUUID().slice(0, 8);
const orgId = `org_langfuse_l3_${suffix}`;
const connectorId = `connector_langfuse_l3_${suffix}`;
const projectId = "project-l3";
let workspaceDb: typeof import("@workspace/db");
let ingestExternalAgentEnvelope: typeof import("../../external-ingestion").ingestExternalAgentEnvelope;
let admitAgent: typeof import("../../admission").admitAgent;

describe.skipIf(!runIntegration)("ingestão Langfuse PostgreSQL", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    ({ ingestExternalAgentEnvelope } = await import("../../external-ingestion"));
    ({ admitAgent } = await import("../../admission"));
    await workspaceDb.db.insert(organizations).values({
      id: orgId,
      name: "Langfuse L3",
      slug: `langfuse-l3-${suffix}`,
    });
    await workspaceDb.db.insert(connectors).values({
      id: connectorId,
      orgId,
      platform: "langfuse",
      name: "Langfuse L3",
      status: "connected",
      mode: "native",
      health: "healthy",
    });
    await admitAgent({
      orgId,
      connectorId,
      externalId: `langfuse:${projectId}:Agente L3`,
      name: "Agente L3",
      role: "support",
      platform: "langfuse",
      bio: "Agent used to validate the Langfuse ingestion window.",
    });
  });

  afterAll(async () => {
    if (workspaceDb) {
      await workspaceDb.db.delete(organizations).where(eq(organizations.id, orgId));
    }
  });

  it("é idempotente e persiste a marca d'água apenas após gravar a janela", async () => {
    const watermark = new Date("2026-10-11T12:00:00.000Z");
    const run = () => ingestLangfuseWindow({
      orgId,
      connectorId,
      previousWatermark: null,
      now: watermark,
      client: clientForTraces([trace("trace-idempotent")]),
      ingest: async (targetOrgId, targetConnectorId, envelope) => {
        const result = await ingestExternalAgentEnvelope({
          orgId: targetOrgId,
          authenticatedConnectorId: targetConnectorId,
          envelope,
        });
        if (result.body.mapped !== true) throw new Error("agente não mapeado");
        return result;
      },
      saveWatermark: async (value) => {
        await workspaceDb.db.insert(connectorSyncCursors).values({
          orgId,
          connectorId,
          watermark: value,
        }).onConflictDoUpdate({
          target: [connectorSyncCursors.orgId, connectorSyncCursors.connectorId],
          set: { watermark: value, updatedAt: new Date() },
        });
      },
    });

    await run();
    await run();

    const events = await workspaceDb.db
      .select({ id: agentEvents.id })
      .from(agentEvents)
      .where(eq(agentEvents.taskRunId, `langfuse:${projectId}:trace-idempotent`));
    const [cursor] = await workspaceDb.db
      .select({ watermark: connectorSyncCursors.watermark })
      .from(connectorSyncCursors)
      .where(and(eq(connectorSyncCursors.orgId, orgId), eq(connectorSyncCursors.connectorId, connectorId)));
    expect(events).toHaveLength(1);
    expect(cursor?.watermark.toISOString()).toBe(watermark.toISOString());
  });

  it("mantém a marca d'água anterior quando uma trace falha no meio da janela", async () => {
    const oldWatermark = new Date("2026-10-11T12:00:00.000Z");
    const nextWatermark = new Date("2026-10-11T13:00:00.000Z");
    await workspaceDb.db.insert(connectorSyncCursors).values({
      orgId,
      connectorId,
      watermark: oldWatermark,
    }).onConflictDoUpdate({
      target: [connectorSyncCursors.orgId, connectorSyncCursors.connectorId],
      set: { watermark: oldWatermark, updatedAt: new Date() },
    });
    let attempts = 0;

    await expect(ingestLangfuseWindow({
      orgId,
      connectorId,
      previousWatermark: oldWatermark,
      now: nextWatermark,
      client: clientForTraces([trace("trace-before-failure"), trace("trace-failure")]),
      ingest: async (targetOrgId, targetConnectorId, envelope) => {
        attempts += 1;
        if (attempts === 2) throw new Error("falha injetada na segunda trace");
        return ingestExternalAgentEnvelope({
          orgId: targetOrgId,
          authenticatedConnectorId: targetConnectorId,
          envelope,
        });
      },
      saveWatermark: async (value) => {
        await workspaceDb.db.insert(connectorSyncCursors).values({ orgId, connectorId, watermark: value })
          .onConflictDoUpdate({
            target: [connectorSyncCursors.orgId, connectorSyncCursors.connectorId],
            set: { watermark: value, updatedAt: new Date() },
          });
      },
    })).rejects.toThrow("falha injetada na segunda trace");

    const [cursor] = await workspaceDb.db
      .select({ watermark: connectorSyncCursors.watermark })
      .from(connectorSyncCursors)
      .where(and(eq(connectorSyncCursors.orgId, orgId), eq(connectorSyncCursors.connectorId, connectorId)));
    expect(cursor?.watermark.toISOString()).toBe(oldWatermark.toISOString());
  });
});

function trace(traceId: string): LangfuseObservation[] {
  return [{
    id: `observation-${traceId}`,
    traceId,
    traceName: "Agente L3",
    startTime: "2026-10-11T11:30:00.000Z",
    endTime: "2026-10-11T11:30:01.000Z",
    type: "AGENT",
    isRootObservation: true,
  } as LangfuseObservation];
}

function clientForTraces(traces: LangfuseObservation[][]): LangfuseReadableClient {
  return {
    listProjects: async () => [{ id: projectId, name: "Projeto L3" }],
    async *listObservations() {
      yield traces.flat();
    },
    async *listScores() {
      yield [] as LangfuseScore[];
    },
  };
}
