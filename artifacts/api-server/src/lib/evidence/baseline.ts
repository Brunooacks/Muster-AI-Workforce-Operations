import type { EvidenceKind, MetricEvidence } from "./types";

export type BaselineWindowKind = "before" | "after";
export type BaselineWindowStatus = "ready" | "pending";
export type BaselineComparisonStatus =
  | "improved"
  | "declined"
  | "stable"
  | "insufficient_evidence"
  | "not_comparable";

export type BaselineComparisonReason = "zero_baseline";

export interface BaselineWindowPlan {
  kind: BaselineWindowKind;
  from: string;
  to: string;
  durationDays: number;
  status: BaselineWindowStatus;
}

export interface BaselinePlan {
  metricKey: string;
  interventionAt: string;
  before: BaselineWindowPlan;
  after: BaselineWindowPlan;
}

export interface BaselineSummary {
  sampleSize: number;
  mean: number | null;
  confidence: number;
  kinds: EvidenceKind[];
}

export interface BeforeAfterComparison {
  metricKey: string;
  unit: string;
  direction: "higher_is_better" | "lower_is_better";
  status: BaselineComparisonStatus;
  before: BaselineSummary;
  after: BaselineSummary;
  delta: number | null;
  deltaPercent: number | null;
  confidence: number;
  reason?: BaselineComparisonReason;
}

export interface BaselineComparisonOptions {
  direction?: "higher_is_better" | "lower_is_better";
  minimumSampleSize?: number;
  stabilityThresholdPercent?: number;
}

function asDate(value: string | Date, field: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} deve ser uma data válida`);
  return date;
}

function iso(value: Date): string {
  return value.toISOString();
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function summarize(values: MetricEvidence[]): BaselineSummary {
  if (values.length === 0) {
    return { sampleSize: 0, mean: null, confidence: 0, kinds: [] };
  }
  const mean = values.reduce((sum, item) => sum + item.value, 0) / values.length;
  const confidence = values.reduce((sum, item) => sum + item.confidence, 0) / values.length;
  const kinds = [...new Set(values.map((item) => item.kind))];
  return {
    sampleSize: values.length,
    mean: round(mean),
    confidence: round(confidence),
    kinds,
  };
}

export function prepareBaselinePlan(input: {
  metricKey: string;
  interventionAt: string | Date;
  beforeDays?: number;
  afterDays?: number;
}): BaselinePlan {
  const beforeDays = input.beforeDays ?? 14;
  const afterDays = input.afterDays ?? 14;
  if (!Number.isInteger(beforeDays) || beforeDays < 1) {
    throw new Error("beforeDays deve ser um inteiro positivo");
  }
  if (!Number.isInteger(afterDays) || afterDays < 1) {
    throw new Error("afterDays deve ser um inteiro positivo");
  }
  if (!input.metricKey.trim()) throw new Error("metricKey é obrigatório");

  const interventionAt = asDate(input.interventionAt, "interventionAt");
  return {
    metricKey: input.metricKey.trim(),
    interventionAt: iso(interventionAt),
    before: {
      kind: "before",
      from: iso(addDays(interventionAt, -beforeDays)),
      to: iso(interventionAt),
      durationDays: beforeDays,
      status: "ready",
    },
    after: {
      kind: "after",
      from: iso(interventionAt),
      to: iso(addDays(interventionAt, afterDays)),
      durationDays: afterDays,
      status: "pending",
    },
  };
}

export function compareBeforeAfter(
  before: MetricEvidence[],
  after: MetricEvidence[],
  options: BaselineComparisonOptions = {},
): BeforeAfterComparison {
  const samples = [...before, ...after];
  const first = samples[0];
  if (!first) {
    return {
      metricKey: "",
      unit: "",
      direction: options.direction ?? "higher_is_better",
      status: "insufficient_evidence",
      before: summarize([]),
      after: summarize([]),
      delta: null,
      deltaPercent: null,
      confidence: 0,
    };
  }
  if (samples.some((item) => item.metricKey !== first.metricKey || item.unit !== first.unit)) {
    throw new Error("As evidências precisam usar a mesma métrica e unidade");
  }

  const direction = options.direction ?? "higher_is_better";
  const minimumSampleSize = options.minimumSampleSize ?? 1;
  const stabilityThresholdPercent = options.stabilityThresholdPercent ?? 5;
  const beforeSummary = summarize(before);
  const afterSummary = summarize(after);
  const delta =
    beforeSummary.mean === null || afterSummary.mean === null
      ? null
      : round(afterSummary.mean - beforeSummary.mean);
  const deltaPercent =
    delta === null || beforeSummary.mean === null || beforeSummary.mean === 0
      ? null
      : round((delta / Math.abs(beforeSummary.mean)) * 100);
  const confidence = round((beforeSummary.confidence + afterSummary.confidence) / 2);

  if (
    beforeSummary.sampleSize < minimumSampleSize ||
    afterSummary.sampleSize < minimumSampleSize ||
    delta === null
  ) {
    return {
      metricKey: first.metricKey,
      unit: first.unit,
      direction,
      status: "insufficient_evidence",
      before: beforeSummary,
      after: afterSummary,
      delta,
      deltaPercent,
      confidence,
    };
  }

  if (beforeSummary.mean === 0) {
    if (afterSummary.mean === 0) {
      return {
        metricKey: first.metricKey,
        unit: first.unit,
        direction,
        status: "stable",
        before: beforeSummary,
        after: afterSummary,
        delta: 0,
        deltaPercent: 0,
        confidence,
      };
    }

    return {
      metricKey: first.metricKey,
      unit: first.unit,
      direction,
      status: "insufficient_evidence",
      before: beforeSummary,
      after: afterSummary,
      delta,
      deltaPercent: null,
      confidence,
      reason: "zero_baseline",
    };
  }

  const magnitude = Math.abs(deltaPercent ?? 0);
  const status: BaselineComparisonStatus =
    magnitude <= stabilityThresholdPercent
      ? "stable"
      : direction === "higher_is_better"
        ? delta > 0
          ? "improved"
          : "declined"
        : delta < 0
          ? "improved"
          : "declined";

  return {
    metricKey: first.metricKey,
    unit: first.unit,
    direction,
    status,
    before: beforeSummary,
    after: afterSummary,
    delta,
    deltaPercent,
    confidence,
  };
}

