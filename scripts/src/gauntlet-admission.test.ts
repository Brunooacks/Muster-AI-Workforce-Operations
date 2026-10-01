import { describe, expect, it } from "vitest";
import type { WorkloadSummary } from "./gauntlet-workloads";
import {
  buildGauntletAdmission,
  buildGauntletMetrics,
  validateAdmittedAgent,
  validateGauntletAdmission,
} from "./gauntlet-admission";

const summary: WorkloadSummary = {
  scenarioId: "test",
  domain: "business",
  agentName: "Test Agent",
  role: "Executa um contrato verificável",
  platform: "local",
  total: 4,
  successful: 3,
  qualityRate: 75,
  p50DurationMs: 10,
  p95DurationMs: 20,
  throughputPerSecond: 8,
  totalCostCents: 12,
  results: Array.from({ length: 4 }, (_, index) => ({
    scenarioId: "test",
    domain: "business" as const,
    itemId: String(index),
    success: index < 3,
    durationMs: 10,
    costCents: 3,
    expected: "ok",
    observed: index < 3 ? "ok" : "error",
    metadata: { index },
  })),
};

describe("gauntlet admission contract", () => {
  it("gera pelo menos dez métricas cobrindo as cinco camadas", () => {
    const metrics = buildGauntletMetrics(summary);
    expect(metrics).toHaveLength(12);
    expect(new Set(metrics.map((metric) => metric.layer))).toEqual(
      new Set(["efficacy", "efficiency", "adoption", "governance", "value"]),
    );
  });

  it("produz uma admissão completa e válida", () => {
    const payload = buildGauntletAdmission(summary, "stress", "area-lab");
    expect(validateGauntletAdmission(payload)).toEqual([]);
    expect(payload.name).toContain("v3");
    expect(payload.areaId).toBe("area-lab");
  });

  it("detecta falhas de persistência depois da admissão", () => {
    const issues = validateAdmittedAgent({
      agent: { name: "Agent", role: "Role", areaId: null },
      identity: { shouldDo: [], shouldNotDo: [], limits: [], autonomyLevel: "autonomous" },
      owners: { businessOwner: "", technicalOwner: "", governanceSponsor: "" },
      latestEvaluation: { layers: [] },
    }, "area-lab");
    expect(issues).toContain("área não persistida");
    expect(issues).toContain("owners não persistidos");
    expect(issues).toContain("avaliação sem cobertura mínima de métricas");
  });
});
