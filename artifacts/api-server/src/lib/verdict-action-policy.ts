import type { VerdictActionStatus } from "@workspace/db";

/**
 * Regras puras do ciclo de revisão do agente (gauntlet rodada 5). Ficam fora da
 * rota para serem testáveis sem banco — é aqui que mora a diferença entre
 * "marquei como pronto" e "houve evidência de que foi feito".
 */

export const VERDICT_ACTION_STATUSES: VerdictActionStatus[] = [
  "proposed",
  "in-progress",
  "blocked",
  "completed",
  "cancelled",
];

/** Ruído aceitável na saúde entre duas janelas — abaixo disso não se afirma nada. */
const LIMIAR_RUIDO = 5;

export function isValidActionStatus(status: unknown): status is VerdictActionStatus {
  return typeof status === "string" && (VERDICT_ACTION_STATUSES as string[]).includes(status);
}

/**
 * Concluir exige evidência: ou a que já estava registrada, ou uma nova no mesmo
 * gesto. Sem isso o status vira autodeclaração e não sobrevive a uma auditoria.
 */
export function canCompleteAction(input: {
  evidenceAtual: string;
  evidenceNova?: string;
}): boolean {
  const nova = input.evidenceNova?.trim() ?? "";
  return nova.length > 0 || input.evidenceAtual.trim().length > 0;
}

export interface ActionProgress {
  total: number;
  concluidas: number;
  emAndamento: number;
  bloqueadas: number;
  /** Percentual sobre o plano vivo — ações canceladas saem do denominador. */
  percentualConcluido: number;
  /** Ainda há ação viva sem conclusão. */
  pendente: boolean;
}

export function summarizeActionProgress(
  actions: Array<{ status: VerdictActionStatus }>,
): ActionProgress {
  const total = actions.length;
  const vivas = actions.filter((a) => a.status !== "cancelled");
  const concluidas = actions.filter((a) => a.status === "completed").length;
  const emAndamento = actions.filter((a) => a.status === "in-progress").length;
  const bloqueadas = actions.filter((a) => a.status === "blocked").length;
  return {
    total,
    concluidas,
    emAndamento,
    bloqueadas,
    percentualConcluido: vivas.length === 0 ? 0 : Math.round((concluidas / vivas.length) * 100),
    pendente: vivas.some((a) => a.status !== "completed"),
  };
}

export interface InterventionOutcome {
  /** Há baseline e a variação supera o ruído. */
  conclusivo: boolean;
  /** null quando não há como afirmar. */
  melhorou: boolean | null;
  delta: number | null;
}

/**
 * Responde a pergunta que fecha o ciclo: a intervenção funcionou? Compara a
 * saúde de agora com a do momento em que a ação saiu do papel. Sem baseline, ou
 * com variação dentro do ruído, devolve inconclusivo — nunca um palpite.
 */
export function didInterventionWork(input: {
  healthScoreAtApproval: number | null;
  healthScoreAtual: number;
}): InterventionOutcome {
  if (input.healthScoreAtApproval === null) {
    return { conclusivo: false, melhorou: null, delta: null };
  }
  const delta = input.healthScoreAtual - input.healthScoreAtApproval;
  if (Math.abs(delta) < LIMIAR_RUIDO) {
    return { conclusivo: false, melhorou: null, delta };
  }
  return { conclusivo: true, melhorou: delta > 0, delta };
}
