export interface RepeatedStepObservation {
  stepKey: string;
  inputFingerprint: string;
  outputHash: string;
  path: "model" | "code" | "human";
  shadow: boolean;
  costCents: number | null;
  currency: string | null;
}

export interface RepeatedStepDetectorInput {
  observations: ReadonlyArray<RepeatedStepObservation>;
}

export interface RepeatedStepRecommendation {
  action: "distill_step";
  label: "Certificar como código";
}

export interface RepeatedStepCandidate {
  stepKey: string;
  currency: string;
  sampleSize: number;
  totalCostCents: number;
  dominantOutputRate: number;
  costShare: number;
  eligible: boolean;
  reasons: Array<"minimum_sample" | "dominant_output_rate" | "cost_share">;
  recommendation: RepeatedStepRecommendation | null;
}

const DETECTOR_POLICY = {
  minSamples: 200,
  minDominantOutputRate: 0.98,
  minCostShare: 0.2,
};

export function detectRepeatedSteps(
  input: RepeatedStepDetectorInput,
): RepeatedStepCandidate[] {
  const observations = input.observations.filter(
    (observation) =>
      observation.path !== "human" &&
      !observation.shadow &&
      observation.currency !== null &&
      observation.currency.trim().length > 0 &&
      observation.costCents !== null &&
      Number.isFinite(observation.costCents) &&
      observation.costCents >= 0,
  );
  const totalCostByCurrency = new Map<string, number>();
  const groups = new Map<string, RepeatedStepObservation[]>();

  for (const observation of observations) {
    const currency = observation.currency!;
    totalCostByCurrency.set(
      currency,
      (totalCostByCurrency.get(currency) ?? 0) + observation.costCents!,
    );
    const groupKey = `${currency}\u0000${observation.stepKey}`;
    const group = groups.get(groupKey) ?? [];
    group.push(observation);
    groups.set(groupKey, group);
  }

  return Array.from(groups.values(), (group) => {
    const first = group[0]!;
    const currency = first.currency!;
    const sampleSize = group.length;
    const totalCostCents = group.reduce(
      (sum, observation) => sum + observation.costCents!,
      0,
    );
    const modalCountsByInput = new Map<string, Map<string, number>>();
    for (const observation of group) {
      const counts =
        modalCountsByInput.get(observation.inputFingerprint) ??
        new Map<string, number>();
      counts.set(
        observation.outputHash,
        (counts.get(observation.outputHash) ?? 0) + 1,
      );
      modalCountsByInput.set(observation.inputFingerprint, counts);
    }
    const dominantCount = Array.from(modalCountsByInput.values()).reduce(
      (sum, outputCounts) => sum + Math.max(...outputCounts.values()),
      0,
    );
    const dominantOutputRate = dominantCount / sampleSize;
    const totalCostForCurrency = totalCostByCurrency.get(currency) ?? 0;
    const costShare = Number.isFinite(totalCostForCurrency) && totalCostForCurrency > 0
      ? totalCostCents / totalCostForCurrency
      : 0;
    const reasons: RepeatedStepCandidate["reasons"] = [];
    if (sampleSize < DETECTOR_POLICY.minSamples) reasons.push("minimum_sample");
    if (dominantOutputRate < DETECTOR_POLICY.minDominantOutputRate)
      reasons.push("dominant_output_rate");
    if (costShare < DETECTOR_POLICY.minCostShare) reasons.push("cost_share");
    const eligible = reasons.length === 0;

    return {
      stepKey: first.stepKey,
      currency,
      sampleSize,
      totalCostCents,
      dominantOutputRate,
      costShare,
      eligible,
      reasons,
      recommendation: eligible
        ? ({
            action: "distill_step",
            label: "Certificar como código",
          } satisfies RepeatedStepRecommendation)
        : null,
    };
  }).sort(
    (left, right) =>
      right.totalCostCents - left.totalCostCents ||
      left.stepKey.localeCompare(right.stepKey),
  );
}
