import { describe, expect, it } from "vitest";
import { generateJourneyRecommendation } from "./journey-recommendation-generator";
import type { JourneyMonitoringSummary } from "./journey-monitoring";

function monitoring(overrides: Partial<JourneyMonitoringSummary> = {}): JourneyMonitoringSummary {
  return {
    totalRuns: 10,
    activeRuns: 0,
    completedRuns: 7,
    failedRuns: 3,
    completionRate: 0.7,
    avgDurationMs: 1000,
    p95DurationMs: 2000,
    totalCostCents: 100,
    avgCostCentsPerRun: 10,
    handoffSuccessRate: 0.75,
    bottleneckStepId: "decision",
    illusoryVictory: true,
    warnings: [],
    steps: [],
    recentRuns: [],
    ...overrides,
  };
}

const steps = [
  { id: "triage", name: "Triagem", agentId: "agent-1", agentName: "Sofia" },
  { id: "decision", name: "Decisão", agentId: "agent-2", agentName: "Júlia" },
];

describe("generateJourneyRecommendation", () => {
  it("keeps autonomy changes blocked until a baseline exists", () => {
    const result = generateJourneyRecommendation(
      monitoring({ totalRuns: 0, completionRate: 0, handoffSuccessRate: null }),
      steps,
    );
    expect(result.title).toContain("Instrumentar");
    expect(result.riskLevel).toBe("medium");
    expect(result.actions.map((action) => action.actorType)).toEqual([
      "muster",
      "agent",
      "human",
    ]);
    expect(result.actions[0]).toMatchObject({
      controlScope: "muster-internal",
      executionMode: "autonomous",
    });
  });

  it("targets the bottleneck agent and separates autonomy boundaries", () => {
    const result = generateJourneyRecommendation(monitoring(), steps);
    expect(result).toMatchObject({
      stepId: "decision",
      agentId: "agent-2",
      riskLevel: "high",
      reviewSlaMinutes: 120,
    });
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorType: "muster", controlScope: "muster-internal" }),
        expect.objectContaining({ actorType: "agent", agentId: "agent-2", controlScope: "external-agent" }),
        expect.objectContaining({ actorType: "human", controlScope: "human-decision" }),
      ]),
    );
  });

  it("não prescreve ajuste de autonomia com amostra insuficiente", () => {
    const result = generateJourneyRecommendation(
      monitoring({ totalRuns: 2, completedRuns: 2, failedRuns: 0, completionRate: 1, handoffSuccessRate: 1, illusoryVictory: false }),
      steps,
      { slaMinutes: 45 },
    );
    expect(result.title).toContain("Consolidar baseline");
    expect(result.rationale).toContain("amostra suficiente");
    expect(result.actions.some((action) => action.capability === "apply-agent-adjustment")).toBe(false);
  });

  it("preserva uma jornada estável sem transformar tempo relativo em gargalo", () => {
    const result = generateJourneyRecommendation(
      monitoring({ totalRuns: 10, completedRuns: 10, failedRuns: 0, completionRate: 1, handoffSuccessRate: 1, p95DurationMs: 25 * 60_000, illusoryVictory: false }),
      steps,
      { slaMinutes: 45 },
    );
    expect(result.title).toContain("Preservar desempenho");
    expect(result.rationale).toContain("dentro do SLA");
    expect(result.actions.map((action) => action.actorType)).toEqual(["muster", "human"]);
  });

  it("trata latência como desvio apenas quando o p95 supera o SLA", () => {
    const result = generateJourneyRecommendation(
      monitoring({ totalRuns: 10, completedRuns: 10, failedRuns: 0, completionRate: 1, handoffSuccessRate: 1, p95DurationMs: 50 * 60_000, illusoryVictory: false }),
      steps,
      { slaMinutes: 45 },
    );
    expect(result.title).toContain("Reduzir tempo");
    expect(result.expectedImpact).toContain("p95");
  });

  it("escalates critical completion loss to a one-hour review SLA", () => {
    const result = generateJourneyRecommendation(
      monitoring({ completionRate: 0.4, handoffSuccessRate: 0.5 }),
      steps,
    );
    expect(result.riskLevel).toBe("critical");
    expect(result.reviewSlaMinutes).toBe(60);
  });
});
