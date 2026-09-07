import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agents,
  agentOwners,
  alerts,
  evaluations,
  externalEventReceipts,
  metricEvidence,
  metricPoints,
  organizationMembers,
  organizations,
  purposes,
  teams,
  verdicts,
} from "@workspace/db/schema";
import { byAgentsOf } from "./tenant-scope";

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;

const suffix = randomUUID().slice(0, 8);
const orgA = `org_test_a_${suffix}`;
const orgB = `org_test_b_${suffix}`;
const userId = `user_test_${suffix}`;
const purposeA = `purpose_a_${suffix}`;
const purposeB = `purpose_b_${suffix}`;
const teamA = `team_a_${suffix}`;
const teamB = `team_b_${suffix}`;
const agentA = `agent_a_${suffix}`;
const agentB = `agent_b_${suffix}`;

describe.skipIf(!runIntegration)("tenant security com duas organizações", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "Tenant Test A", slug: `tenant-test-a-${suffix}` },
      { id: orgB, name: "Tenant Test B", slug: `tenant-test-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { orgId: orgA, userId, role: "owner" },
      { orgId: orgB, userId, role: "member" },
    ]);
    await db.insert(purposes).values([
      { id: purposeA, orgId: orgA, key: "support", name: "Support A", domain: "support", outcome: "resolve" },
      { id: purposeB, orgId: orgB, key: "support", name: "Support B", domain: "support", outcome: "resolve" },
    ]);
    await db.insert(teams).values([
      { id: teamA, orgId: orgA, purposeId: purposeA, name: "Team A", slug: "support" },
      { id: teamB, orgId: orgB, purposeId: purposeB, name: "Team B", slug: "support" },
    ]);
    await db.insert(agents).values([
      { id: agentA, orgId: orgA, name: "Agent A", slug: "support-agent", role: "support", platform: "test" },
      { id: agentB, orgId: orgB, name: "Agent B", slug: "support-agent", role: "support", platform: "test" },
    ]);
  });

  afterAll(async () => {
    if (!workspaceDb) return;
    await workspaceDb.db
      .delete(organizations)
      .where(inArray(organizations.id, [orgA, orgB]));
  });

  it("isola evidence e rejeita referência de outro tenant", async () => {
    const { db } = workspaceDb;
    const { invalidEvidenceReferences } = await import("../routes/evidence");

    expect(
      await invalidEvidenceReferences(orgA, {
        agentId: agentA,
        teamId: teamA,
        purposeId: purposeA,
      }),
    ).toEqual([]);
    expect(
      await invalidEvidenceReferences(orgA, {
        agentId: agentB,
        teamId: teamB,
        purposeId: purposeB,
      }),
    ).toEqual(["agentId", "teamId", "purposeId"]);

    const evidenceBase = {
      metricKey: "success-rate",
      label: "Success rate",
      value: 95,
      unit: "%",
      kind: "observed",
      source: { type: "test" },
      lineage: [],
      confidence: 1,
      qualityFlags: [],
    };
    await db.insert(metricEvidence).values([
      { ...evidenceBase, orgId: orgA, agentId: agentA },
      { ...evidenceBase, orgId: orgB, agentId: agentB },
    ]);

    const visible = await db
      .select({ orgId: metricEvidence.orgId, agentId: metricEvidence.agentId })
      .from(metricEvidence)
      .where(eq(metricEvidence.orgId, orgA));
    expect(visible).toEqual([{ orgId: orgA, agentId: agentA }]);
  });

  it("deduplica dentro do tenant e aceita o mesmo evento em outro tenant", async () => {
    const { db } = workspaceDb;
    const eventId = `event_${suffix}`;
    const claim = async (orgId: string, agentId: string) =>
      db
        .insert(externalEventReceipts)
        .values({ orgId, agentId, platform: "zendesk", eventId })
        .onConflictDoNothing({
          target: [
            externalEventReceipts.orgId,
            externalEventReceipts.platform,
            externalEventReceipts.eventId,
          ],
        })
        .returning({ id: externalEventReceipts.id });

    expect(await claim(orgA, agentA)).toHaveLength(1);
    expect(await claim(orgA, agentA)).toHaveLength(0);
    expect(await claim(orgB, agentB)).toHaveLength(1);
  });

  it("resolve a mesma identidade com alçadas diferentes por organização", async () => {
    const { requireOrgAdmin } = await import("../middlewares/orgRole");
    const response = () => {
      const state = { statusCode: 200, body: undefined as unknown };
      return {
        state,
        status(code: number) {
          state.statusCode = code;
          return this;
        },
        json(body: unknown) {
          state.body = body;
          return this;
        },
      };
    };

    const nextA = vi.fn();
    const resA = response();
    await requireOrgAdmin(
      { userId, orgId: orgA } as never,
      resA as never,
      nextA,
    );
    expect(nextA).toHaveBeenCalledOnce();

    const nextB = vi.fn();
    const resB = response();
    await requireOrgAdmin(
      { userId, orgId: orgB } as never,
      resB as never,
      nextB,
    );
    expect(nextB).not.toHaveBeenCalled();
    expect(resB.state.statusCode).toBe(403);
  });

  it("filtra entidades filhas da fleet pelos agentes do tenant", async () => {
    const { db } = workspaceDb;
    await db.insert(agentOwners).values([
      { agentId: agentA, businessOwner: "Owner A" },
      { agentId: agentB, businessOwner: "Owner B" },
    ]);
    await db.insert(evaluations).values([{ agentId: agentA }, { agentId: agentB }]);
    await db.insert(metricPoints).values([{ agentId: agentA }, { agentId: agentB }]);
    await db.insert(alerts).values([
      { agentId: agentA, pattern: "A" },
      { agentId: agentB, pattern: "B" },
    ]);
    await db.insert(verdicts).values([{ agentId: agentA }, { agentId: agentB }]);

    const agentIds = [agentA];
    const [ownerRows, evaluationRows, pointRows, alertRows, verdictRows] = await Promise.all([
      db.select().from(agentOwners).where(byAgentsOf(agentOwners.agentId, agentIds)!),
      db.select().from(evaluations).where(byAgentsOf(evaluations.agentId, agentIds)!),
      db.select().from(metricPoints).where(byAgentsOf(metricPoints.agentId, agentIds)!),
      db.select().from(alerts).where(byAgentsOf(alerts.agentId, agentIds)!),
      db.select().from(verdicts).where(byAgentsOf(verdicts.agentId, agentIds)!),
    ]);

    for (const rows of [ownerRows, evaluationRows, pointRows, alertRows, verdictRows]) {
      expect(rows).toHaveLength(1);
      expect(rows[0]!.agentId).toBe(agentA);
    }
  });
});
