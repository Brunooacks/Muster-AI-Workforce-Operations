import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agents,
  eventOutbox,
  organizationMembers,
  organizations,
  verdicts,
} from "@workspace/db/schema";

/**
 * Contrato numérico versionado (cunha · C2.2/C2.3) contra Postgres real. A
 * sessão humana vem de `x-test-user` no lugar do Clerk.
 */
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

const suffix = randomUUID().slice(0, 8);
const orgA = `org_ct_a_${suffix}`;
const orgB = `org_ct_b_${suffix}`;
const userA = `user_ct_a_${suffix}`;
const userB = `user_ct_b_${suffix}`;
const userMembro = `user_ct_m_${suffix}`;
const agentA = `ag_ct_a_${suffix}`;

let workspaceDb: typeof import("@workspace/db");
let server: Server;
let baseUrl = "";
let memberA = "";
let memberB = "";

async function api(path: string, init: { user: string; body?: unknown } = { user: userA }) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-test-user": init.user },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function corpo(over: Record<string, unknown> = {}) {
  return {
    metricKey: "custo_por_tarefa_aceita",
    unit: "BRL",
    direction: "down",
    baseline: 12,
    target: 8,
    deadline: "2099-12-31",
    ownerMemberId: memberA,
    referenceHumanMinutes: 20,
    requireHumanAccept: true,
    ...over,
  };
}

describe.skipIf(!runIntegration)("contrato numérico versionado · rotas", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "Contrato A", slug: `ct-a-${suffix}` },
      { id: orgB, name: "Contrato B", slug: `ct-b-${suffix}` },
    ]);
    const membros = await db
      .insert(organizationMembers)
      .values([
        { orgId: orgA, userId: userA, role: "admin" },
        { orgId: orgA, userId: userMembro, role: "member" },
        { orgId: orgB, userId: userB, role: "owner" },
      ])
      .returning();
    memberA = membros.find((m) => m.orgId === orgA)!.id;
    memberB = membros.find((m) => m.orgId === orgB)!.id;
    await db.insert(agents).values({ id: agentA, orgId: orgA, name: "Contratado", slug: `contratado-${suffix}`, role: "support", platform: "test" });
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

  it("agente sem contrato aparece como pendente (active nulo)", async () => {
    const r = await api(`/agents/${agentA}/contracts`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ agentId: agentA, active: null, versions: [] });
    expect(r.body.ownerCandidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: memberA, userId: userA })]),
    );
    expect((await api(`/agents/${agentA}/contracts`, { user: userMembro })).status).toBe(200);
    expect((await api(`/agents/${agentA}/contracts`, { user: userMembro, body: corpo() })).status).toBe(403);
  });

  it("validação: números, deadline futura, dono membro da conta", async () => {
    expect((await api(`/agents/${agentA}/contracts`, { user: userA, body: corpo({ target: "8" }) })).status).toBe(400);
    expect((await api(`/agents/${agentA}/contracts`, { user: userA, body: corpo({ deadline: "2020-01-01" }) })).status).toBe(400);
    const donoDeFora = await api(`/agents/${agentA}/contracts`, { user: userA, body: corpo({ ownerMemberId: memberB }) });
    expect(donoDeFora.status).toBe(400);
    expect(donoDeFora.body.error).toMatch(/membro da conta/);
  });

  it("POST cria v1, depois v2; v1 vira superseded; trilha no outbox", async () => {
    const v1 = await api(`/agents/${agentA}/contracts`, { user: userA, body: corpo() });
    expect(v1.status).toBe(201);
    expect(v1.body).toMatchObject({ version: 1, status: "active", target: 8, requireHumanAccept: true, referenceHumanMinutes: 20 });

    // Veredito gravado na vigência da v1.
    await workspaceDb.db.insert(verdicts).values({ id: `vd_ct_${suffix}`, agentId: agentA });

    const v2 = await api(`/agents/${agentA}/contracts`, { user: userA, body: corpo({ target: 6, referenceModel: "modelo-x" }) });
    expect(v2.status).toBe(201);
    expect(v2.body).toMatchObject({ version: 2, status: "active", target: 6, referenceModel: "modelo-x" });

    const hist = await api(`/agents/${agentA}/contracts`);
    expect(hist.body.active).toMatchObject({ version: 2 });
    expect(hist.body.versions.map((v: { version: number; status: string }) => [v.version, v.status])).toEqual([
      [2, "active"],
      [1, "superseded"],
    ]);

    const trilha = await workspaceDb.db
      .select({ payload: eventOutbox.payload })
      .from(eventOutbox)
      .where(and(eq(eventOutbox.orgId, orgA), eq(eventOutbox.eventType, "agent.contract.versioned")));
    expect(trilha.map((t) => t.payload.version).sort()).toEqual([1, 2]);
  });

  it("veredito antigo continua lendo a meta da v1 (R3)", async () => {
    const r = await api(`/agents/${agentA}/verdicts`);
    expect(r.status).toBe(200);
    const antigo = r.body.find((v: { id: string }) => v.id === `vd_ct_${suffix}`);
    expect(antigo).toMatchObject({ contractVersion: 1, contract: { version: 1, target: 8 } });
  });

  it("outra conta: GET e POST dão 404; verdicts também", async () => {
    expect((await api(`/agents/${agentA}/contracts`, { user: userB })).status).toBe(404);
    expect((await api(`/agents/${agentA}/contracts`, { user: userB, body: corpo({ ownerMemberId: memberB }) })).status).toBe(404);
    expect((await api(`/agents/${agentA}/verdicts`, { user: userB })).status).toBe(404);
  });
});
