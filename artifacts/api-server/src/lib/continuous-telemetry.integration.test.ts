import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { and, count, eq } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentApiKeys,
  agentGovernanceAssessments,
  agentEvents,
  agents,
  eventOutbox,
  organizations,
} from "@workspace/db/schema";
import { generateAgentApiKey } from "./agent-api-key";

const runIntegration =
  process.env.RUN_CONTINUOUS_TELEMETRY_DB_TESTS === "true";

type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;

async function waitFor<T>(
  load: () => Promise<T>,
  condition: (value: T) => boolean,
  timeoutMs = 5_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await load();
  while (!condition(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    value = await load();
  }
  return value;
}

const suffix = randomUUID().slice(0, 8);
const orgA = `org_outbox_a_${suffix}`;
const orgB = `org_outbox_b_${suffix}`;
const agentA = `agent_outbox_a_${suffix}`;
const agentB = `agent_outbox_b_${suffix}`;
const eventId = `outbox_event_${suffix}`;
const agentAKey = generateAgentApiKey();
const agentBKey = generateAgentApiKey();
let server: Server;
let baseUrl = "";

async function countEvents(agentId: string): Promise<number> {
  const [row] = await workspaceDb.db
    .select({ total: count() })
    .from(agentEvents)
    .where(eq(agentEvents.agentId, agentId));
  return Number(row?.total ?? 0);
}

async function countOutbox(agentId: string): Promise<number> {
  const [row] = await workspaceDb.db
    .select({ total: count() })
    .from(eventOutbox)
    .where(
      and(
        eq(eventOutbox.orgId, orgA),
        eq(eventOutbox.aggregateType, "agent"),
        eq(eventOutbox.aggregateId, agentId),
      ),
    );
  return Number(row?.total ?? 0);
}

async function ingestDirectEvent(
  agentId: string,
  token: string,
  body: Record<string, unknown>,
) {
  return fetch(`${baseUrl}/api/agents/${agentId}/events`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!runIntegration)("continuous telemetry PostgreSQL", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    await workspaceDb.db.insert(organizations).values([
      { id: orgA, name: "Outbox A", slug: `outbox-a-${suffix}` },
      { id: orgB, name: "Outbox B", slug: `outbox-b-${suffix}` },
    ]);
    await workspaceDb.db.insert(agents).values({
      id: agentA,
      orgId: orgA,
      name: "Outbox Agent A",
      slug: "outbox-agent-a",
      role: "support",
      platform: "test",
    });
    await workspaceDb.db.insert(agents).values({
      id: agentB,
      orgId: orgA,
      name: "Outbox Agent B",
      slug: "outbox-agent-b",
      role: "support",
      platform: "test",
    });
    await workspaceDb.db.insert(agentApiKeys).values([
      {
        orgId: orgA,
        agentId: agentA,
        prefix: agentAKey.prefix,
        keyHash: agentAKey.keyHash,
      },
      {
        orgId: orgA,
        agentId: agentB,
        prefix: agentBKey.prefix,
        keyHash: agentBKey.keyHash,
      },
    ]);

    // The route's credential middleware is under test here. Mounting it
    // directly avoids unrelated Clerk/OpenAI startup configuration while still
    // exercising HTTP, middleware and PostgreSQL together.
    const { default: telemetryRouter } = await import("../routes/telemetry");
    const app = express();
    app.use(express.json());
    app.use("/api", telemetryRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server unavailable");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!workspaceDb) return;
    await workspaceDb.db
      .delete(organizations)
      .where(eq(organizations.id, orgA));
    await workspaceDb.db
      .delete(organizations)
      .where(eq(organizations.id, orgB));
  });

  it("commits event and tenant-owned outbox atomically", async () => {
    await workspaceDb.db.transaction(async (transaction) => {
      const [event] = await transaction
        .insert(agentEvents)
        .values({
          agentId: agentA,
          kind: "execution",
          success: 1,
          costCents: 14,
        })
        .returning({ id: agentEvents.id });
      await transaction.insert(eventOutbox).values({
        id: eventId,
        orgId: orgA,
        aggregateType: "agent",
        aggregateId: agentA,
        eventType: "agent.telemetry.recorded",
        priority: "critical",
        payload: { agentId: agentA, agentEventId: event!.id },
      });
    });

    const [eventRows, outboxRows] = await Promise.all([
      workspaceDb.db
        .select({ id: agentEvents.id })
        .from(agentEvents)
        .where(eq(agentEvents.agentId, agentA)),
      workspaceDb.db
        .select({ orgId: eventOutbox.orgId })
        .from(eventOutbox)
        .where(eq(eventOutbox.id, eventId)),
    ]);
    expect(eventRows).toHaveLength(1);
    expect(outboxRows).toEqual([{ orgId: orgA }]);
  });

  it("deduplicates the same direct-event key into one event and one outbox item", async () => {
    const beforeEvents = await countEvents(agentA);
    const beforeOutbox = await countOutbox(agentA);
    const payload = {
      idempotencyKey: `direct-retry-${suffix}`,
      kind: "execution",
      success: true,
      durationMs: 12,
    };

    const first = await ingestDirectEvent(agentA, agentAKey.plaintext, payload);
    const second = await ingestDirectEvent(agentA, agentAKey.plaintext, payload);

    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ accepted: true, duplicate: false });
    expect(second.status).toBe(202);
    expect(await second.json()).toMatchObject({ accepted: true, duplicate: true });
    expect(await countEvents(agentA)).toBe(beforeEvents + 1);
    expect(await countOutbox(agentA)).toBe(beforeOutbox + 1);
  });

  it("scopes the same direct-event key to each agent", async () => {
    const beforeEventsA = await countEvents(agentA);
    const beforeEventsB = await countEvents(agentB);
    const beforeOutboxA = await countOutbox(agentA);
    const beforeOutboxB = await countOutbox(agentB);
    const payload = {
      idempotencyKey: `shared-key-${suffix}`,
      kind: "execution",
      success: true,
    };

    const responseA = await ingestDirectEvent(agentA, agentAKey.plaintext, payload);
    const responseB = await ingestDirectEvent(agentB, agentBKey.plaintext, payload);

    expect(await responseA.json()).toMatchObject({ accepted: true, duplicate: false });
    expect(await responseB.json()).toMatchObject({ accepted: true, duplicate: false });
    expect(await countEvents(agentA)).toBe(beforeEventsA + 1);
    expect(await countEvents(agentB)).toBe(beforeEventsB + 1);
    expect(await countOutbox(agentA)).toBe(beforeOutboxA + 1);
    expect(await countOutbox(agentB)).toBe(beforeOutboxB + 1);
  });

  it("preserves the current behavior when the direct event has no key", async () => {
    const beforeEvents = await countEvents(agentA);
    const beforeOutbox = await countOutbox(agentA);
    const payload = { kind: "execution", success: true, durationMs: 7 };

    const first = await ingestDirectEvent(agentA, agentAKey.plaintext, payload);
    const second = await ingestDirectEvent(agentA, agentAKey.plaintext, payload);

    expect(await first.json()).toMatchObject({ accepted: true, duplicate: false });
    expect(await second.json()).toMatchObject({ accepted: true, duplicate: false });
    expect(await countEvents(agentA)).toBe(beforeEvents + 2);
    expect(await countOutbox(agentA)).toBe(beforeOutbox + 2);
  });

  it("never evaluates or streams activity outside the organization", async () => {
    const { reevaluateAgentFromTelemetry } = await import("./agent-telemetry-reevaluation");
    const { listOutboxActivity, readOutboxHealthSnapshot } = await import(
      "./event-outbox"
    );
    const { runContinuousTelemetryCycle } = await import(
      "./continuous-telemetry-worker"
    );

    expect(
      await reevaluateAgentFromTelemetry({ agentId: agentA, orgId: orgB }),
    ).toBeNull();
    const expectedMonthlyVolume = await countEvents(agentA);

    await runContinuousTelemetryCycle({
      enabled: true,
      pollIntervalMs: 100,
      batchSize: 20,
      maxAttempts: 5,
      retryBaseMs: 100,
      retryMaxMs: 1_000,
      processingTimeoutMs: 5_000,
    });

    const activityA = await waitFor(
      () => listOutboxActivity({ orgId: orgA, limit: 20 }),
      (activity) =>
        activity.some(
          (item) =>
            item.eventType === "agent.evaluation.projected" &&
            item.status === "completed" &&
            item.payload.dataSource === "telemetry",
        ) &&
        activity.some(
          (item) => item.id === eventId && item.status === "completed",
        ),
    );
    const activityB = await listOutboxActivity({ orgId: orgB, limit: 20 });
    expect(activityA.some((item) => item.aggregateId === agentA)).toBe(true);
    expect(
      activityA.some(
        (item) =>
          item.eventType === "agent.evaluation.projected" &&
          item.status === "completed" &&
          item.payload.dataSource === "telemetry",
      ),
    ).toBe(true);
    expect(
      activityA.some(
        (item) => item.id === eventId && item.status === "completed",
      ),
    ).toBe(true);
    expect(activityB).toEqual([]);
    expect(await readOutboxHealthSnapshot()).toMatchObject({
      pending: expect.any(Number),
      processing: expect.any(Number),
      deadLetter: expect.any(Number),
    });
    const [projection] = await workspaceDb.db
      .select({
        monthlyVolume: agents.monthlyVolume,
        monthlyCost: agents.monthlyCost,
      })
      .from(agents)
      .where(eq(agents.id, agentA));
    expect(projection).toEqual({
      monthlyVolume: expectedMonthlyVolume,
      monthlyCost: 0.14,
    });
    const [governance] = await workspaceDb.db
      .select({
        orgId: agentGovernanceAssessments.orgId,
        status: agentGovernanceAssessments.status,
        hallucinationStatus: agentGovernanceAssessments.hallucinationStatus,
      })
      .from(agentGovernanceAssessments)
      .where(eq(agentGovernanceAssessments.agentId, agentA));
    expect(governance).toEqual({
      orgId: orgA,
      status: "insufficient_data",
      hallucinationStatus: "not_measured",
    });
  });
});
