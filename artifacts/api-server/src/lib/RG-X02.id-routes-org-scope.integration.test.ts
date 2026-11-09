import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agents,
  evaluations,
  journeyHandoffs,
  journeyRecommendationActions,
  journeyRecommendations,
  journeySteps,
  journeys,
  metricPoints,
  organizationMembers,
  organizations,
  purposes,
  teamAgentAssignments,
  teamMemberships,
  teams,
} from "@workspace/db/schema";

/**
 * RG-X02 (P0 MU-10-SG1 / MU-09-SG1): toda rota com :id de tabela-filha tem de
 * herdar o escopo da organização do pai. Uma sessão da org B, conhecendo ids
 * da org A, recebe 404 — nunca 200/204 — e o recurso de A fica intacto.
 */
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";
const s = randomUUID().slice(0, 8);
const orgA = `org_x02_a_${s}`;
const orgB = `org_x02_b_${s}`;
const userA = `user_x02_a_${s}`;
const userB = `user_x02_b_${s}`;
const agentA = `ag_x02_a_${s}`;
const ids = {
  purpose: `pu_x02_${s}`, team: `tm_x02_${s}`, journey: `jr_x02_${s}`,
  step1: `st1_x02_${s}`, step2: `st2_x02_${s}`, handoff: `ho_x02_${s}`,
  rec: `rc_x02_${s}`, action: `ac_x02_${s}`, membership: `ms_x02_${s}`, assignment: `as_x02_${s}`,
};

let db: typeof import("@workspace/db")["db"];
let server: Server;
let baseUrl = "";

async function call(method: string, path: string, user: string, body?: unknown) {
  const r = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { "content-type": "application/json", "x-test-user": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, text };
}

describe.skipIf(!runIntegration)("RG-X02 · rotas :id herdam o escopo da org", () => {
  beforeAll(async () => {
    ({ db } = await import("@workspace/db"));
    await db.insert(organizations).values([
      { id: orgA, name: "X02 A", slug: `x02-a-${s}` },
      { id: orgB, name: "X02 B", slug: `x02-b-${s}` },
    ]);
    await db.insert(organizationMembers).values([
      { orgId: orgA, userId: userA, role: "owner" },
      { orgId: orgB, userId: userB, role: "owner" },
    ]);
    await db.insert(agents).values({ id: agentA, orgId: orgA, name: "Alvo", slug: `alvo-${s}`, role: "support", platform: "test" });
    await db.insert(evaluations).values({ agentId: agentA, evaluatedAt: new Date() } as never);
    await db.insert(metricPoints).values({ agentId: agentA, timestamp: new Date() } as never);
    await db.insert(purposes).values({ id: ids.purpose, orgId: orgA, key: `k-${s}`, name: "P", domain: "d", outcome: "o" } as never);
    await db.insert(teams).values({ id: ids.team, orgId: orgA, name: "T", slug: `t-${s}`, purposeId: ids.purpose } as never);
    await db.insert(teamMemberships).values({ id: ids.membership, teamId: ids.team, memberId: "m1", memberName: "M" } as never);
    await db.insert(teamAgentAssignments).values({ id: ids.assignment, teamId: ids.team, agentId: agentA } as never);
    await db.insert(journeys).values({ id: ids.journey, orgId: orgA, teamId: ids.team, name: "J", slug: `j-${s}` } as never);
    await db.insert(journeySteps).values([
      { id: ids.step1, journeyId: ids.journey, stepKey: "a", name: "A", sequence: 1 },
      { id: ids.step2, journeyId: ids.journey, stepKey: "b", name: "B", sequence: 2 },
    ] as never);
    await db.insert(journeyHandoffs).values({ id: ids.handoff, journeyId: ids.journey, fromStepId: ids.step1, toStepId: ids.step2 } as never);
    await db.insert(journeyRecommendations).values({
      id: ids.rec, journeyId: ids.journey, title: "R", rationale: "r", reviewDueAt: new Date(Date.now() + 86_400_000),
    } as never);
    await db.insert(journeyRecommendationActions).values({
      id: ids.action, recommendationId: ids.rec, sequence: 1, actorType: "human", title: "a", capability: "c",
      executionMode: "manual", controlScope: "team",
    } as never);
    const { default: router } = await import("../routes");
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", r));
    const a = server.address();
    baseUrl = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  });

  afterAll(async () => {
    server?.close();
    await db?.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  });

  const casos: Array<[string, string, () => string, unknown?]> = [
    ["GET", "evaluations (MU-10-SG1)", () => `/agents/${agentA}/evaluations`],
    ["GET", "metrics/30d (MU-09-SG1)", () => `/agents/${agentA}/metrics/30d`],
    ["DELETE", "journey step", () => `/journeys/${ids.journey}/steps/${ids.step2}`],
    ["DELETE", "journey handoff", () => `/journeys/${ids.journey}/handoffs/${ids.handoff}`],
    ["POST", "recommendation decision", () => `/journeys/${ids.journey}/recommendations/${ids.rec}/decision`,
      { decision: "approved", decidedBy: "intruso", reason: "x" }],
    ["PATCH", "recommendation action", () => `/journeys/${ids.journey}/recommendations/${ids.rec}/actions/${ids.action}`,
      { status: "in-progress" }],
    ["DELETE", "team membership", () => `/teams/${ids.team}/members/${ids.membership}`],
    ["DELETE", "team agent assignment", () => `/teams/${ids.team}/agents/${ids.assignment}`],
  ];

  for (const [method, nome, path, body] of casos) {
    it(`org B → ${method} ${nome} de A dá 404 sem vazar nem alterar`, async () => {
      const r = await call(method, path(), userB, body);
      expect(r.status).toBe(404);
      expect(r.text).not.toContain(agentA);
    });
  }

  it("os recursos de A continuam intactos", async () => {
    expect(await db.select().from(journeySteps).where(eq(journeySteps.id, ids.step2))).toHaveLength(1);
    expect(await db.select().from(journeyHandoffs).where(eq(journeyHandoffs.id, ids.handoff))).toHaveLength(1);
    expect(await db.select().from(teamMemberships).where(eq(teamMemberships.id, ids.membership))).toHaveLength(1);
    expect(await db.select().from(teamAgentAssignments).where(eq(teamAgentAssignments.id, ids.assignment))).toHaveLength(1);
    const [rec] = await db.select().from(journeyRecommendations).where(eq(journeyRecommendations.id, ids.rec));
    expect(rec?.decidedBy ?? null).toBeNull();
    const [act] = await db.select().from(journeyRecommendationActions).where(eq(journeyRecommendationActions.id, ids.action));
    expect(act?.startedAt ?? null).toBeNull();
  });

  it("controle positivo: a própria org A lê as avaliações (200)", async () => {
    const r = await call("GET", `/agents/${agentA}/evaluations`, userA);
    expect(r.status).toBe(200);
  });
});
