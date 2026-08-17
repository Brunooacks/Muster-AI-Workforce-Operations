import type { KpiLayer } from "@workspace/db";
import type { MetricEvidence } from "./evidence/types";
import type { ProposedMetric } from "./discovery";

type StoredKpiMetric = KpiLayer["metrics"][number] & {
  sourceSignal?: string;
  contractKey?: string;
  evidence?: MetricEvidence;
  baselineAvailable?: boolean;
};

export function hasDeclaredBaseline(businessCase: unknown): boolean {
  if (!businessCase || typeof businessCase !== "object") return false;
  const baseline = (businessCase as { baseline?: unknown }).baseline;
  return typeof baseline === "string" && baseline.trim().length > 0;
}

/** Rehydrate stored KPI JSON without requiring a database connection. */
export function metricsFromLayers(layers: KpiLayer[]): ProposedMetric[] {
  const metrics: ProposedMetric[] = [];
  for (const layer of layers) {
    for (const metric of layer.metrics) {
      const stored = metric as StoredKpiMetric;
      metrics.push({
        layer: layer.key,
        label: metric.label,
        sourceSignal: stored.sourceSignal ?? metric.label,
        value: metric.value,
        unit: metric.unit,
        confidence: 0,
        ...(metric.target ? { target: metric.target } : {}),
        ...(metric.rationale ? { rationale: metric.rationale } : {}),
        ...(stored.contractKey ? { contractKey: stored.contractKey } : {}),
        ...(stored.evidence ? { evidence: stored.evidence } : {}),
        ...(stored.baselineAvailable !== undefined
          ? { baselineAvailable: stored.baselineAvailable }
          : {}),
      });
    }
  }
  return metrics;
}
