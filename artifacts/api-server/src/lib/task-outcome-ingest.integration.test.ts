import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { and, asc, eq, inArray } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMusterReporter } from "@workspace/telemetry-reporter";
import {
  agentEvents,
  environments,
  eventOutbox,
  organizationMembers,
  organizations,
} from "@workspace/db/schema";
import { TASK_TRAIL_EVENT_TYPE } from "./task-outcome";

/**
 * Contrato do ingest com os campos de resultado (cunha · C1.3) e e2e do SDK
 * (C1.4: 1 task, 2 attempts, 1 review) contra Postgres real e as rotas de
 * produção. A sessão humana vem do header `x-test-user` no lugar do Clerk.
 */
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

const suffix = randomUUID().slice(0, 8);
const orgA = `org_tc_a_${suffix}`;
const orgB = `org_tc_b_${suffix}`;
const adminA = `user_tc_a_${suffix}`;
const adminB = `user_tc_b_${suffix}`;

let workspaceDb: typeof import("@workspace/db");
let server: Server;
let baseUrl = "";
let agentA = "";
let tokenA = "";
let agentB = "";
let tokenB = "";

async function api(path: string, init: { user?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.user) headers["x-test-user"] = init.user;
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, text };
}

const ingest = (body: unknown, token = tokenA, agentId = agentA) =>
  api(`/agents/${agentId}/events`, { token, body });

async function eventosDaTask(taskId: string) {
  return workspaceDb.db
    .select()
    .from(agentEvents)
    .where(and(eq(agentEvents.taskId, taskId)))
    .orderBy(asc(agentEvents.ts));
}

async function trilha(agentId: string) {
  return workspaceDb.db
    .select({ status: eventOutbox.status, payload: eventOutbox.payload, environmentId: eventOutbox.environmentId })
    .from(eventOutbox)
    .where(and(eq(eventOutbox.aggregateId, agentId), eq(eventOutbox.eventType, TASK_TRAIL_EVENT_TYPE)))
    .orderBy(asc(eventOutbox.createdAt));
}

describe.skipIf(!runIntegration)("ingest com resultado de tarefa (cunha · C1.3/C1.4)", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "Cunha A", slug: `cunha-a-${suffix}` },
      { id: orgB, name: "Cunha B", slug: `cunha-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { orgId: orgA, userId: adminA, role: "admin" },
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

    for (const [user, set] of [
      [adminA, (id: string, token: string) => ((agentA = id), (tokenA = token))],
      [adminB, (id: string, token: string) => ((agentB = id), (tokenB = token))],
    ] as const) {
      const agente = await api("/agents", {
        user,
        body: { name: `Cunha ${suffix}`, role: "support", platform: "test", bio: "cunha" },
      });
      const key = await api(`/agents/${agente.body.agent.id}/api-keys`, { user, body: {} });
      set(agente.body.agent.id, key.body.plaintext);
    }
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!workspaceDb) return;
    const { db } = workspaceDb;
    await db.delete(eventOutbox).where(inArray(eventOutbox.orgId, [orgA, orgB]));
    await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  });

  it("payload antigo: mesma resposta byte a byte e evento com escopo da chave, sem campos de tarefa", async () => {
    const r = await ingest({ kind: "execution", success: true, durationMs: 12, costCents: 3 });
    expect(r.status).toBe(202);
    expect(r.text).toBe('{"accepted":true,"duplicate":false}');

    const [row] = await workspaceDb.db
      .select({ ev: agentEvents, envKind: environments.kind })
      .from(agentEvents)
      .innerJoin(environments, eq(environments.id, agentEvents.environmentId))
      .where(eq(agentEvents.agentId, agentA))
      .limit(1);
    expect(row!.envKind).toBe("prod");
    expect(row!.ev).toMatchObject({ orgId: orgA, taskId: null, runId: null, attempt: null, acceptedAt: null });
  });

  it("tenant no corpo é ignorado: conta/projeto/ambiente vêm da chave", async () => {
    const r = await ingest({
      kind: "execution",
      taskId: `t-tenant-${suffix}`,
      orgId: orgB,
      projectId: "prj_de_outro",
      environmentId: "env_de_outro",
    });
    expect(r.status).toBe(202);
    const [ev] = await eventosDaTask(`t-tenant-${suffix}`);
    expect(ev).toMatchObject({ orgId: orgA, attempt: 1 });
    expect(ev!.projectId).not.toBe("prj_de_outro");
  });

  it("cadeia de tentativas: retryOf válido calcula attempt; inválidos são 422", async () => {
    const task = `t-chain-${suffix}`;
    expect((await ingest({ kind: "error", taskId: task, runId: `r1-${suffix}`, costCents: 5 })).status).toBe(202);
    const ok = await ingest({ kind: "execution", success: true, taskId: task, runId: `r2-${suffix}`, retryOf: `r1-${suffix}` });
    expect(ok.status).toBe(202);
    const rows = await eventosDaTask(task);
    expect(rows.map((r) => [r.runId, r.attempt, r.retryOf])).toEqual([
      [`r1-${suffix}`, 1, null],
      [`r2-${suffix}`, 2, `r1-${suffix}`],
    ]);

    // retryOf de outra task.
    expect((await ingest({ kind: "execution", taskId: `t-outra-${suffix}`, runId: "x1", retryOf: `r1-${suffix}` })).status).toBe(422);
    // attempt pulando o ordinal.
    expect((await ingest({ kind: "execution", taskId: task, runId: "x2", retryOf: `r2-${suffix}`, attempt: 5 })).status).toBe(422);
    // attempt > 1 sem retryOf.
    expect((await ingest({ kind: "execution", taskId: task, runId: "x3", attempt: 3 })).status).toBe(422);
    // retryOf inexistente.
    expect((await ingest({ kind: "execution", taskId: task, runId: "x4", retryOf: "nao-existe" })).status).toBe(422);
    // runId sem taskId.
    expect((await ingest({ kind: "execution", runId: "x5" })).status).toBe(422);
    // attempt fracionado.
    expect((await ingest({ kind: "execution", taskId: task, attempt: 1.5 })).status).toBe(422);
  });

  it("retryOf de run de outra conta não é encontrado (422)", async () => {
    const taskB = `t-b-${suffix}`;
    expect((await ingest({ kind: "error", taskId: taskB, runId: `rb1-${suffix}` }, tokenB, agentB)).status).toBe(202);
    const r = await ingest({ kind: "execution", taskId: taskB, runId: `ra2-${suffix}`, retryOf: `rb1-${suffix}` });
    expect(r.status).toBe(422);
  });

  it("segundo resultado para a mesma tentativa é 409", async () => {
    const task = `t-dup-${suffix}`;
    expect((await ingest({ kind: "execution", taskId: task, runId: "d1" })).status).toBe(202);
    expect((await ingest({ kind: "error", taskId: task, runId: "d1b" })).status).toBe(409);
  });

  it("aceite auto sem versão é 422; com versão grava regra e vai para a trilha", async () => {
    const task = `t-auto-${suffix}`;
    expect((await ingest({ kind: "execution", taskId: task, acceptedBy: "regra:schema", acceptedByKind: "auto" })).status).toBe(422);
    const r = await ingest({
      kind: "execution",
      success: true,
      taskId: task,
      runId: `ra-${suffix}`,
      acceptedBy: "regra:schema",
      acceptedByKind: "auto",
      acceptedRuleVersion: "v3",
    });
    expect(r.status).toBe(202);
    const [ev] = await eventosDaTask(task);
    expect(ev).toMatchObject({ acceptedByKind: "auto", acceptedRuleVersion: "v3", acceptedBy: "regra:schema" });
    expect(ev!.acceptedAt).toBeInstanceOf(Date);
    const trail = (await trilha(agentA)).find((t) => t.payload.taskId === task);
    expect(trail).toMatchObject({
      status: "completed",
      payload: { record: "acceptance", acceptedByKind: "auto", acceptedRuleVersion: "v3", decision: "accepted" },
    });
    expect(trail!.environmentId).not.toBeNull();
  });

  it("human_review grava decisão, minutos e revisor e gera linha de trilha no outbox", async () => {
    const task = `t-review-${suffix}`;
    await ingest({ kind: "execution", success: true, taskId: task, runId: `rv-${suffix}` });
    expect((await ingest({ kind: "human_review", taskId: task, success: true })).status).toBe(422);
    const r = await ingest({
      kind: "human_review",
      taskId: task,
      runId: `rv-${suffix}`,
      attempt: 1,
      success: false,
      humanMinutes: 7.25,
      acceptedBy: "ana",
    });
    expect(r.status).toBe(202);
    const review = (await eventosDaTask(task)).find((e) => e.kind === "human_review");
    expect(review).toMatchObject({ success: 0, humanMinutes: 7.25, acceptedBy: "ana", acceptedByKind: "human", acceptedAt: null });
    const trail = (await trilha(agentA)).find((t) => t.payload.taskId === task);
    expect(trail).toMatchObject({
      status: "completed",
      payload: { record: "human_review", decision: "rejected", humanMinutes: 7.25, acceptedBy: "ana" },
    });
  });

  it("e2e do SDK: 1 task, 2 attempts e 1 review aprovada", async () => {
    const reporter = createMusterReporter({ baseUrl, agentId: agentA, token: tokenA });
    const first = reporter.startTask({ taskId: `t-sdk-${suffix}` });
    expect(await first.report({ kind: "error", costCents: 4, tokensIn: 900, contextTokens: 600, model: "m-large" })).toBe(true);
    const second = first.retry();
    expect(await second.report({ kind: "execution", success: true, costCents: 2, tokensIn: 400, model: "m-small" })).toBe(true);
    expect(await second.review({ approved: true, minutes: 3, by: "bruno" })).toBe(true);

    const rows = await eventosDaTask(`t-sdk-${suffix}`);
    expect(rows.map((r) => [r.kind, r.attempt, r.retryOf, r.model])).toEqual([
      ["error", 1, null, "m-large"],
      ["execution", 2, first.runId, "m-small"],
      ["human_review", 2, null, null],
    ]);
    expect(rows[2]).toMatchObject({ humanMinutes: 3, acceptedBy: "bruno", success: 1 });
    expect(rows[2]!.acceptedAt).toBeInstanceOf(Date);
  });
});
