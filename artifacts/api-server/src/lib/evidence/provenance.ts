import type {
  EvidenceClassificationInput,
  EvidenceKind,
  EvidenceLineageStep,
  EvidenceQualityFlag,
  EvidenceSource,
  EvidenceSourceType,
  LineageStage,
  MetricEvidence,
  MetricEvidenceCandidate,
} from "./types";

const OBSERVED_SOURCES = new Set<EvidenceSourceType>([
  "telemetry",
  "connector",
  "human_review",
  "manual_entry",
]);

const SYNTHETIC_SOURCES = new Set<EvidenceSourceType>([
  "simulation",
  "seed",
]);

const SOURCE_TYPES = new Set<EvidenceSourceType>([
  "telemetry",
  "connector",
  "human_review",
  "manual_entry",
  "model_inference",
  "heuristic",
  "derived_calculation",
  "simulation",
  "seed",
  "unknown",
]);

const LINEAGE_STAGES = new Set<LineageStage>([
  "source",
  "filter",
  "aggregate",
  "transform",
  "model",
  "review",
]);

function isEvidenceKind(value: string | undefined): value is EvidenceKind {
  return value === "observed" || value === "inferred" || value === "synthetic";
}

function isSourceType(value: string | undefined): value is EvidenceSourceType {
  return value !== undefined && SOURCE_TYPES.has(value as EvidenceSourceType);
}

function isLineageStage(value: string | undefined): value is LineageStage {
  return value !== undefined && LINEAGE_STAGES.has(value as LineageStage);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function defaultConfidence(kind: EvidenceKind): number {
  if (kind === "observed") return 70;
  if (kind === "inferred") return 45;
  return 20;
}

function normalizeTimestamp(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("capturedAt deve ser uma data válida");
  return date.toISOString();
}

function normalizeMetricKey(candidate: MetricEvidenceCandidate): string {
  const raw = candidate.metricKey ?? candidate.key ?? candidate.sourceSignal;
  if (raw?.trim()) return raw.trim();
  const generated = candidate.label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (!generated) throw new Error("A métrica precisa de uma chave ou label válida");
  return generated;
}

function normalizeSource(input: MetricEvidenceCandidate["source"]): EvidenceSource {
  const type = isSourceType(input?.type) ? input.type : "unknown";
  const name = input?.name?.trim() || "Fonte não informada";
  const normalized: EvidenceSource = { type, name };
  if (input?.ref?.trim()) normalized.ref = input.ref.trim();
  if (input?.collectedAt) normalized.collectedAt = normalizeTimestamp(input.collectedAt) ?? undefined;
  return normalized;
}

function normalizeLineage(
  input: MetricEvidenceCandidate["lineage"],
): { lineage: EvidenceLineageStep[]; invalid: boolean } {
  if (!input || input.length === 0) return { lineage: [], invalid: false };
  let invalid = false;
  const lineage = input.flatMap((step) => {
    if (!isLineageStage(step.stage) || !step.name?.trim()) {
      invalid = true;
      return [];
    }
    const normalized: EvidenceLineageStep = {
      stage: step.stage,
      name: step.name.trim(),
    };
    if (step.ref?.trim()) normalized.ref = step.ref.trim();
    if (step.inputRefs?.length) normalized.inputRefs = [...step.inputRefs];
    return [normalized];
  });
  return { lineage, invalid };
}

export function classifyEvidenceKind(input: EvidenceClassificationInput): EvidenceKind {
  if (isEvidenceKind(input.explicitKind)) return input.explicitKind;
  if (OBSERVED_SOURCES.has(input.sourceType)) return "observed";
  if (SYNTHETIC_SOURCES.has(input.sourceType)) return "synthetic";
  return "inferred";
}

export function loadMetricEvidence(candidate: MetricEvidenceCandidate): MetricEvidence {
  if (!candidate.label?.trim()) throw new Error("A métrica precisa de um label");
  if (!Number.isFinite(candidate.value)) throw new Error("O valor da métrica precisa ser finito");
  if (!candidate.unit?.trim()) throw new Error("A métrica precisa de uma unidade");

  const source = normalizeSource(candidate.source);
  const normalizedLineage = normalizeLineage(candidate.lineage);
  const kind = classifyEvidenceKind({
    explicitKind: candidate.evidenceKind ?? candidate.kind,
    sourceType: source.type,
  });
  const confidence = clampConfidence(candidate.confidence ?? defaultConfidence(kind));
  const qualityFlags: EvidenceQualityFlag[] = [];

  if (source.type === "unknown") qualityFlags.push("missing_source");
  if (normalizedLineage.lineage.length === 0 || normalizedLineage.invalid) {
    qualityFlags.push("missing_lineage");
  }
  const capturedAt = normalizeTimestamp(candidate.capturedAt);
  if (!capturedAt) qualityFlags.push("missing_timestamp");
  if (confidence < 50) qualityFlags.push("low_confidence");
  if (kind === "inferred") qualityFlags.push("inferred_value");
  if (kind === "synthetic") qualityFlags.push("synthetic_value");

  return {
    metricKey: normalizeMetricKey(candidate),
    label: candidate.label.trim(),
    value: candidate.value,
    unit: candidate.unit.trim(),
    capturedAt,
    kind,
    source,
    lineage: normalizedLineage.lineage,
    confidence,
    sampleSize: candidate.sampleSize,
    qualityFlags,
  };
}

