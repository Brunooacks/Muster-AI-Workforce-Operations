import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentIdentities,
  catalogMetrics,
  organizations,
} from "@workspace/db/schema";

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";
type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;

const suffix = randomUUID().slice(0, 8);
const orgA = `org_metric_a_${suffix}`;
const orgB = `org_metric_b_${suffix}`;
const catalogKeyA = `contract-accuracy-${suffix}`;
const catalogKeyB = `foreign-metric-${suffix}`;

describe.skipIf(!runIntegration)("admission metric catalog PostgreSQL", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    await workspaceDb.db.insert(organizations).values([
      { id: orgA, name: "Metric Tenant A", slug: `metric-tenant-a-${suffix}` },
      { id: orgB, name: "Metric Tenant B", slug: `metric-tenant-b-${suffix}` },
    ]);
    await workspaceDb.db.insert(catalogMetrics).values([
      {
        orgId: orgA,
        key: catalogKeyA,
        vertical: "tecnologia",
        layer: "efficacy",
        label: "Acurácia contratada",
        unit: "%",
        target: "≥ 92%",
        isCustom: 1,
      },
      {
        orgId: orgB,
        key: catalogKeyB,
        vertical: "tecnologia",
        layer: "efficacy",
        label: "Métrica de outro tenant",
        unit: "%",
        target: "≥ 99%",
        isCustom: 1,
      },
    ]);
  });

  afterAll(async () => {
    if (!workspaceDb) return;
    await workspaceDb.db
      .delete(organizations)
      .where(inArray(organizations.id, [orgA, orgB]));
  });

  it("preserva a identidade da métrica herdada no contrato profissional", async () => {
    const { admitAgent } = await import("./admission");
    const agentId = await admitAgent({
      orgId: orgA,
      name: `Catalog Agent ${suffix}`,
      role: "quality",
      platform: "test",
      bio: "Agent used to validate catalog inheritance.",
      proposedMetrics: [
        {
          catalogMetricKey: catalogKeyA,
          layer: "efficacy",
          label: "Acurácia contratada",
          unit: "%",
          target: "≥ 92%",
        },
      ],
    });
    const [identity] = await workspaceDb.db
      .select({ businessCase: agentIdentities.businessCase })
      .from(agentIdentities)
      .where(eq(agentIdentities.agentId, agentId));

    expect(identity?.businessCase.metricContracts?.[0]).toMatchObject({
      catalogMetricKey: catalogKeyA,
      label: "Acurácia contratada",
      target: "≥ 92%",
    });
  });

  it("bloqueia uma métrica que pertence a outra organização", async () => {
    const { admitAgent, InvalidAdmissionCatalogMetricError } =
      await import("./admission");

    await expect(
      admitAgent({
        orgId: orgA,
        name: `Foreign Metric Agent ${suffix}`,
        role: "quality",
        platform: "test",
        bio: "Must not inherit a metric from another tenant.",
        proposedMetrics: [
          {
            catalogMetricKey: catalogKeyB,
            layer: "efficacy",
            label: "Métrica de outro tenant",
            unit: "%",
            target: "≥ 99%",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidAdmissionCatalogMetricError);
  });
});
