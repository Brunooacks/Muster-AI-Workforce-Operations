import type { PreAssessResult } from "@workspace/api-client-react";

export type FastAssessmentGap =
  | "framework"
  | "runtime"
  | "telemetry"
  | "metrics"
  | "purpose"
  | "governance";

export interface FastAssessmentSummary {
  score: number;
  status: "ready" | "review" | "blocked";
  codeConfidence: number;
  purposeConfidence: number;
  telemetryReadiness: number;
  metricReadiness: number;
  declaredMetrics: number;
  suggestedMetrics: number;
  runtimeSignals: string[];
  executionSignals: string[];
  observabilitySignals: string[];
  gaps: FastAssessmentGap[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidence(result: PreAssessResult, key: string, fallback = 0): number {
  return result.fieldConfidence[key] ?? fallback;
}

export function summarizeFastAssessment(result: PreAssessResult): FastAssessmentSummary {
  const metrics = result.draft.proposedMetrics;
  const declaredMetrics = metrics.filter((metric) => /extra[ií]d[oa]|declarad[oa]|reposit[oó]rio/i.test(metric.rationale ?? "")).length;
  const suggestedMetrics = metrics.filter((metric) => /sugerid[oa].*cat[aá]logo/i.test(metric.rationale ?? "")).length;
  const layerCoverage = new Set(metrics.map((metric) => metric.layer)).size / 5 * 100;
  const declarationCoverage = declaredMetrics / Math.max(5, metrics.length) * 100;
  const metricReadiness = clamp(declarationCoverage * 0.7 + layerCoverage * 0.3);

  const runtimeSignals = result.signals.filter((signal) => signal.startsWith("runtime:"));
  const executionSignals = result.signals.filter((signal) => signal.startsWith("execution:"));
  const observabilitySignals = result.signals.filter((signal) => signal.startsWith("observability:"));
  const telemetryReadiness = clamp(
    (observabilitySignals.includes("observability:telemetry") ? 45 : 0) +
      Math.min(32, executionSignals.length * 8) +
      (runtimeSignals.some((signal) => /docker|managed-worker|remote-exec/.test(signal)) ? 10 : 0) +
      (runtimeSignals.includes("runtime:config-env") ? 5 : 0) +
      (result.signals.includes("discovery:capabilities") ? 8 : 0),
  );

  const purposeConfidence = clamp(
    (confidence(result, "role", 30) +
      confidence(result, "shouldDo", 25) +
      confidence(result, "shouldNotDo", 25) +
      confidence(result, "autonomyLevel", 30)) / 4,
  );
  const codeConfidence = clamp(result.draft.confidence);
  const score = clamp(
    codeConfidence * 0.3 +
      purposeConfidence * 0.25 +
      telemetryReadiness * 0.25 +
      metricReadiness * 0.2,
  );

  const gaps: FastAssessmentGap[] = [];
  if (!result.platform) gaps.push("framework");
  if (runtimeSignals.length === 0) gaps.push("runtime");
  if (!observabilitySignals.includes("observability:telemetry")) gaps.push("telemetry");
  if (declaredMetrics < 3) gaps.push("metrics");
  if (confidence(result, "shouldDo") < 60 || confidence(result, "role") < 55) gaps.push("purpose");
  if (confidence(result, "shouldNotDo") < 60 || confidence(result, "autonomyLevel") < 55) gaps.push("governance");

  const status = score >= 72 && telemetryReadiness >= 55 && metricReadiness >= 45
    ? "ready"
    : score >= 45
      ? "review"
      : "blocked";

  return {
    score,
    status,
    codeConfidence,
    purposeConfidence,
    telemetryReadiness,
    metricReadiness,
    declaredMetrics,
    suggestedMetrics,
    runtimeSignals,
    executionSignals,
    observabilitySignals,
    gaps,
  };
}
