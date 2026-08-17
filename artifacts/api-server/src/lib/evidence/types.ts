export type EvidenceKind = "observed" | "inferred" | "synthetic";

export type EvidenceSourceType =
  | "telemetry"
  | "connector"
  | "human_review"
  | "manual_entry"
  | "model_inference"
  | "heuristic"
  | "derived_calculation"
  | "simulation"
  | "seed"
  | "unknown";

export type LineageStage =
  | "source"
  | "filter"
  | "aggregate"
  | "transform"
  | "model"
  | "review";

export type EvidenceQualityFlag =
  | "missing_source"
  | "missing_lineage"
  | "missing_timestamp"
  | "low_confidence"
  | "inferred_value"
  | "synthetic_value";

export interface EvidenceSource {
  type: EvidenceSourceType;
  name: string;
  ref?: string;
  collectedAt?: string;
}

export interface EvidenceLineageStep {
  stage: LineageStage;
  name: string;
  ref?: string;
  inputRefs?: string[];
}

export interface MetricEvidence {
  id?: string;
  metricKey: string;
  label: string;
  agentId?: string | null;
  teamId?: string | null;
  purposeId?: string | null;
  value: number;
  unit: string;
  capturedAt: string | null;
  kind: EvidenceKind;
  source: EvidenceSource;
  lineage: EvidenceLineageStep[];
  confidence: number;
  sampleSize?: number;
  qualityFlags: EvidenceQualityFlag[];
}

export interface MetricEvidenceCandidate {
  metricKey?: string;
  key?: string;
  sourceSignal?: string;
  label: string;
  value: number;
  unit: string;
  capturedAt?: string | Date | null;
  evidenceKind?: string;
  kind?: string;
  source?: Partial<EvidenceSource>;
  lineage?: Array<Partial<EvidenceLineageStep>>;
  confidence?: number;
  sampleSize?: number;
}

export interface EvidenceClassificationInput {
  explicitKind?: string;
  sourceType: EvidenceSourceType;
}
