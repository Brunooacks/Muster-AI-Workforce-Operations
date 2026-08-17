import { describe, expect, it } from "vitest";
import {
  noEvidenceEvaluation,
  seededEvaluationsAllowed,
} from "./evaluation-policy";

describe("seededEvaluationsAllowed", () => {
  it("keeps seeded evaluations disabled by default", () => {
    expect(seededEvaluationsAllowed({ NODE_ENV: "development" })).toBe(false);
  });

  it("allows an explicit non-production demo flag", () => {
    expect(
      seededEvaluationsAllowed({
        NODE_ENV: "development",
        ALLOW_SEEDED_EVALUATIONS: "true",
      }),
    ).toBe(true);
  });

  it("ignores the demo flag in production", () => {
    expect(
      seededEvaluationsAllowed({
        NODE_ENV: "production",
        ALLOW_SEEDED_EVALUATIONS: "true",
      }),
    ).toBe(false);
  });
});

describe("noEvidenceEvaluation", () => {
  it("returns five empty layers without an invented score", () => {
    const evaluation = noEvidenceEvaluation();

    expect(evaluation.healthScore).toBe(0);
    expect(evaluation.verdict).toBe("observation");
    expect(evaluation.verdictConfidence).toBe(0);
    expect(evaluation.layers).toHaveLength(5);
    expect(
      evaluation.layers.every(
        (layer) => layer.score === 0 && layer.metrics.length === 0,
      ),
    ).toBe(true);
  });
});
