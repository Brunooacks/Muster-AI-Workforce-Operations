import type { ScoredEvaluation } from "./discovery";
import { LAYER_ORDER, layerLabel } from "./discovery";

type EvaluationEnvironment = {
  NODE_ENV?: string;
  ALLOW_SEEDED_EVALUATIONS?: string;
};

export function seededEvaluationsAllowed(
  environment: EvaluationEnvironment = process.env,
): boolean {
  if (environment.NODE_ENV === "production") return false;
  return environment.ALLOW_SEEDED_EVALUATIONS === "true";
}

export function noEvidenceEvaluation(): ScoredEvaluation {
  return {
    layers: LAYER_ORDER.map((key) => ({
      key,
      label: layerLabel(key),
      score: 0,
      severity: "critical",
      metrics: [],
    })),
    healthScore: 0,
    severity: "critical",
    verdict: "observation",
    verdictConfidence: 0,
    evidence: {
      insufficientEvidence: 0,
      notComparable: 0,
      comparable: 0,
    },
  };
}
