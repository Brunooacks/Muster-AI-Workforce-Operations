/**
 * Validação pura do baseline humano pré-implantação por tipo de tarefa (MUS-195).
 */

export type BaselineMeasurementKind = "measured" | "estimated";

export interface HumanBaselineInputPayload {
  taskType: string;
  agentId?: string | null;
  humanMinutesPerTask: number;
  humanAccuracyRate: number;
  humanEscalationRate: number;
  measurementKind?: BaselineMeasurementKind;
  measuredAt?: string | null;
  notes?: string | null;
}

export function humanBaselineProblems(input: Partial<HumanBaselineInputPayload>): string[] {
  const problems: string[] = [];
  const taskType = typeof input.taskType === "string" ? input.taskType.trim() : "";
  if (!taskType) problems.push("taskType é obrigatório.");
  else if (taskType.length > 80) problems.push("taskType deve ter no máximo 80 caracteres.");

  if (
    typeof input.humanMinutesPerTask !== "number" ||
    !Number.isFinite(input.humanMinutesPerTask) ||
    input.humanMinutesPerTask < 0
  ) {
    problems.push("humanMinutesPerTask precisa ser um número ≥ 0.");
  }
  if (
    typeof input.humanAccuracyRate !== "number" ||
    !Number.isFinite(input.humanAccuracyRate) ||
    input.humanAccuracyRate < 0 ||
    input.humanAccuracyRate > 100
  ) {
    problems.push("humanAccuracyRate precisa estar entre 0 e 100.");
  }
  if (
    typeof input.humanEscalationRate !== "number" ||
    !Number.isFinite(input.humanEscalationRate) ||
    input.humanEscalationRate < 0 ||
    input.humanEscalationRate > 100
  ) {
    problems.push("humanEscalationRate precisa estar entre 0 e 100.");
  }

  const kind = input.measurementKind ?? "measured";
  if (kind !== "measured" && kind !== "estimated") {
    problems.push("measurementKind deve ser 'measured' ou 'estimated'.");
  }
  const measuredAt = typeof input.measuredAt === "string" ? input.measuredAt.trim() : "";
  if (kind === "measured" && !measuredAt) {
    problems.push("measuredAt é obrigatório quando a origem for 'measured' (pré-implantação).");
  }
  if (measuredAt && !/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) {
    problems.push("measuredAt deve estar no formato YYYY-MM-DD.");
  }
  return problems;
}
