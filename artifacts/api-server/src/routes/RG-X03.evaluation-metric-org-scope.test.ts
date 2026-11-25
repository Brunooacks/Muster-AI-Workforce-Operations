import type { Server } from "node:http";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RG-X03 (MUS-190): PATCH /agents/:agentId/evaluation/metric não pode ler nem
 * mutar a avaliação de um agente pertencente a outra organização.
 */
const state = vi.hoisted(() => ({
  activeOrgId: "org_b",
  evaluationLayers: [
    {
      key: "efficacy",
      name: "Eficácia",
      score: 80,
      metrics: [
        {
          key: "resolution_rate",
          label: "Taxa de resolução",
          value: "80%",
          target: ">= 85%",
          rationale: "Meta original da Org A",
        },
      ],
    },
  ],
  updateCount: 0,
}));

const mockTables = vi.hoisted(() => ({
  agents: { name: "agents", id: "agents.id", orgId: "agents.orgId" },
  evaluations: {
    name: "evaluations",
    id: "evaluations.id",
    agentId: "evaluations.agentId",
    evaluatedAt: "evaluations.evaluatedAt",
  },
  areas: { name: "areas", id: "areas.id", orgId: "areas.orgId" },
  agentIdentities: { name: "agentIdentities" },
  agentOwners: { name: "agentOwners" },
  verdicts: { name: "verdicts" },
  metricPoints: { name: "metricPoints" },
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

vi.mock("../lib/agent-contracts", () => ({
  agentInOrg: vi.fn(async (orgId: string, agentId: string) =>
    orgId === "org_a" && agentId === "agent_org_a",
  ),
  listContracts: vi.fn(async () => []),
  toAgentContract: vi.fn(),
}));

vi.mock("../lib/serializers", () => ({
  buildAgentDetail: vi.fn(async (agentId: string, orgId: string) =>
    orgId === "org_a" && agentId === "agent_org_a"
      ? { id: agentId, layers: state.evaluationLayers }
      : null,
  ),
  toAgentSummary: vi.fn(),
  toEvaluation: vi.fn(),
  toVerdict: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  ...mockTables,
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              if (table === mockTables.evaluations) {
                return [
                  {
                    id: "eval_a_1",
                    agentId: "agent_org_a",
                    layers: structuredClone(state.evaluationLayers),
                  },
                ];
              }
              return [];
            },
          }),
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: { layers?: typeof state.evaluationLayers }) => ({
        where: async () => {
          if (table === mockTables.evaluations && values.layers) {
            state.evaluationLayers = structuredClone(values.layers);
            state.updateCount += 1;
          }
          return [];
        },
      }),
    }),
  },
}));

import agentsRouter from "./agents";

async function patchMetric(agentId: string, body: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use("/api", agentsRouter);
  const server = app.listen(0) as Server;
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/agents/${agentId}/evaluation/metric`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const text = await response.text();
    return { status: response.status, text };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("RG-X03 · PATCH /agents/:agentId/evaluation/metric isola por organização", () => {
  beforeEach(() => {
    state.activeOrgId = "org_b";
    state.updateCount = 0;
    state.evaluationLayers = [
      {
        key: "efficacy",
        name: "Eficácia",
        score: 80,
        metrics: [
          {
            key: "resolution_rate",
            label: "Taxa de resolução",
            value: "80%",
            target: ">= 85%",
            rationale: "Meta original da Org A",
          },
        ],
      },
    ];
  });

  it("org B tentando alterar métrica de agente da org A recebe 404 e não muta o banco", async () => {
    const result = await patchMetric("agent_org_a", {
      layerKey: "efficacy",
      metricLabel: "Taxa de resolução",
      target: ">= 1%",
      rationale: "Sabotagem cross-tenant",
    });

    expect(result.status).toBe(404);
    expect(state.updateCount).toBe(0);
    expect(state.evaluationLayers[0]!.metrics[0]!.target).toBe(">= 85%");
    expect(state.evaluationLayers[0]!.metrics[0]!.rationale).toBe("Meta original da Org A");
  });

  it("controle positivo: a própria org A atualiza a métrica do próprio agente (200)", async () => {
    state.activeOrgId = "org_a";
    const result = await patchMetric("agent_org_a", {
      layerKey: "efficacy",
      metricLabel: "Taxa de resolução",
      target: ">= 90%",
      rationale: "Nova meta da Org A",
    });

    expect(result.status).toBe(200);
    expect(state.updateCount).toBe(1);
    expect(state.evaluationLayers[0]!.metrics[0]!.target).toBe(">= 90%");
    expect(state.evaluationLayers[0]!.metrics[0]!.rationale).toBe("Nova meta da Org A");
  });
});
