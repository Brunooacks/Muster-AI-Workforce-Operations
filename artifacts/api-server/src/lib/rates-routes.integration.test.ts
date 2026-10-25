import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { agents, areas, eventOutbox, organizationMembers, organizations } from "@workspace/db/schema";

/**
 * Custo-hora e custos fora da fatura (cunha · C3.2) contra Postgres real.
 * Sessão humana via `x-test-user` no lugar do Clerk.
 */
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

const suffix = randomUUID().slice(0, 8);
const orgA = `org_rt_a_${suffix}`;
const orgB = `org_rt_b_${suffix}`;
const adminA = `user_rt_admin_${suffix}`;
const memberA = `user_rt_member_${suffix}`;
const adminB = `user_rt_b_${suffix}`;
const agentA = `ag_rt_a_${suffix}`;
const agentB = `ag_rt_b_${suffix}`;
const areaA = `area_rt_a_${suffix}`;

let workspaceDb: typeof import("@workspace/db");
let server: Server;
let baseUrl = "";

async function api(path: string, user: string, body?: unknown) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-test-user": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe.skipIf(!runIntegration)("custo-hora e custos fora da fatura · rotas", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "Rates A", slug: `rt-a-${suffix}` },
      { id: orgB, name: "Rates B", slug: `rt-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { orgId: orgA, userId: adminA, role: "admin" },
      { orgId: orgA, userId: memberA, role: "member" },
      { orgId: orgB, userId: adminB, role: "owner" },
    ]);
    await db.insert(areas).values({ id: areaA, orgId: orgA, name: "SAC", slug: `sac-${suffix}` });
    await db.insert(agents).values([
      { id: agentA, orgId: orgA, name: "A", slug: `a-${suffix}`, role: "support", platform: "test" },
      { id: agentB, orgId: orgB, name: "B", slug: `b-${suffix}`, role: "support", platform: "test" },
    ]);
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

  it("conta nova não tem custo-hora (sem seed nem default)", async () => {
    const r = await api("/rates/roles", adminA);
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });

  it("membro comum recebe 403 em leitura e escrita", async () => {
    expect((await api("/rates/roles", memberA)).status).toBe(403);
    expect((await api("/rates/off-invoice", memberA)).status).toBe(403);
    expect((await api("/rates/roles", memberA, { role: "x", hourlyCostCents: 1, currency: "BRL", validFrom: "2026-01-01" })).status).toBe(403);
  });

  it("admin cadastra custo-hora da conta e da área; vigência cruzada é 409; trilha no outbox sem valor", async () => {
    const conta = await api("/rates/roles", adminA, { role: "analista", hourlyCostCents: 9000, currency: "BRL", validFrom: "2026-01-01" });
    expect(conta.status).toBe(201);
    const area = await api("/rates/roles", adminA, { areaId: areaA, role: "analista", hourlyCostCents: 7000, currency: "BRL", validFrom: "2026-01-01" });
    expect(area.status).toBe(201);
    expect((await api("/rates/roles", adminA, { role: "analista", hourlyCostCents: 1, currency: "BRL", validFrom: "2026-05-01" })).status).toBe(409);
    expect((await api("/rates/roles", adminA, { role: "analista", hourlyCostCents: -1, currency: "BRL", validFrom: "2026-05-01" })).status).toBe(400);

    const trilha = await workspaceDb.db
      .select({ payload: eventOutbox.payload })
      .from(eventOutbox)
      .where(and(eq(eventOutbox.orgId, orgA), eq(eventOutbox.eventType, "account.rates.changed")));
    expect(trilha).toHaveLength(2);
    expect(JSON.stringify(trilha)).not.toMatch(/9000|7000/);
  });

  it("custo fora da fatura por agente herda o projeto; agente de outra conta é 400", async () => {
    const ok = await api("/rates/off-invoice", adminA, {
      agentId: agentA, category: "license", amountCents: 50000, currency: "BRL", periodStart: "2026-10-01", periodEnd: "2026-10-31", allocation: "agent",
    });
    expect(ok.status).toBe(201);
    expect(ok.body.projectId).toEqual(expect.any(String));
    const alheio = await api("/rates/off-invoice", adminA, {
      agentId: agentB, category: "license", amountCents: 1, currency: "BRL", periodStart: "2026-10-01", periodEnd: "2026-10-31", allocation: "agent",
    });
    expect(alheio.status).toBe(400);
  });

  it("conta B não vê os dados da conta A", async () => {
    expect((await api("/rates/roles", adminB)).body).toEqual([]);
    expect((await api("/rates/off-invoice", adminB)).body).toEqual([]);
    const area = await api("/rates/roles", adminB, { areaId: areaA, role: "x", hourlyCostCents: 1, currency: "BRL", validFrom: "2026-01-01" });
    expect(area.status).toBe(400);
  });
});
