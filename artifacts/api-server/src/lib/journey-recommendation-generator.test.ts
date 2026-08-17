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

  it("escalates critical completion loss to a one-hour review SLA", () => {
    const result = generateJourneyRecommendation(
      monitoring({ completionRate: 0.4, handoffSuccessRate: 0.5 }),
      steps,
    );
    expect(result.riskLevel).toBe("critical");
    expect(result.reviewSlaMinutes).toBe(60);
  });
});
