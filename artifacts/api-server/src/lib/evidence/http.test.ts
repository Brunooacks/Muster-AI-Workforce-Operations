import { describe, expect, it } from "vitest";
import { loadMetricEvidence } from "./provenance";

describe("persisted metric evidence contract", () => {
  it("normalizes the payload that the POST route persists", () => {
    const evidence = loadMetricEvidence({
      metricKey: " atendimento-fcr ",
      label: " FCR ",
      value: 82.5,
      unit: "%",
      kind: "observed",
      source: { type: "telemetry", name: "runtime-events", ref: "run-42" },
      lineage: [{ stage: "aggregate", name: "weekly-fcr" }],
      confidence: 96,
      sampleSize: 120,
      capturedAt: "2026-08-11T20:00:00-03:00",
    });

    expect(evidence).toMatchObject({
      metricKey: "atendimento-fcr",
      label: "FCR",
      value: 82.5,
      kind: "observed",
      confidence: 96,
      sampleSize: 120,
      capturedAt: "2026-08-11T23:00:00.000Z",
      qualityFlags: [],
    });
  });

  it("keeps quality flags for incomplete but persistable evidence", () => {
    const evidence = loadMetricEvidence({
      metricKey: "conversion",
      label: "Conversão",
      value: 0.4,
      unit: "%",
      source: { type: "model_inference", name: "evaluator" },
      confidence: 40,
    });

    expect(evidence.kind).toBe("inferred");
    expect(evidence.qualityFlags).toEqual([
      "missing_lineage",
      "missing_timestamp",
      "low_confidence",
      "inferred_value",
    ]);
  });
});
