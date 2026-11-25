import { describe, expect, it, vi } from "vitest";

/**
 * RG-X04 (MUS-190): admitAgentTx não pode vincular um agente da org B a uma
 * área pertencente à org A.
 */
const tables = vi.hoisted(() => ({
  agents: { name: "agents", orgId: "agents.orgId", slug: "agents.slug", externalId: "agents.externalId" },
  areas: { name: "areas", id: "areas.id", orgId: "areas.orgId" },
  connectors: { name: "connectors", id: "connectors.id", orgId: "connectors.orgId" },
  projects: { name: "projects", id: "projects.id", orgId: "projects.orgId" },
  agentConnectorLinks: { name: "agentConnectorLinks" },
  agentIdentities: { name: "agentIdentities" },
  agentOwners: { name: "agentOwners" },
  catalogMetrics: { name: "catalogMetrics", key: "catalogMetrics.key", orgId: "catalogMetrics.orgId" },
  evaluations: { name: "evaluations" },
  verdicts: { name: "verdicts" },
  verdictActions: { name: "verdictActions" },
  metricPoints: { name: "metricPoints" },
}));

vi.mock("@workspace/db", () => ({
  ...tables,
  db: { transaction: vi.fn() },
}));

const ORG_AREAS = [{ id: "area_alpha_1", orgId: "tenant_alpha" }];

function matchesOrgArea(whereArg: unknown): boolean {
  const serialized = JSON.stringify(whereArg);
  return ORG_AREAS.some(
    (area) =>
      serialized.includes(`"${area.id}"`) &&
      serialized.includes(`"${area.orgId}"`),
  );
}

function makeFakeTx(insertedAgents: Array<Record<string, unknown>>) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: (predicate: unknown) => {
          const rows =
            table === tables.areas && matchesOrgArea(predicate)
              ? [{ id: "area_alpha_1" }]
              : [];
          const result: unknown[] & { limit: () => Promise<unknown[]> } = Object.assign(
            rows,
            { limit: async () => rows },
          );
          return Object.assign(Promise.resolve(rows), {
            limit: result.limit,
          });
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        if (table === tables.agents) insertedAgents.push(vals);
        return {
          returning: async () => [{ id: "created_id_1", ...vals }],
        };
      },
    }),
  };
}

import { admitAgentTx, InvalidAdmissionAreaError } from "./admission";

describe("RG-X04 · admissão valida se areaId pertence à organização", () => {
  it("rejeita areaId da org A ao admitir agente na org B", async () => {
    const insertedAgents: Array<Record<string, unknown>> = [];
    const tx = makeFakeTx(insertedAgents);

    await expect(
      admitAgentTx(tx as never, {
        orgId: "tenant_beta",
        areaId: "area_alpha_1",
        name: "Agente Intruso",
        role: "Suporte",
        platform: "custom",
        bio: "Teste de isolamento de área",
      }),
    ).rejects.toBeInstanceOf(InvalidAdmissionAreaError);

    expect(insertedAgents).toHaveLength(0);
  });

  it("aceita areaId da própria org A", async () => {
    const insertedAgents: Array<Record<string, unknown>> = [];
    const tx = makeFakeTx(insertedAgents);

    const id = await admitAgentTx(tx as never, {
      orgId: "tenant_alpha",
      areaId: "area_alpha_1",
      name: "Agente Legítimo",
      role: "Suporte",
      platform: "custom",
      bio: "Teste positivo de área",
    });

    expect(id).toBe("created_id_1");
    expect(insertedAgents).toHaveLength(1);
    expect(insertedAgents[0]?.areaId).toBe("area_alpha_1");
  });
});
