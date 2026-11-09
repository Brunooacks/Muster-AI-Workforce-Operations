import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentContracts,
  agentEvents,
  agents,
  environments,
  organizationMembers,
  organizations,
  outcomeSnapshots,
  roleRates,
} from "@workspace/db/schema";

/**
 * Fechamento por período (cunha · C4.4) contra Postgres real: mesmo período →
 * mesmo inputs_hash; mudar contrato/custo-hora depois não mexe no snapshot; o
 * snapshot reproduz o cálculo só com o que guarda; sandbox fica de fora.
 */

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";
const suffix = randomUUID().slice(0, 8);
const orgId = `org_snap_${suffix}`;
const agentId = `ag_snap_${suffix}`;
const MONTH = "2026-09";

let workspaceDb: typeof import("@workspace/db");
let snapshots: typeof import("./outcome-snapshots");

describe.skipIf(!runIntegration)("outcome_snapshots · fechamento por período", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    snapshots = await import("./outcome-snapshots");
    const { db } = workspaceDb;
    await db.insert(organizations).values({ id: orgId, name: "Snap", slug: `snap-${suffix}` });
    const [member] = await db.insert(organizationMembers).values({ orgId, userId: `u_${suffix}`, role: "admin" }).returning();
    const [agent] = await db
      .insert(agents)
      .values({ id: agentId, orgId, name: "Snap", slug: `snap-${suffix}`, role: "support", platform: "test" })
      .returning();
    const envs = await db.select().from(environments).where(eq(environments.projectId, agent!.projectId));
    const sandbox = envs.find((e) => e.kind === "sandbox")!;
    const prod = envs.find((e) => e.kind === "prod")!;
    const base = { agentId, orgId, projectId: agent!.projectId };
    await db.insert(agentEvents).values([
      { ...base, environmentId: prod.id, ts: new Date("2026-09-03T10:00:00Z"), kind: "execution", taskId: "s1", runId: "s1r1", attempt: 1, costCents: 40, success: 1, acceptedBy: "ana", acceptedByKind: "human", acceptedAt: new Date("2026-09-03T10:05:00Z") },
      { ...base, environmentId: prod.id, ts: new Date("2026-09-04T10:00:00Z"), kind: "execution", taskId: "s2", runId: "s2r1", attempt: 1, costCents: 60, success: 1 },
      { ...base, environmentId: prod.id, ts: new Date("2026-09-04T11:00:00Z"), kind: "human_review", taskId: "s2", runId: "s2r1", attempt: 1, success: 1, humanMinutes: 10, acceptedBy: "bia", acceptedByKind: "human", acceptedAt: new Date("2026-09-04T11:00:00Z") },
      // Sandbox não é prova de valor.
      { ...base, environmentId: sandbox.id, ts: new Date("2026-09-05T10:00:00Z"), kind: "execution", taskId: "sx", runId: "sxr1", attempt: 1, costCents: 9999, success: 1, acceptedBy: "ana", acceptedByKind: "human", acceptedAt: new Date("2026-09-05T10:00:00Z") },
      // Fora do mês.
      { ...base, environmentId: prod.id, ts: new Date("2026-10-01T00:00:00Z"), kind: "execution", taskId: "s9", runId: "s9r1", attempt: 1, costCents: 7, success: 1 },
    ]);
    await db.insert(roleRates).values({ orgId, role: "support", hourlyCostCents: 6000, currency: "BRL", validFrom: "2026-01-01", createdBy: "u" });
    await db.insert(agentContracts).values({
      ...base, version: 1, metricKey: "cost_per_validated_task", unit: "BRL", direction: "down", baseline: 3, target: 0.5,
      deadline: "2027-01-31", ownerMemberId: member!.id, status: "active", createdBy: "u", referenceHumanMinutes: 15,
      createdAt: new Date("2026-08-01T00:00:00Z"),
    });
  });

  afterAll(async () => {
    if (!workspaceDb) return;
    await workspaceDb.db.delete(organizations).where(inArray(organizations.id, [orgId]));
  });

  it("fecha o mês com prod, sem sandbox e sem evento de outro mês", async () => {
    const r = await snapshots.closeOutcomePeriod({ orgId, agentId, month: MONTH });
    expect(r?.created).toBe(true);
    const layer1 = r!.snapshot.layer1 as { cost: { status: string; value: { totalCost: { cents: number }; costPerValidatedTask: { cents: number }; humanCostPerTask: { cents: number } } } };
    // 40 + 60 tokens + 10 min × R$60/h (1000) = 1100 ÷ 2 aceitas = 550; humano 15 min = 1500.
    expect(layer1.cost.status).toBe("ok");
    expect(layer1.cost.value.totalCost.cents).toBe(1100);
    expect(layer1.cost.value.costPerValidatedTask.cents).toBe(550);
    expect(layer1.cost.value.humanCostPerTask.cents).toBe(1500);
    expect(r!.snapshot).toMatchObject({ contractVersion: 1, period: MONTH, calcVersion: "cunha-1", taskCoverage: 1 });
    expect(r!.snapshot.roleRatesSnapshot).toMatchObject({ hourlyCostCents: 6000 });
  });

  it("recalcular o mesmo período gera o mesmo inputs_hash (idempotente)", async () => {
    const [primeiro] = await workspaceDb.db.select().from(outcomeSnapshots).where(eq(outcomeSnapshots.agentId, agentId));
    const de_novo = await snapshots.closeOutcomePeriod({ orgId, agentId, month: MONTH });
    expect(de_novo).toMatchObject({ created: false, snapshot: { id: primeiro!.id, inputsHash: primeiro!.inputsHash } });
  });

  it("mudar custo-hora e contrato depois não altera o snapshot antigo; ele reproduz o cálculo", async () => {
    const { db } = workspaceDb;
    const [antes] = await db.select().from(outcomeSnapshots).where(eq(outcomeSnapshots.agentId, agentId));
    await db.update(roleRates).set({ hourlyCostCents: 12000 }).where(eq(roleRates.orgId, orgId));
    await db.update(agentContracts).set({ status: "superseded", supersededAt: new Date() }).where(eq(agentContracts.agentId, agentId));

    const [depois] = await db.select().from(outcomeSnapshots).where(eq(outcomeSnapshots.id, antes!.id));
    expect(depois).toEqual(antes);
    const reproduzido = snapshots.reproduceSnapshot(depois!);
    expect(JSON.parse(JSON.stringify(reproduzido.layer1))).toEqual(depois!.layer1);
    expect(JSON.parse(JSON.stringify(reproduzido.layer2))).toEqual(depois!.layer2);

    // Refechar com dados novos vira outra linha (outro hash); a antiga fica.
    const novo = await snapshots.closeOutcomePeriod({ orgId, agentId, month: MONTH });
    expect(novo?.created).toBe(true);
    expect(novo?.snapshot.inputsHash).not.toBe(antes!.inputsHash);
  });

  it("snapshot fechado é imutável", async () => {
    const { db } = workspaceDb;
    await expect(db.update(outcomeSnapshots).set({ period: "2026-08" }).where(eq(outcomeSnapshots.agentId, agentId))).rejects.toThrow();
    await expect(db.delete(outcomeSnapshots).where(eq(outcomeSnapshots.agentId, agentId))).rejects.toThrow();
  });
});
