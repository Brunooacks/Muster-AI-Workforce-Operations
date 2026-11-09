import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agentContracts,
  agentEvents,
  agentOwners,
  agents,
  environments,
  eventOutbox,
  organizationMembers,
  organizations,
  roleRates,
} from "@workspace/db/schema";

/**
 * GET /agents/:id/outcome e POST …/outcome/close (cunha · C12.1) contra
 * Postgres real. Sessão humana via `x-test-user`.
 */
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";
const suffix = randomUUID().slice(0, 8);
const orgA = `org_oc_a_${suffix}`;
const orgB = `org_oc_b_${suffix}`;
const adminA = `user_oc_a_${suffix}`;
const memberA = `user_oc_m_${suffix}`;
const adminB = `user_oc_b_${suffix}`;
const agentA = `ag_oc_a_${suffix}`;
const agentSemCusto = `ag_oc_s_${suffix}`;
const PAST = "2026-08";

let workspaceDb: typeof import("@workspace/db");
let server: Server;
let baseUrl = "";

async function api(path: string, user: string, method = "GET") {
  const response = await fetch(`${baseUrl}/api${path}`, { method, headers: { "x-test-user": user } });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe.skipIf(!runIntegration)("página do agente · /agents/:id/outcome", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "Outcome A", slug: `oc-a-${suffix}` },
      { id: orgB, name: "Outcome B", slug: `oc-b-${suffix}` },
    ]);
    const membros = await db
      .insert(organizationMembers)
      .values([
        { orgId: orgA, userId: adminA, role: "admin" },
        { orgId: orgA, userId: memberA, role: "member" },
        { orgId: orgB, userId: adminB, role: "owner" },
      ])
      .returning();
    const [agent] = await db
      .insert(agents)
      .values([
        { id: agentA, orgId: orgA, name: "Resultado", slug: `res-${suffix}`, role: "analista", platform: "test" },
        { id: agentSemCusto, orgId: orgA, name: "Sem custo", slug: `sem-${suffix}`, role: "sem-tarifa", platform: "test" },
      ])
      .returning();
    await db.insert(agentOwners).values({ agentId: agentA, businessOwner: "Ana", technicalOwner: "", governanceSponsor: "Caio" });
    const prod = (await db.select().from(environments).where(eq(environments.projectId, agent!.projectId))).find((e) => e.kind === "prod");
    const base = { orgId: orgA, projectId: agent!.projectId, environmentId: prod!.id };
    await db.insert(roleRates).values({ orgId: orgA, role: "analista", hourlyCostCents: 6000, currency: "BRL", validFrom: "2026-01-01", createdBy: adminA });
    await db.insert(agentContracts).values({
      ...base, agentId: agentA, version: 1, metricKey: "acceptance_rate", unit: "%", direction: "up", baseline: 50, target: 80,
      deadline: "2099-01-01", ownerMemberId: membros.find((m) => m.userId === adminA)!.id, status: "active", createdBy: adminA,
      referenceHumanMinutes: 10, createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const now = new Date();
    for (const [agentId, ts, task] of [
      [agentA, now, "now1"],
      [agentA, new Date("2026-08-10T10:00:00Z"), "aug1"],
      [agentSemCusto, now, "sc1"],
    ] as const) {
      await db.insert(agentEvents).values({
        ...base, agentId, ts, kind: "execution", taskId: task, runId: `${task}r1`, attempt: 1, costCents: 100, success: 1,
        acceptedBy: "regra", acceptedByKind: "auto", acceptedRuleVersion: "v7", acceptedAt: ts,
      });
    }
    await db.insert(agentEvents).values({ ...base, agentId: agentA, ts: now, kind: "execution", costCents: 5, success: 1 });
    await db.insert(eventOutbox).values({
      orgId: orgA, projectId: agent!.projectId, aggregateType: "agent", aggregateId: agentA, eventType: "agent.task.trail",
      payload: { record: "acceptance", acceptedByKind: "auto", acceptedRuleVersion: "v7" }, status: "completed", processedAt: now,
    });

    const { default: router } = await import("../routes");
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste indisponível");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!workspaceDb) return;
    const { db } = workspaceDb;
    await db.delete(eventOutbox).where(inArray(eventOutbox.orgId, [orgA, orgB]));
    await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  });

  it("mês corrente: três camadas, sinais, contrato e cobertura; cada número com status", async () => {
    const r = await api(`/agents/${agentA}/outcome`, memberA);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      agentId: agentA,
      source: "live",
      calcVersion: "cunha-1",
      coverage: { status: "ok", value: { ratio: 0.5, eventsWithTask: 1, totalEvents: 2 } },
      layer1: { cost: { status: "ok", value: { costPerValidatedTask: { cents: 100 }, humanCostPerTask: { cents: 1000 } } } },
      layer2: { acceptanceRate: { status: "ok", value: 100 }, autoAcceptShare: { status: "ok", value: 100 }, contract: { status: "ok" } },
      layer3: {
        trail: { status: "ok", value: { autoAcceptances: 1, ruleVersions: ["v7"] } },
        ownerCoverage: { status: "ok", value: { covered: 3, of: 4, missing: ["technical_owner"] } },
        credentialCoverage: { status: "unavailable", reason: "no_active_agent_key" },
        snapshot: { status: "unavailable", reason: "period_not_closed" },
      },
      signals: { adoption: { status: "ok" } },
      contract: { version: 1 },
      verdict: { status: "coming_soon" },
    });
  });

  it("sem custo-hora: camada 1 indisponível com motivo; sem contrato: comparação indisponível", async () => {
    const r = await api(`/agents/${agentSemCusto}/outcome`, adminA);
    expect(r.body.layer1.cost).toEqual({ status: "unavailable", reason: "missing_hourly_rate" });
    expect(r.body.layer2.contract).toEqual({ status: "unavailable", reason: "no_contract" });
    expect(r.body.contract).toBeNull();
  });

  it("outra conta é 404; period inválido é 400", async () => {
    expect((await api(`/agents/${agentA}/outcome`, adminB)).status).toBe(404);
    expect((await api(`/agents/${agentA}/outcome?period=2026-13`, adminA)).status).toBe(400);
  });

  it("fechar mês passado: admin cria (201), repete (200); membro 403; mês aberto 400; GET lê o snapshot", async () => {
    expect((await api(`/agents/${agentA}/outcome/close?period=${PAST}`, memberA, "POST")).status).toBe(403);
    const aberto = new Date().toISOString().slice(0, 7);
    expect((await api(`/agents/${agentA}/outcome/close?period=${aberto}`, adminA, "POST")).status).toBe(400);
    const criado = await api(`/agents/${agentA}/outcome/close?period=${PAST}`, adminA, "POST");
    expect(criado.status).toBe(201);
    const repetido = await api(`/agents/${agentA}/outcome/close?period=${PAST}`, adminA, "POST");
    expect(repetido.status).toBe(200);
    expect(repetido.body.inputsHash).toBe(criado.body.inputsHash);
    const lido = await api(`/agents/${agentA}/outcome?period=${PAST}`, memberA);
    expect(lido.body).toMatchObject({
      source: "snapshot",
      period: PAST,
      layer1: { cost: { status: "ok", value: { tasks: 1 } } },
      layer3: { snapshot: { status: "ok", value: { inputsHash: criado.body.inputsHash } } },
    });
    expect((await api(`/agents/${agentA}/outcome/close?period=${PAST}`, adminB, "POST")).status).toBe(404);
  });
});
