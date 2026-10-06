import { describe, expect, it } from "vitest";
import {
  classifyEvidenceKind,
  compareBeforeAfter,
  loadMetricEvidence,
  prepareBaselinePlan,
  type MetricEvidence,
} from ".";

function evidence(value: number, capturedAt: string, confidence = 90): MetricEvidence {
  return loadMetricEvidence({
    metricKey: "resolution_rate",
    label: "Taxa de resolução",
    value,
    unit: "%",
    capturedAt,
    confidence,
    source: { type: "telemetry", name: "runner local", ref: "run-1" },
    lineage: [{ stage: "source", name: "execution events", ref: "events-1" }],
  });
}

describe("evidence provenance", () => {
  it("classifica fontes observadas, inferidas e sintéticas", () => {
    expect(classifyEvidenceKind({ sourceType: "telemetry" })).toBe("observed");
    expect(classifyEvidenceKind({ sourceType: "model_inference" })).toBe("inferred");
    expect(classifyEvidenceKind({ sourceType: "simulation" })).toBe("synthetic");
  });

  it("normaliza source, lineage e confidence sem inventar evidência ausente", () => {
    const metric = loadMetricEvidence({
      sourceSignal: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.82,
      unit: "%",
      confidence: 120,
      source: { type: "model_inference", name: "avaliador" },
      lineage: [{ stage: "model", name: "judge-v1", ref: "eval-1" }],
    });

    expect(metric.metricKey).toBe("resolution_rate");
    expect(metric.kind).toBe("inferred");
    expect(metric.confidence).toBe(100);
    expect(metric.source.name).toBe("avaliador");
    expect(metric.lineage[0]?.ref).toBe("eval-1");
    expect(metric.qualityFlags).toEqual(
      expect.arrayContaining(["missing_timestamp", "inferred_value"]),
    );
  });
});

describe("baseline before/after", () => {
  it("prepara janelas contíguas antes e depois da intervenção", () => {
    const plan = prepareBaselinePlan({
      metricKey: "resolution_rate",
      interventionAt: "2026-08-10T00:00:00Z",
      beforeDays: 7,
      afterDays: 14,
    });

    expect(plan.before).toMatchObject({
      from: "2026-08-03T00:00:00.000Z",
      to: "2026-08-10T00:00:00.000Z",
      status: "ready",
    });
    expect(plan.after).toMatchObject({
      from: "2026-08-10T00:00:00.000Z",
      to: "2026-08-24T00:00:00.000Z",
      status: "pending",
    });
  });

  it("compara resultado antes/depois respeitando a direção do KPI", () => {
    const result = compareBeforeAfter(
      [evidence(70, "2026-08-01T00:00:00Z"), evidence(72, "2026-08-02T00:00:00Z")],
      [evidence(80, "2026-08-11T00:00:00Z"), evidence(82, "2026-08-12T00:00:00Z")],
      { direction: "higher_is_better", minimumSampleSize: 2 },
    );

    expect(result).toMatchObject({
      metricKey: "resolution_rate",
      status: "improved",
      delta: 10,
      deltaPercent: 14.085,
      confidence: 90,
    });
  });

  it("não declara resultado quando falta amostra no pós-intervenção", () => {
    const result = compareBeforeAfter(
      [evidence(70, "2026-08-01T00:00:00Z")],
      [],
      { minimumSampleSize: 2 },
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.delta).toBeNull();
  });

  it("não inventa percentual relativo quando a média antes é zero", () => {
    const result = compareBeforeAfter(
      [evidence(0, "2026-08-01T00:00:00Z")],
      [evidence(40, "2026-08-11T00:00:00Z")],
    );

    expect(result).toMatchObject({
      status: "insufficient_evidence",
      reason: "zero_baseline",
      delta: 40,
      deltaPercent: null,
    });
  });

  it("declara stable quando antes e depois são zero", () => {
    const result = compareBeforeAfter(
      [evidence(0, "2026-08-01T00:00:00Z")],
      [evidence(0, "2026-08-11T00:00:00Z")],
    );

    expect(result).toMatchObject({
      status: "stable",
      delta: 0,
      deltaPercent: 0,
    });
    expect(result.reason).toBeUndefined();
  });

  it("mantém zero_baseline em lower_is_better porque a direção não muda o denominador", () => {
    const result = compareBeforeAfter(
      [evidence(0, "2026-08-01T00:00:00Z")],
      [evidence(40, "2026-08-11T00:00:00Z")],
      { direction: "lower_is_better" },
    );

    expect(result).toMatchObject({
      status: "insufficient_evidence",
      reason: "zero_baseline",
      delta: 40,
      deltaPercent: null,
    });
  });

  it("calcula percentual normal quando a média antes é negativa", () => {
    const result = compareBeforeAfter(
      [evidence(-10, "2026-08-01T00:00:00Z")],
      [evidence(0, "2026-08-11T00:00:00Z")],
      { direction: "higher_is_better" },
    );

    expect(result).toMatchObject({
      status: "improved",
      delta: 10,
      deltaPercent: 100,
    });
    expect(result.reason).toBeUndefined();
  });

  it("prioriza a amostra vazia sobre o zero na média antes", () => {
    const result = compareBeforeAfter(
      [
        evidence(0, "2026-08-01T00:00:00Z"),
        evidence(0, "2026-08-02T00:00:00Z"),
      ],
      [],
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.delta).toBeNull();
    expect(result.reason).toBeUndefined();
  });
});

