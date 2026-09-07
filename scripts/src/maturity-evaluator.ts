export type EvidenceStatus = "proven" | "partial" | "missing";

export type ReadinessStage =
  | "internal_only"
  | "design_partner"
  | "paid_pilot"
  | "limited_commercial"
  | "general_availability";

export interface EffortRange {
  min: number;
  max: number;
}

export interface ReadinessCheck {
  id: string;
  dimension: string;
  title: string;
  weight: number;
  status: EvidenceStatus;
  evidence: string[];
  gap: string;
  workstream: string;
  effortDays: EffortRange;
  criticalForPaidPilot: boolean;
  criticalForGeneralAvailability: boolean;
}

export interface DeliveryEstimate {
  personDays: EffortRange;
  parallelCalendarDays: EffortRange;
  workstreams: Array<{ name: string; effortDays: EffortRange }>;
}

export interface MaturityAssessment {
  score: number;
  stage: ReadinessStage;
  paidPilotReady: boolean;
  generalAvailabilityReady: boolean;
  paidPilotBlockers: ReadinessCheck[];
  generalAvailabilityBlockers: ReadinessCheck[];
  paidPilotEstimate: DeliveryEstimate;
  generalAvailabilityEstimate: DeliveryEstimate;
  checks: ReadinessCheck[];
}

const STATUS_FACTOR: Record<EvidenceStatus, number> = {
  proven: 1,
  partial: 0.55,
  missing: 0,
};

function remainingEffort(check: ReadinessCheck): EffortRange {
  if (check.status === "proven") return { min: 0, max: 0 };
  const factor = check.status === "partial" ? 0.6 : 1;
  return {
    min: Math.max(1, Math.ceil(check.effortDays.min * factor)),
    max: Math.max(1, Math.ceil(check.effortDays.max * factor)),
  };
}

export function estimateDelivery(
  checks: ReadinessCheck[],
  stabilizationDays: EffortRange,
): DeliveryEstimate {
  const byWorkstream = new Map<string, EffortRange>();
  for (const check of checks) {
    const effort = remainingEffort(check);
    const current = byWorkstream.get(check.workstream) ?? { min: 0, max: 0 };
    byWorkstream.set(check.workstream, {
      min: current.min + effort.min,
      max: current.max + effort.max,
    });
  }
  const workstreams = [...byWorkstream.entries()]
    .map(([name, effortDays]) => ({ name, effortDays }))
    .sort((left, right) => right.effortDays.max - left.effortDays.max);
  const personDays = workstreams.reduce(
    (total, item) => ({
      min: total.min + item.effortDays.min,
      max: total.max + item.effortDays.max,
    }),
    { min: 0, max: 0 },
  );
  const longest = workstreams.reduce(
    (current, item) => ({
      min: Math.max(current.min, item.effortDays.min),
      max: Math.max(current.max, item.effortDays.max),
    }),
    { min: 0, max: 0 },
  );
  return {
    personDays,
    parallelCalendarDays: {
      min: longest.min + stabilizationDays.min,
      max: longest.max + stabilizationDays.max,
    },
    workstreams,
  };
}

export function evaluateMaturity(checks: ReadinessCheck[]): MaturityAssessment {
  const totalWeight = checks.reduce((total, check) => total + check.weight, 0);
  if (totalWeight !== 100) {
    throw new Error(`Os pesos de maturidade devem somar 100; valor atual: ${totalWeight}.`);
  }
  const score = Math.round(
    checks.reduce(
      (total, check) => total + check.weight * STATUS_FACTOR[check.status],
      0,
    ),
  );
  const paidPilotBlockers = checks.filter(
    (check) => check.criticalForPaidPilot && check.status !== "proven",
  );
  const generalAvailabilityBlockers = checks.filter(
    (check) => check.criticalForGeneralAvailability && check.status !== "proven",
  );
  const paidPilotReady = paidPilotBlockers.length === 0 && score >= 70;
  const generalAvailabilityReady =
    paidPilotReady && generalAvailabilityBlockers.length === 0 && score >= 90;
  let stage: ReadinessStage;
  if (generalAvailabilityReady) stage = "general_availability";
  else if (paidPilotReady && score >= 82) stage = "limited_commercial";
  else if (paidPilotReady) stage = "paid_pilot";
  else if (score >= 50) stage = "design_partner";
  else stage = "internal_only";

  return {
    score,
    stage,
    paidPilotReady,
    generalAvailabilityReady,
    paidPilotBlockers,
    generalAvailabilityBlockers,
    paidPilotEstimate: estimateDelivery(paidPilotBlockers, { min: 2, max: 3 }),
    generalAvailabilityEstimate: estimateDelivery(
      checks.filter((check) => check.status !== "proven"),
      { min: 10, max: 15 },
    ),
    checks,
  };
}

export const stageLabels: Record<ReadinessStage, string> = {
  internal_only: "Uso interno",
  design_partner: "Design partners",
  paid_pilot: "Piloto pago",
  limited_commercial: "Comercialização limitada",
  general_availability: "Disponibilidade geral",
};
