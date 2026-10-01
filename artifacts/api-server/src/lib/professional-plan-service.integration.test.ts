import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agents, organizations } from "@workspace/db/schema";

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";
type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;

const suffix = randomUUID().slice(0, 8);
const orgA = `org_plan_a_${suffix}`;
const orgB = `org_plan_b_${suffix}`;
const agentA = `agent_plan_a_${suffix}`;
const agentB = `agent_plan_b_${suffix}`;

describe.skipIf(!runIntegration)("professional plan decisions PostgreSQL", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    await workspaceDb.db.insert(organizations).values([
      { id: orgA, name: "Plan Tenant A", slug: `plan-tenant-a-${suffix}` },
      { id: orgB, name: "Plan Tenant B", slug: `plan-tenant-b-${suffix}` },
    ]);
    await workspaceDb.db.insert(agents).values([
      { id: agentA, orgId: orgA, name: "Sofia A", slug: "sofia", role: "support", platform: "test" },
      { id: agentB, orgId: orgB, name: "Sofia B", slug: "sofia", role: "support", platform: "test" },
    ]);
  });

  afterAll(async () => {
    if (!workspaceDb) return;
    await workspaceDb.db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  });

  it("vincula pelo slug dentro do tenant e preserva o histórico append-only", async () => {
    const { listProfessionalPlanDecisions, recordProfessionalPlanDecision } =
      await import("./professional-plan-service");
    const base = {
      orgId: orgA,
      userId: "owner-a",
      professionalRef: "sofia",
      professionalName: "Sofia",
      recommendation: "Recalibrar conhecimento e validar dois ciclos.",
      reason: "A evidência confirma queda após a mudança de base.",
      owner: "Patrícia",
    };

    const approved = await recordProfessionalPlanDecision({
      ...base,
      decision: "approved",
      now: new Date("2026-09-02T12:00:00.000Z"),
    });
    await recordProfessionalPlanDecision({
      ...base,
      decision: "adjustment_requested",
      now: new Date("2026-09-03T12:00:00.000Z"),
    });
    const history = await listProfessionalPlanDecisions({ orgId: orgA, professionalRef: "sofia" });

    expect(approved.agentId).toBe(agentA);
    expect(history.map((row) => row.decision)).toEqual(["adjustment_requested", "approved"]);
    expect(history[0]!.actions).toHaveLength(3);
  });

  it("não expõe decisões entre organizações com o mesmo slug", async () => {
    const { listProfessionalPlanDecisions, recordProfessionalPlanDecision } =
      await import("./professional-plan-service");

    expect(await listProfessionalPlanDecisions({ orgId: orgB, professionalRef: "sofia" })).toEqual([]);
    const rejected = await recordProfessionalPlanDecision({
      orgId: orgB,
      userId: "owner-b",
      professionalRef: "sofia",
      professionalName: "Sofia B",
      recommendation: "Plano B",
      decision: "rejected",
      reason: "Escopo incompatível com a função contratada.",
      owner: "Owner B",
    });

    expect(rejected.agentId).toBe(agentB);
    expect(await listProfessionalPlanDecisions({ orgId: orgB, professionalRef: "sofia" })).toHaveLength(1);
    expect(await listProfessionalPlanDecisions({ orgId: orgA, professionalRef: "sofia" })).toHaveLength(2);
  });

  it("executa ações em ordem e exige evidência para concluir", async () => {
    const {
      ProfessionalPlanActionTransitionError,
      recordProfessionalPlanDecision,
      updateProfessionalPlanAction,
    } = await import("./professional-plan-service");
    const decision = await recordProfessionalPlanDecision({
      orgId: orgA,
      userId: "owner-a",
      professionalRef: "sofia",
      professionalName: "Sofia",
      recommendation: "Executar correção supervisionada.",
      decision: "approved",
      reason: "O plano está limitado ao contrato vigente.",
      owner: "Patrícia",
      now: new Date("2026-09-04T12:00:00.000Z"),
    });

    await expect(
      updateProfessionalPlanAction({
        orgId: orgA,
        userId: "owner-a",
        professionalRef: "sofia",
        decisionId: decision.id,
        sequence: 3,
        status: "in_progress",
      }),
    ).rejects.toBeInstanceOf(ProfessionalPlanActionTransitionError);

    const started = await updateProfessionalPlanAction({
      orgId: orgA,
      userId: "owner-a",
      professionalRef: "sofia",
      decisionId: decision.id,
      sequence: 2,
      status: "in_progress",
      now: new Date("2026-09-04T13:00:00.000Z"),
    });
    expect(started.actions[1]!.status).toBe("in_progress");

    const completed = await updateProfessionalPlanAction({
      orgId: orgA,
      userId: "owner-a",
      professionalRef: "sofia",
      decisionId: decision.id,
      sequence: 2,
      status: "completed",
      evidence: "Dois ciclos executados com telemetria válida.",
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(completed.actions[1]).toEqual(
      expect.objectContaining({
        status: "completed",
        evidence: expect.stringContaining("telemetria"),
      }),
    );
  });
});
