import { describe, expect, it } from "vitest";
import {
  buildProfessionalPlanWorkflow,
  transitionProfessionalPlanAction,
} from "./professional-plan-policy";

const now = new Date("2026-09-02T12:00:00.000Z");
const base = {
  professionalName: "Sofia",
  owner: "Patrícia Lima",
  now,
};

describe("professional development plan decision workflow", () => {
  it("aprova com baseline, execução supervisionada e revisão humana", () => {
    const workflow = buildProfessionalPlanWorkflow({ ...base, decision: "approved" });

    expect(workflow.actions).toHaveLength(3);
    expect(workflow.actions.map((action) => [action.actorType, action.status])).toEqual([
      ["muster", "completed"],
      ["agent", "ready"],
      ["human", "ready"],
    ]);
    expect(workflow.nextReviewAt?.toISOString()).toBe("2026-09-16T12:00:00.000Z");
  });

  it("devolve para ajuste com SLA curto e nova aprovação humana", () => {
    const workflow = buildProfessionalPlanWorkflow({
      ...base,
      decision: "adjustment_requested",
    });

    expect(workflow.actions.map((action) => action.title)).toEqual([
      "Preservar versão recusada",
      "Reformular o plano",
      "Revisar nova versão",
    ]);
    expect(workflow.nextReviewAt?.toISOString()).toBe("2026-09-02T20:00:00.000Z");
  });

  it("rejeita bloqueando execução e exigindo destino humano", () => {
    const workflow = buildProfessionalPlanWorkflow({ ...base, decision: "rejected" });

    expect(workflow.nextReviewAt).toBeNull();
    expect(workflow.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorType: "muster", status: "completed" }),
      expect.objectContaining({ actorType: "human", status: "ready" }),
    ]));
    expect(workflow.actions.some((action) => action.actorType === "agent")).toBe(false);
  });

  it("inicia e conclui uma ação preservando evidência e auditoria", () => {
    const action = buildProfessionalPlanWorkflow({
      ...base,
      decision: "approved",
    }).actions[1]!;
    const started = transitionProfessionalPlanAction({
      action,
      status: "in_progress",
      updatedBy: "operator-a",
      now,
    });
    const completed = transitionProfessionalPlanAction({
      action: started,
      status: "completed",
      evidence: "Execução acompanhada em 40 casos válidos.",
      updatedBy: "operator-a",
      now: new Date("2026-09-03T12:00:00.000Z"),
    });

    expect(started.startedAt).toBe(now.toISOString());
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBe("2026-09-03T12:00:00.000Z");
    expect(completed.evidence).toContain("40 casos");
    expect(completed.updatedBy).toBe("operator-a");
  });

  it("impede conclusão sem evidência e reabertura de ação terminal", () => {
    const action = buildProfessionalPlanWorkflow({
      ...base,
      decision: "approved",
    }).actions[1]!;
    const started = transitionProfessionalPlanAction({
      action,
      status: "in_progress",
      updatedBy: "operator-a",
      now,
    });

    expect(() =>
      transitionProfessionalPlanAction({
        action: started,
        status: "completed",
        updatedBy: "operator-a",
        now,
      }),
    ).toThrow("exige evidência");

    expect(() =>
      transitionProfessionalPlanAction({
        action: { ...started, status: "completed" },
        status: "in_progress",
        updatedBy: "operator-a",
        now,
      }),
    ).toThrow("não pode mudar");
  });
});
