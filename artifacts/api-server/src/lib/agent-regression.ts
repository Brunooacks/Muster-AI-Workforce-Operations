import type { TelemetrySummary } from "./telemetry";

export type RegressionStatus =
  | "insufficient_data"
  | "stable"
  | "drift"
  | "warning"
  | "regression";

export type RegressionMetric =
  | "success_rate"
  | "p95_duration"
  | "cost_per_execution"
  | "error_rate"
  | "escalation_rate";

export interface RegressionWindow {
  comparisonKey: string;
  releaseId?: string;
  summary: TelemetrySummary;
  inputProfile?: Record<string, number>;
}
export interface RegressionPolicy {
  minExecutions: number;
  maxInputDrift: number;
  warning: {
    successRateDrop: number;
    p95DurationIncrease: number;
    costIncrease: number;
    errorRateIncrease: number;
    escalationRateIncrease: number;
  };
  regression: {
    successRateDrop: number;
    p95DurationIncrease: number;
    costIncrease: number;
    errorRateIncrease: number;
    escalationRateIncrease: number;
  };
}

export interface RegressionSignal {
  metric: RegressionMetric;
  baseline: number;
  current: number;
  delta: number;
  severity: "warning" | "regression";
}

export interface RegressionAssessment {
  status: RegressionStatus;
  comparable: boolean;
  attributable: boolean;
  inputDrift: number | null;
  baselineReleaseId: string | null;
  currentReleaseId: string | null;
  signals: RegressionSignal[];
  reasons: string[];
}

export const defaultRegressionPolicy: RegressionPolicy = {
  minExecutions: 20,
  maxInputDrift: 0.2,
  warning: {
    successRateDrop: 0.03,
    p95DurationIncrease: 0.15,
    costIncrease: 0.15,
    errorRateIncrease: 0.03,
    escalationRateIncrease: 0.03,
  },
  regression: {
    successRateDrop: 0.05,
    p95DurationIncrease: 0.25,
    costIncrease: 0.25,
    errorRateIncrease: 0.05,
    escalationRateIncrease: 0.05,
  },
};

function relativeIncrease(baseline: number | null, current: number | null): number | null {
  if (baseline === null || current === null || baseline <= 0) return null;
  return (current - baseline) / baseline;
}

function absoluteIncrease(baseline: number | null, current: number | null): number | null {
  if (baseline === null || current === null) return null;
  return current - baseline;
}

function normalizedProfile(profile: Record<string, number> | undefined): Record<string, number> | null {
  if (!profile) return null;
  const total = Object.values(profile).reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return null;
  return Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [key, Math.max(0, value) / total]),
  );
}

export function inputDistributionDrift(
  baseline: Record<string, number> | undefined,
  current: Record<string, number> | undefined,
): number | null {
  const left = normalizedProfile(baseline);
  const right = normalizedProfile(current);
  if (!left || !right) return null;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let distance = 0;
  for (const key of keys) distance += Math.abs((left[key] ?? 0) - (right[key] ?? 0));
  return distance / 2;
}

function signal(
  metric: RegressionMetric,
  baseline: number | null,
  current: number | null,
  warningThreshold: number,
  regressionThreshold: number,
  delta: number | null,
): RegressionSignal | null {
  if (baseline === null || current === null || delta === null || delta < warningThreshold) return null;
  return {
    metric,
    baseline,
    current,
    delta,
    severity: delta >= regressionThreshold ? "regression" : "warning",
  };
}

export function assessAgentRegression(
  baseline: RegressionWindow,
  current: RegressionWindow,
  policy: RegressionPolicy = defaultRegressionPolicy,
): RegressionAssessment {
  const base = {
    baselineReleaseId: baseline.releaseId ?? null,
    currentReleaseId: current.releaseId ?? null,
  };
  if (baseline.comparisonKey !== current.comparisonKey) {
    return {
      ...base,
      status: "insufficient_data",
      comparable: false,
      attributable: false,
      inputDrift: null,
      signals: [],
      reasons: ["comparison_key_mismatch"],
    };
  }
  if (
    baseline.summary.totalExecutions < policy.minExecutions
    || current.summary.totalExecutions < policy.minExecutions
  ) {
    return {
      ...base,
      status: "insufficient_data",
      comparable: true,
      attributable: false,
      inputDrift: inputDistributionDrift(baseline.inputProfile, current.inputProfile),
      signals: [],
      reasons: ["minimum_sample_not_reached"],
    };
  }

  const inputDrift = inputDistributionDrift(baseline.inputProfile, current.inputProfile);
  const signals = [
    signal(
      "success_rate",
      baseline.summary.successRate,
      current.summary.successRate,
      policy.warning.successRateDrop,
      policy.regression.successRateDrop,
      baseline.summary.successRate !== null && current.summary.successRate !== null
        ? baseline.summary.successRate - current.summary.successRate
        : null,
    ),
    signal(
      "p95_duration",
      baseline.summary.p95DurationMs,
      current.summary.p95DurationMs,
      policy.warning.p95DurationIncrease,
      policy.regression.p95DurationIncrease,
      relativeIncrease(baseline.summary.p95DurationMs, current.summary.p95DurationMs),
    ),
    signal(
      "cost_per_execution",
      baseline.summary.avgCostCentsPerExecution,
      current.summary.avgCostCentsPerExecution,
      policy.warning.costIncrease,
      policy.regression.costIncrease,
      relativeIncrease(
        baseline.summary.avgCostCentsPerExecution,
        current.summary.avgCostCentsPerExecution,
      ),
    ),
    signal(
      "error_rate",
      baseline.summary.errorRate,
      current.summary.errorRate,
      policy.warning.errorRateIncrease,
      policy.regression.errorRateIncrease,
      absoluteIncrease(baseline.summary.errorRate, current.summary.errorRate),
    ),
    signal(
      "escalation_rate",
      baseline.summary.escalationRate,
      current.summary.escalationRate,
      policy.warning.escalationRateIncrease,
      policy.regression.escalationRateIncrease,
      absoluteIncrease(baseline.summary.escalationRate, current.summary.escalationRate),
    ),
  ].filter((candidate): candidate is RegressionSignal => candidate !== null);

  if (inputDrift !== null && inputDrift > policy.maxInputDrift) {
    return {
      ...base,
      status: "drift",
      comparable: false,
      attributable: false,
      inputDrift,
      signals,
      reasons: ["input_distribution_drift"],
    };
  }

  const status: RegressionStatus = signals.some((item) => item.severity === "regression")
    ? "regression"
    : signals.length > 0
      ? "warning"
      : "stable";
  return {
    ...base,
    status,
    comparable: true,
    attributable: status !== "stable" && baseline.releaseId !== current.releaseId,
    inputDrift,
    signals,
    reasons: [],
  };
}
