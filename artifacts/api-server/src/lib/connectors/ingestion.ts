import type { ExternalAgentObservation } from "./types";

export interface ExternalObservationInput {
  metricKey: string;
  label: string;
  value: number;
  unit: string;
  kind?: "observed" | "inferred" | "synthetic";
  confidence?: number;
  sampleSize?: number;
  capturedAt?: Date | string;
  lineage?: Array<{ stage: string; name: string; ref?: string }>;
}

export function normalizeExternalObservation(
  input: ExternalObservationInput,
  source: ExternalAgentObservation["source"],
): ExternalAgentObservation {
  const capturedAt = input.capturedAt
    ? new Date(input.capturedAt).toISOString()
    : new Date().toISOString();
  return {
    metricKey: input.metricKey,
    label: input.label,
    value: input.value,
    unit: input.unit,
    kind: input.kind ?? "observed",
    confidence: Math.max(0, Math.min(1, input.confidence ?? 1)),
    ...(input.sampleSize !== undefined ? { sampleSize: input.sampleSize } : {}),
    capturedAt,
    source,
    lineage: input.lineage ?? [{ stage: "source", name: "external_connector" }],
  };
}
