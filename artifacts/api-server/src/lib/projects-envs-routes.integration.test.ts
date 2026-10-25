import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agentApiKeys,
  environments,
  eventOutbox,
  organizationMembers,
  organizations,
  projects,
} from "@workspace/db/schema";

/**
 * Contrato das rotas da E1 (T1.7) contra Postgres real. A sessão humana vem do
 * header `x-test-user` no lugar do Clerk; o resto (requireOrg, RBAC, rotas,
 * banco, triggers) é o código de produção.
 */
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

const suffix = randomUUID().slice(0, 8);
const orgA = `org_e1r_a_${suffix}`;
const orgB = `org_e1r_b_${suffix}`;
const adminA = `user_e1r_admin_${suffix}`;
const memberA = `user_e1r_member_${suffix}`;
const adminB = `user_e1r_b_${suffix}`;

let workspaceDb: typeof import("@workspace/db");
let server: Server;
let baseUrl = "";

async function api(
  path: string,
  init: { user?: string; token?: string; method?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.user) headers["x-test-user"] = init.user;
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, text };
}

describe.skipIf(!runIntegration)("rotas da E1 · projetos, ambientes e chaves", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "E1 Rotas A", slug: `e1-rotas-a-${suffix}` },
      { id: orgB, name: "E1 Rotas B", slug: `e1-rotas-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { orgId: orgA, userId: adminA, role: "admin" },
      { orgId: orgA, userId: memberA, role: "member" },
      { orgId: orgB, userId: adminB, role: "owner" },
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

  it("GET /projects: toda conta já tem o projeto Padrão", async () => {
    const r = await api("/projects", { user: memberA });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([
      expect.objectContaining({ name: "Padrão", slug: "padrao", isDefault: true }),
    ]);
  });

  it("POST /projects: admin cria com sandbox e prod; slug repetido é 409; membro é 403", async () => {
    const criado = await api("/projects", { user: adminA, body: { name: "Checkout Web" } });
    expect(criado.status).toBe(201);
    expect(criado.body.project).toMatchObject({ name: "Checkout Web", slug: "checkout-web", isDefault: false });
    expect(criado.body.environments.map((e: { kind: string }) => e.kind)).toEqual(["prod", "sandbox"]);

    expect((await api("/projects", { user: adminA, body: { name: "Checkout Web" } })).status).toBe(409);
    expect((await api("/projects", { user: memberA, body: { name: "Outro" } })).status).toBe(403);
    expect((await api("/projects", { user: adminA, body: { name: "  " } })).status).toBe(400);
  });

  it("GET /projects/:id/environments: projeto de outra conta é 404", async () => {
    const [padraoB] = await workspaceDb.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, orgB));
    expect((await api(`/projects/${padraoB!.id}/environments`, { user: adminA })).status).toBe(404);
    const proprio = await api(`/projects/${padraoB!.id}/environments`, { user: adminB });
    expect(proprio.status).toBe(200);
    expect(proprio.body).toHaveLength(2);
  });

  it("POST /agents aceita projectId da conta e recusa o de outra conta", async () => {
    const lista = await api("/projects", { user: adminA });
    const checkout = lista.body.find((p: { slug: string }) => p.slug === "checkout-web");
    const [padraoB] = await workspaceDb.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, orgB));
    const base = { name: `Agente ${suffix}`, role: "support", platform: "test", bio: "e1" };

    const ok = await api("/agents", { user: adminA, body: { ...base, projectId: checkout.id } });
    expect(ok.status).toBe(201);
    const recusado = await api("/agents", {
      user: adminA,
      body: { ...base, name: `Outro ${suffix}`, projectId: padraoB!.id },
    });
    expect(recusado.status).toBe(400);
  });

  it("chave: sem ambiente é prod (msk_live_), com sandbox é msk_sbx_; listagem mostra o ambiente", async () => {
    const agente = await api("/agents", {
      user: adminA,
      body: { name: `Chaves ${suffix}`, role: "support", platform: "test", bio: "e1" },
    });
    const agentId = agente.body.agent.id as string;

    const prod = await api(`/agents/${agentId}/api-keys`, { user: adminA, body: {} });
    expect(prod.status).toBe(201);
    expect(prod.body.plaintext.startsWith("msk_live_")).toBe(true);
    expect(prod.body.key.environment).toBe("prod");

    const sbx = await api(`/agents/${agentId}/api-keys`, {
      user: adminA,
      body: { environment: "sandbox", label: "testes" },
    });
    expect(sbx.status).toBe(201);
    expect(sbx.body.plaintext.startsWith("msk_sbx_")).toBe(true);
    expect(sbx.body.key.masked.startsWith("msk_sbx_")).toBe(true);

    expect(
      (await api(`/agents/${agentId}/api-keys`, { user: adminA, body: { environment: "staging" } })).status,
    ).toBe(400);

    const lista = await api(`/agents/${agentId}/api-keys`, { user: memberA });
    expect(lista.body.map((k: { environment: string }) => k.environment).sort()).toEqual(["prod", "sandbox"]);
    expect(new Set(lista.body.map((k: { projectId: string }) => k.projectId)).size).toBe(1);
  });

  it("chave antiga (inserida como antes da E1) segue ingerindo e o outbox grava projeto/prod", async () => {
    const { generateAgentApiKey } = await import("./agent-api-key");
    const agente = await api("/agents", {
      user: adminA,
      body: { name: `Legado ${suffix}`, role: "support", platform: "test", bio: "e1" },
    });
    const agentId = agente.body.agent.id as string;
    const key = generateAgentApiKey();
    // INSERT do jeito antigo: sem projeto nem ambiente (o trigger preenche).
    await workspaceDb.db.insert(agentApiKeys).values({
      orgId: orgA,
      agentId,
      prefix: key.prefix,
      keyHash: key.keyHash,
    });

    const r = await api(`/agents/${agentId}/events`, {
      token: key.plaintext,
      body: { kind: "execution", success: true, durationMs: 10 },
    });
    expect(r.status).toBe(202);

    const [linha] = await workspaceDb.db
      .select({ projectId: eventOutbox.projectId, kind: environments.kind, padrao: projects.isDefault })
      .from(eventOutbox)
      .innerJoin(environments, eq(environments.id, eventOutbox.environmentId))
      .innerJoin(projects, eq(projects.id, eventOutbox.projectId))
      .where(eq(eventOutbox.aggregateId, agentId));
    expect(linha).toMatchObject({ kind: "prod", padrao: true });
  });
});
