import { describe, expect, it } from "vitest";
import { assessAgentRegression, inputDistributionDrift } from "./agent-regression";
import type { TelemetrySummary } from "./telemetry";

function summary(overrides: Partial<TelemetrySummary> = {}): TelemetrySummary {
  return {
    windowDays: 7,
    totalExecutions: 100,
    successRate: 0.95,
    avgDurationMs: 900,
    p95DurationMs: 1_500,
    totalCostCents: 2_000,
    avgCostCentsPerExecution: 20,
    executionsPerDay: 14.28,
    escalationRate: 0.02,
    errorRate: 0.01,
    activeDays: 7,
    firstEventAt: "2026-08-01T00:00:00.000Z",
    lastEventAt: "2026-08-07T23:59:59.000Z",
    ...overrides,
  };
}

const baseline = {
  comparisonKey: "support|billing|pt-BR|context-v1",
  releaseId: "release-1",
  summary: summary(),
  inputProfile: { simple: 80, complex: 20 },
};

describe("assessAgentRegression", () => {
  it("requires a minimum sample instead of inventing a regression", () => {
    const result = assessAgentRegression(baseline, {
      ...baseline,
      releaseId: "release-2",
      summary: summary({ totalExecutions: 5, successRate: 0.2 }),
    });

    expect(result.status).toBe("insufficient_data");
    expect(result.reasons).toContain("minimum_sample_not_reached");
  });

  it("rejects incompatible workload cohorts", () => {
    const result = assessAgentRegression(baseline, {
      ...baseline,
      comparisonKey: "support|technical|pt-BR|context-v1",
    });

    expect(result.status).toBe("insufficient_data");
    expect(result.comparable).toBe(false);
  });

  it("keeps a comparable release stable inside tolerance", () => {
    const result = assessAgentRegression(baseline, {
      ...baseline,
      releaseId: "release-2",
      summary: summary({ successRate: 0.94, p95DurationMs: 1_600 }),
    });

    expect(result.status).toBe("stable");
    expect(result.signals).toEqual([]);
  });

  it("detects an attributable multi-dimensional regression", () => {
    const result = assessAgentRegression(baseline, {
      ...baseline,
      releaseId: "release-2",
      summary: summary({
        successRate: 0.86,
        p95DurationMs: 2_100,
        avgCostCentsPerExecution: 28,
        errorRate: 0.08,
      }),
    });

    expect(result.status).toBe("regression");
    expect(result.attributable).toBe(true);
    expect(result.signals.map((item) => item.metric)).toEqual([
      "success_rate",
      "p95_duration",
      "cost_per_execution",
      "error_rate",
    ]);
  });

  it("classifies workload drift before blaming the new release", () => {
    const result = assessAgentRegression(baseline, {
      ...baseline,
      releaseId: "release-2",
      summary: summary({ successRate: 0.85 }),
      inputProfile: { simple: 20, complex: 80 },
    });

    expect(result.status).toBe("drift");
    expect(result.attributable).toBe(false);
    expect(result.signals).toHaveLength(1);
    expect(result.reasons).toContain("input_distribution_drift");
  });
});
describe("inputDistributionDrift", () => {
  it("uses total variation distance across input classes", () => {
    expect(inputDistributionDrift({ a: 80, b: 20 }, { a: 20, b: 80 })).toBeCloseTo(0.6);
    expect(inputDistributionDrift(undefined, { a: 1 })).toBeNull();
  });
});
