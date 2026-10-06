import type { LayerKey } from "@workspace/db";
import type {
  KpiFreshnessPolicy,
  KpiMetricDirection,
} from "./kpi-contract";

const clampScore = (value: number): number =>
  Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export type FreshnessStatus = "fresh" | "aging" | "stale" | "expired" | "missing";

export interface FreshnessAssessment {
  status: FreshnessStatus;
  ageMinutes: number | null;
  score: number;
  decisionEligible: boolean;
}

export function assessFreshness(
  observedAt: Date | string | null | undefined,
  now: Date,
  policy: KpiFreshnessPolicy,
): FreshnessAssessment {
  if (!observedAt) {
    return { status: "missing", ageMinutes: null, score: 0, decisionEligible: false };
  }

  const observedTimestamp = new Date(observedAt).getTime();
  if (!Number.isFinite(observedTimestamp)) {
    return { status: "missing", ageMinutes: null, score: 0, decisionEligible: false };
  }

  const ageMinutes = Math.max(0, (now.getTime() - observedTimestamp) / 60_000);
  if (ageMinutes <= policy.expectedWithinMinutes) {
    return { status: "fresh", ageMinutes: round1(ageMinutes), score: 100, decisionEligible: true };
  }
  if (ageMinutes <= policy.staleAfterMinutes) {
    const progress =
      (ageMinutes - policy.expectedWithinMinutes) /
      Math.max(1, policy.staleAfterMinutes - policy.expectedWithinMinutes);
    return {
      status: "aging",
      ageMinutes: round1(ageMinutes),
      score: clampScore(100 - progress * 25),
      decisionEligible: true,
    };
  }
  if (ageMinutes <= policy.expiresAfterMinutes) {
    const progress =
      (ageMinutes - policy.staleAfterMinutes) /
      Math.max(1, policy.expiresAfterMinutes - policy.staleAfterMinutes);
    return {
      status: "stale",
      ageMinutes: round1(ageMinutes),
      score: clampScore(75 - progress * 50),
      decisionEligible: false,
    };
  }
  return { status: "expired", ageMinutes: round1(ageMinutes), score: 0, decisionEligible: false };
}

export type ConfidenceBand = "insufficient" | "indicative" | "reliable" | "decision-grade";

export interface ConfidenceAssessment {
  band: ConfidenceBand;
  score: number;
  decisionEligible: boolean;
}

export function classifyConfidence(
  confidence: number,
  policy: { minimum: number; decisionGrade: number } = { minimum: 70, decisionGrade: 90 },
): ConfidenceAssessment {
  const score = clampScore(confidence);
  if (score < policy.minimum) return { band: "insufficient", score, decisionEligible: false };
  if (score < Math.min(policy.decisionGrade, policy.minimum + 10)) {
    return { band: "indicative", score, decisionEligible: false };
  }
  if (score < policy.decisionGrade) return { band: "reliable", score, decisionEligible: true };
  return { band: "decision-grade", score, decisionEligible: true };
}

const DEFAULT_LAYER_WEIGHTS: Record<LayerKey, number> = {
  efficacy: 0.25,
  efficiency: 0.15,
  adoption: 0.15,
  governance: 0.25,
  value: 0.2,
};

export interface OperationalScoreInput {
  layers: Partial<Record<LayerKey, number>>;
  freshnessScore: number;
  confidence: number;
  guardrailBreached?: boolean;
  weights?: Partial<Record<LayerKey, number>>;
}

export interface OperationalScore {
  score: number;
  baseScore: number;
  evidenceModifier: number;
  layerCoverage: number;
  band: "critical" | "at-risk" | "controlled" | "excellent";
  decisionEligible: boolean;
  reasons: string[];
}

export function calculateOperationalScore(input: OperationalScoreInput): OperationalScore {
  const weights = { ...DEFAULT_LAYER_WEIGHTS, ...input.weights };
  const entries = Object.entries(input.layers).filter(
    (entry): entry is [LayerKey, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  const totalWeight = entries.reduce((sum, [key]) => sum + Math.max(0, weights[key]), 0);
  const weightedScore = entries.reduce(
    (sum, [key, value]) => sum + clampScore(value) * Math.max(0, weights[key]),
    0,
  );
  const baseScore = totalWeight > 0 ? clampScore(weightedScore / totalWeight) : 0;
  const layerCoverage = clampScore((entries.length / Object.keys(DEFAULT_LAYER_WEIGHTS).length) * 100);
  const evidenceModifier = clampScore(
    60 + clampScore(input.freshnessScore) * 0.2 + clampScore(input.confidence) * 0.2,
  );
  let score = clampScore(baseScore * (evidenceModifier / 100));
  const reasons: string[] = [];

  if (layerCoverage < 100) reasons.push("camadas operacionais incompletas");
  if (input.freshnessScore < 50) reasons.push("dados desatualizados");
  if (input.confidence < 70) reasons.push("confiança insuficiente");
  if (input.guardrailBreached) {
    score = Math.min(score, 49);
    reasons.push("guardrail violado");
  }

  const band = score < 50 ? "critical" : score < 65 ? "at-risk" : score < 85 ? "controlled" : "excellent";
  return {
    score,
    baseScore,
    evidenceModifier,
    layerCoverage,
    band,
    decisionEligible:
      !input.guardrailBreached && layerCoverage === 100 && input.freshnessScore >= 50 && input.confidence >= 70,
    reasons,
  };
}

export interface MetricSeriesPoint {
  value: number;
  observedAt: Date | string;
}

export interface TrendAssessment {
  trend: "improving" | "stable" | "degrading" | "insufficient-data";
  anomaly: "spike" | "drop" | "none" | "insufficient-data";
  relativeChangePercent: number | null;
  latestZScore: number | null;
  pointsAnalyzed: number;
  reason?: "zero_baseline";
  absoluteChange?: number;
}

export function analyzeTrendAndAnomaly(
  points: MetricSeriesPoint[],
  direction: KpiMetricDirection,
): TrendAssessment {
  const ordered = points
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(new Date(point.observedAt).getTime()))
    .sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime());

  if (ordered.length < 3) {
    return {
      trend: "insufficient-data",
      anomaly: "insufficient-data",
      relativeChangePercent: null,
      latestZScore: null,
      pointsAnalyzed: ordered.length,
    };
  }

  const splitAt = Math.floor(ordered.length / 2);
  const early = ordered.slice(0, splitAt);
  const recent = ordered.slice(splitAt);
  const average = (values: MetricSeriesPoint[]) =>
    values.reduce((sum, point) => sum + point.value, 0) / values.length;
  const earlyAverage = average(early);
  const recentAverage = average(recent);
  const rawRelativeChange = (recentAverage - earlyAverage) / Math.max(1, Math.abs(earlyAverage));
  const adjustedChange = direction === "lower-is-better" ? -rawRelativeChange : rawRelativeChange;
  const trend =
    direction === "informational" || direction === "target-range"
      ? "stable"
      : adjustedChange > 0.03
        ? "improving"
        : adjustedChange < -0.03
          ? "degrading"
          : "stable";

  const history = ordered.slice(0, -1).map((point) => point.value);
  const latest = ordered[ordered.length - 1]!.value;
  const historicalMean = history.reduce((sum, value) => sum + value, 0) / history.length;
  const variance = history.reduce((sum, value) => sum + (value - historicalMean) ** 2, 0) / history.length;
  const standardDeviation = Math.sqrt(variance);
  const latestZScore =
    standardDeviation > 0
      ? (latest - historicalMean) / standardDeviation
      : latest === historicalMean
        ? 0
        : latest > historicalMean
          ? 10
          : -10;
  const anomaly = latestZScore >= 2.5 ? "spike" : latestZScore <= -2.5 ? "drop" : "none";

  if (earlyAverage === 0) {
    // Base inicial zero: não existe variação relativa honesta. Séries sem direção
    // (informational/target-range) continuam "stable", como no caminho normal.
    const alsoZero = recentAverage === 0;
    const directionless =
      direction === "informational" || direction === "target-range";
    return {
      trend: alsoZero || directionless ? "stable" : "insufficient-data",
      anomaly,
      relativeChangePercent: alsoZero ? 0 : null,
      latestZScore: Math.round(latestZScore * 10) / 10,
      pointsAnalyzed: ordered.length,
      ...(alsoZero
        ? {}
        : {
            reason: "zero_baseline" as const,
            absoluteChange: round1(recentAverage - earlyAverage),
          }),
    };
  }

  return {
    trend,
    anomaly,
    relativeChangePercent: Math.round(rawRelativeChange * 1_000) / 10,
    latestZScore: Math.round(latestZScore * 10) / 10,
    pointsAnalyzed: ordered.length,
  };
}

export type InsightSeverity = "critical" | "high" | "medium" | "low";
export type InsightPriority = "now" | "next" | "watch";

export interface OperationalInsightCandidate {
  id: string;
  entityId: string;
  entityName: string;
  category: string;
  title: string;
  explanation: string;
  recommendation: string;
  severity: InsightSeverity;
  impact: number;
  confidence: number;
  freshness: FreshnessStatus;
  guardrail: boolean;
  affectedExecutions?: number;
  slaRisk?: boolean;
}

export interface PrioritizedOperationalInsight extends OperationalInsightCandidate {
  priorityScore: number;
  priority: InsightPriority;
  dueWithinMinutes: number;
}

const SEVERITY_WEIGHT: Record<InsightSeverity, number> = {
  critical: 45,
  high: 32,
  medium: 20,
  low: 8,
};

export function prioritizeOperationalInsights(
  candidates: OperationalInsightCandidate[],
): PrioritizedOperationalInsight[] {
  return candidates
    .map((candidate) => {
      const freshnessRisk =
        candidate.freshness === "expired" || candidate.freshness === "missing"
          ? 12
          : candidate.freshness === "stale"
            ? 8
            : candidate.freshness === "aging"
              ? 3
              : 0;
      const volumeRisk = Math.min(10, Math.log10(Math.max(1, candidate.affectedExecutions ?? 1)) * 3);
      const score = clampScore(
        SEVERITY_WEIGHT[candidate.severity] +
          clampScore(candidate.impact) * 0.2 +
          clampScore(candidate.confidence) * 0.1 +
          freshnessRisk +
          volumeRisk +
          (candidate.guardrail ? 12 : 0) +
          (candidate.slaRisk ? 8 : 0),
      );
      const priority = score >= 75 ? "now" : score >= 50 ? "next" : "watch";
      return {
        ...candidate,
        priorityScore: score,
        priority,
        dueWithinMinutes: priority === "now" ? 60 : priority === "next" ? 1_440 : 10_080,
      } satisfies PrioritizedOperationalInsight;
    })
    .sort((left, right) => right.priorityScore - left.priorityScore || left.id.localeCompare(right.id));
}
