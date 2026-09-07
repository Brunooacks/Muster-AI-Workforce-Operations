import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentGovernanceAssessments,
  agentEvents,
  agents,
  eventOutbox,
  organizations,
} from "@workspace/db/schema";

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
const eventId = `outbox_event_${suffix}`;

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
      name: "Outbox Agent",
      slug: "outbox-agent",
      role: "support",
      platform: "test",
    });
  });

  afterAll(async () => {
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
    expect(projection).toEqual({ monthlyVolume: 1, monthlyCost: 0.14 });
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
