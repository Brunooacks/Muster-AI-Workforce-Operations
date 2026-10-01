import { describe, expect, it } from "vitest";
import {
  estimateDelivery,
  evaluateMaturity,
  type ReadinessCheck,
} from "./maturity-evaluator";

function check(
  id: string,
  weight: number,
  status: ReadinessCheck["status"],
  overrides: Partial<ReadinessCheck> = {},
): ReadinessCheck {
  return {
    id,
    dimension: id,
    title: id,
    weight,
    status,
    evidence: [],
    gap: status === "proven" ? "" : `Fechar ${id}`,
    workstream: "Produto",
    effortDays: { min: 2, max: 4 },
    criticalForPaidPilot: true,
    criticalForGeneralAvailability: true,
    ...overrides,
  };
}

describe("maturity evaluator", () => {
  it("não permite autopromoção quando um gate crítico está apenas parcial", () => {
    const assessment = evaluateMaturity([
      check("core", 70, "proven"),
      check("release", 30, "partial"),
    ]);
    expect(assessment.score).toBe(87);
    expect(assessment.paidPilotReady).toBe(false);
    expect(assessment.stage).toBe("design_partner");
    expect(assessment.paidPilotBlockers.map((item) => item.id)).toEqual(["release"]);
  });

  it("aprova disponibilidade geral somente com todos os gates comprovados", () => {
    const assessment = evaluateMaturity([
      check("core", 60, "proven"),
      check("operations", 40, "proven"),
    ]);
    expect(assessment.score).toBe(100);
    expect(assessment.paidPilotReady).toBe(true);
    expect(assessment.generalAvailabilityReady).toBe(true);
    expect(assessment.stage).toBe("general_availability");
  });

  it("calcula trabalho individual e calendário paralelizado por frente", () => {
    const estimate = estimateDelivery([
      check("connector", 50, "missing", {
        workstream: "Integrações",
        effortDays: { min: 3, max: 5 },
      }),
      check("backup", 50, "missing", {
        workstream: "Plataforma",
        effortDays: { min: 2, max: 4 },
      }),
    ], { min: 2, max: 3 });
    expect(estimate.personDays).toEqual({ min: 5, max: 9 });
    expect(estimate.parallelCalendarDays).toEqual({ min: 5, max: 8 });
  });

  it("rejeita pesos que não formam uma avaliação completa", () => {
    expect(() => evaluateMaturity([check("incompleto", 99, "proven")])).toThrow(
      "devem somar 100",
    );
  });
});
