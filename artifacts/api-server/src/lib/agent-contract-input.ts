import type { ContractDirection } from "@workspace/db/schema";

/** Validação do corpo do contrato, sem banco (testável em unidade). */

export interface ContractInput {
  metricKey: string;
  unit: string;
  direction: ContractDirection;
  baseline: number;
  target: number;
  limit?: number | null;
  deadline: string;
  ownerMemberId: string;
  referenceHumanMinutes?: number | null;
  requireHumanAccept?: boolean;
  referenceModel?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function finito(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Validação que não depende do banco. `today` em YYYY-MM-DD (UTC) para o teste
 * fixar a data. Devolve a lista de problemas; vazia = válido.
 */
export function contractInputProblems(input: Partial<ContractInput>, today: string): string[] {
  const problems: string[] = [];
  if (!input.metricKey?.trim()) problems.push("metricKey é obrigatório.");
  if (!input.unit?.trim()) problems.push("unit é obrigatório.");
  if (input.direction !== "up" && input.direction !== "down") problems.push("direction deve ser up ou down.");
  if (!finito(input.baseline)) problems.push("baseline precisa ser numérico.");
  if (!finito(input.target)) problems.push("target precisa ser numérico.");
  if (input.limit != null && !finito(input.limit)) problems.push("limit precisa ser numérico.");
  if (!input.deadline || !ISO_DATE.test(input.deadline) || Number.isNaN(Date.parse(input.deadline))) {
    problems.push("deadline deve ser uma data YYYY-MM-DD.");
  } else if (input.deadline <= today) {
    problems.push("deadline precisa ser futura.");
  }
  if (!input.ownerMemberId?.trim()) problems.push("Dono (ownerMemberId) é obrigatório.");
  if (input.referenceHumanMinutes != null && (!finito(input.referenceHumanMinutes) || input.referenceHumanMinutes < 0)) {
    problems.push("referenceHumanMinutes precisa ser um número ≥ 0.");
  }
  return problems;
}
