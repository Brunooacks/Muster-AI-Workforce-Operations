import type { Server } from "node:http";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RG-M32 (MUS-195): endpoints de baseline humano isolam por organização e papel (admin).
 */
const state = vi.hoisted(() => ({
  activeOrgId: "org_b",
  activeRole: "admin",
  baselines: [
    {
      id: "hb_a_1",
      orgId: "org_a",
      taskType: "Triagem",
      agentId: null as string | null,
      humanMinutesPerTask: 12,
      humanAccuracyRate: 90,
      humanEscalationRate: 15,
      measurementKind: "measured",
      measuredAt: "2026-10-01",
      notes: "Baseline Org A" as string | null,
      createdBy: "u_a",
      createdAt: new Date("2026-11-25T10:00:00Z"),
      updatedAt: new Date("2026-11-25T10:00:00Z"),
    },
  ],
  agentTaskType: { agent_org_a: "Triagem" } as Record<string, string | null>,
  mutations: 0,
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.userId = "user_test";
    next();
  },
}));

vi.mock("../middlewares/requireOrg", () => ({
  requireOrg: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.orgId = state.activeOrgId;
    next();
  },
}));

vi.mock("../middlewares/orgRole", () => ({
  requireOrgAdmin: (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (state.activeRole !== "admin" && state.activeRole !== "owner") {
      res.status(403).json({ error: "Apenas administradores." });
      return;
    }
    next();
  },
}));

vi.mock("../lib/agent-contracts", () => ({
  agentInOrg: vi.fn(async (orgId: string, agentId: string) => orgId === "org_a" && agentId === "agent_org_a"),
}));

vi.mock("../lib/human-baselines", () => ({
    toHumanBaseline: (row: { id: string; taskType: string; agentId: string | null; humanMinutesPerTask: number; humanAccuracyRate: number; humanEscalationRate: number; notes: string | null; createdBy: string; createdAt: Date; updatedAt: Date }) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }),
    listHumanBaselines: vi.fn(async (orgId: string) => state.baselines.filter((b) => b.orgId === orgId)),
    getAgentHumanBaselineContext: vi.fn(async (orgId: string, agentId: string) => {
      if (orgId !== "org_a" || agentId !== "agent_org_a") return null;
      const resolved = state.baselines.find((b) => b.orgId === orgId && b.taskType === state.agentTaskType[agentId]) ?? null;
      return {
        agentId,
        taskType: state.agentTaskType[agentId] ?? null,
        role: "support",
        resolved: resolved ? { ...resolved, source: "task_type_baseline" as const } : null,
        orgBaselines: state.baselines.filter((b) => b.orgId === orgId && b.agentId === null),
      };
    }),
    upsertHumanBaseline: vi.fn(async (input: { orgId: string; agentId?: string | null; taskType: string; humanMinutesPerTask: number; humanAccuracyRate: number; humanEscalationRate: number; notes?: string | null; userId: string }) => {
      if (input.agentId && !(input.orgId === "org_a" && input.agentId === "agent_org_a")) return null;
      state.mutations += 1;
      const row = {
        id: "hb_new",
        orgId: input.orgId,
        taskType: input.taskType,
        agentId: input.agentId ?? null,
        humanMinutesPerTask: input.humanMinutesPerTask,
        humanAccuracyRate: input.humanAccuracyRate,
        humanEscalationRate: input.humanEscalationRate,
        measurementKind: "measured",
        measuredAt: "2026-11-01",
        notes: input.notes ?? null,
        createdBy: input.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.baselines.push(row);
      return row;
    }),
    saveAgentHumanBaseline: vi.fn(async (input: { orgId: string; agentId: string; taskType: string; humanMinutesPerTask: number; humanAccuracyRate: number; humanEscalationRate: number; scope: "task_type" | "agent"; notes?: string | null; userId: string }) => {
      if (input.orgId !== "org_a" || input.agentId !== "agent_org_a") return null;
      state.mutations += 1;
      state.agentTaskType[input.agentId] = input.taskType;
      return {
        agentId: input.agentId,
        taskType: input.taskType,
        role: "support",
        resolved: {
          id: "hb_saved",
          taskType: input.taskType,
          source: input.scope === "agent" ? ("agent_baseline" as const) : ("task_type_baseline" as const),
          humanMinutesPerTask: input.humanMinutesPerTask,
          humanAccuracyRate: input.humanAccuracyRate,
          humanEscalationRate: input.humanEscalationRate,
          measurementKind: "measured",
          measuredAt: "2026-11-01",
          notes: input.notes ?? null,
        },
        orgBaselines: state.baselines.filter((b) => b.orgId === input.orgId && b.agentId === null),
      };
    }),
    deleteHumanBaseline: vi.fn(async (orgId: string, baselineId: string) => {
      const idx = state.baselines.findIndex((b) => b.orgId === orgId && b.id === baselineId);
      if (idx === -1) return false;
      state.mutations += 1;
      state.baselines.splice(idx, 1);
      return true;
    }),
}));

import humanBaselinesRouter from "./human-baselines";

async function call(method: string, path: string, body?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use("/api", humanBaselinesRouter);
  const server = app.listen(0) as Server;
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("No port");
    const res = await fetch(`http://127.0.0.1:${addr.port}/api${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("RG-M32 · isolamento por org nos endpoints de baseline humano (MUS-195)", () => {
  beforeEach(() => {
    state.activeOrgId = "org_b";
    state.activeRole = "admin";
    state.mutations = 0;
  });

  it("org B tentando ler, alterar ou apagar baseline/agente da org A recebe 404 sem mutar", async () => {
    expect((await call("GET", "/agents/agent_org_a/human-baseline")).status).toBe(404);
    expect(
      (
        await call("PUT", "/agents/agent_org_a/human-baseline", {
          taskType: "Sabotagem",
          humanMinutesPerTask: 99,
          humanAccuracyRate: 50,
          humanEscalationRate: 50,
          scope: "task_type",
          measurementKind: "estimated",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call("PUT", "/human-baselines", {
          agentId: "agent_org_a",
          taskType: "Sabotagem",
          humanMinutesPerTask: 99,
          humanAccuracyRate: 50,
          humanEscalationRate: 50,
      measurementKind: "estimated",
        })
      ).status,
    ).toBe(404);
    expect((await call("DELETE", "/human-baselines/hb_a_1")).status).toBe(404);
    expect(state.mutations).toBe(0);
  });

  it("controle positivo: org A lê e salva baseline (200), membro comum recebe 403", async () => {
    state.activeOrgId = "org_a";
    const got = await call("GET", "/agents/agent_org_a/human-baseline");
    expect(got.status).toBe(200);
    expect(got.body.resolved.taskType).toBe("Triagem");

    const saved = await call("PUT", "/agents/agent_org_a/human-baseline", {
      taskType: "Triagem N2",
      humanMinutesPerTask: 20,
      humanAccuracyRate: 88,
      humanEscalationRate: 12,
      scope: "task_type",
      measurementKind: "measured",
      measuredAt: "2026-11-01",
    });
    expect(saved.status).toBe(200);
    expect(state.mutations).toBe(1);

    state.activeRole = "member";
    const forbidden = await call("PUT", "/agents/agent_org_a/human-baseline", {
      taskType: "Triagem N2",
      humanMinutesPerTask: 20,
      humanAccuracyRate: 88,
      humanEscalationRate: 12,
      scope: "task_type",
      measurementKind: "measured",
      measuredAt: "2026-11-01",
    });
    expect(forbidden.status).toBe(403);
  });
});
