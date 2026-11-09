import type { AcceptedByKind, AgentEventKind, TaskCapabilities } from "@workspace/db";

/**
 * Campos de resultado da tarefa no ingest (cunha · C1.3). Funções puras: a rota
 * resolve o `retryOf` no banco e chama `resolveAttempt` com o que achou.
 *
 * Glossário (R2): taskId = x-veltrix-task, runId = x-veltrix-run, attempt =
 * ordinal do run na task, retryOf = runId da tentativa anterior da mesma task.
 */

export interface TaskOutcomeBody {
  kind?: AgentEventKind;
  success?: boolean;
  taskId?: string;
  runId?: string;
  attempt?: number;
  retryOf?: string;
  expected?: unknown;
  actual?: unknown;
  acceptedBy?: string;
  acceptedByKind?: AcceptedByKind;
  acceptedRuleVersion?: string;
  acceptedAt?: Date;
  capabilities?: TaskCapabilities;
  reworkCount?: number;
  humanMinutes?: number;
  contextTokens?: number;
  model?: string;
}

export class TaskOutcomeError extends Error {
  constructor(
    message: string,
    readonly status: 409 | 422 = 422,
  ) {
    super(message);
  }
}

/** O corpo usa algum campo da cunha? Sem nenhum, o ingest é o de antes. */
export function hasTaskOutcome(body: TaskOutcomeBody): boolean {
  return (
    body.kind === "human_review" ||
    [
      body.taskId,
      body.runId,
      body.attempt,
      body.retryOf,
      body.expected,
      body.actual,
      body.acceptedBy,
      body.acceptedByKind,
      body.acceptedRuleVersion,
      body.acceptedAt,
      body.capabilities,
      body.reworkCount,
      body.humanMinutes,
      body.contextTokens,
      body.model,
    ].some((value) => value !== undefined)
  );
}

function inteiro(nome: string, value: number | undefined, minimo: number) {
  if (value !== undefined && (!Number.isInteger(value) || value < minimo)) {
    throw new TaskOutcomeError(`${nome} precisa ser inteiro ≥ ${minimo}.`);
  }
}

/**
 * Regras que não dependem do banco. Lança `TaskOutcomeError` (422) com a
 * primeira violação.
 */
export function checkTaskOutcome(body: TaskOutcomeBody): void {
  inteiro("attempt", body.attempt, 1);
  inteiro("reworkCount", body.reworkCount, 0);
  inteiro("contextTokens", body.contextTokens, 0);
  if (body.capabilities?.contextWindow !== undefined) {
    inteiro("capabilities.contextWindow", body.capabilities.contextWindow, 0);
  }

  const precisaDeTask =
    body.kind === "human_review" ||
    [
      body.runId,
      body.attempt,
      body.retryOf,
      body.expected,
      body.actual,
      body.acceptedBy,
      body.acceptedByKind,
      body.acceptedRuleVersion,
      body.acceptedAt,
    ].some((value) => value !== undefined);
  if (precisaDeTask && !body.taskId) {
    throw new TaskOutcomeError("taskId é obrigatório com runId, attempt, retryOf, esperado/obtido, aceite ou human_review.");
  }

  if (body.kind === "human_review") {
    if (body.success === undefined) {
      throw new TaskOutcomeError("human_review exige success (true = aprovado, false = rejeitado).");
    }
    if (!body.acceptedBy) throw new TaskOutcomeError("human_review exige acceptedBy (quem revisou).");
    if (body.acceptedByKind === "auto") throw new TaskOutcomeError("human_review é sempre aceite humano.");
    if (body.acceptedRuleVersion !== undefined) {
      throw new TaskOutcomeError("acceptedRuleVersion só vale para aceite auto.");
    }
    if (body.retryOf !== undefined) throw new TaskOutcomeError("human_review não é tentativa: retryOf não se aplica.");
    return;
  }

  if (body.acceptedByKind === undefined) {
    if (body.acceptedBy !== undefined || body.acceptedRuleVersion !== undefined || body.acceptedAt !== undefined) {
      throw new TaskOutcomeError("Informe acceptedByKind (human ou auto) junto com o aceite.");
    }
  } else {
    if (!body.acceptedBy) throw new TaskOutcomeError("Aceite exige acceptedBy (pessoa ou regra).");
    if (body.acceptedByKind === "auto" && !body.acceptedRuleVersion) {
      throw new TaskOutcomeError("Aceite auto exige acceptedRuleVersion (D-C3).");
    }
    if (body.acceptedByKind === "human" && body.acceptedRuleVersion !== undefined) {
      throw new TaskOutcomeError("acceptedRuleVersion só vale para aceite auto.");
    }
  }

  if (body.retryOf === undefined && body.attempt !== undefined && body.attempt > 1) {
    throw new TaskOutcomeError("attempt > 1 exige retryOf (runId da tentativa anterior).");
  }
  if (body.retryOf !== undefined && body.attempt === 1) {
    throw new TaskOutcomeError("attempt 1 não é retry: retire o retryOf.");
  }
  if (body.retryOf !== undefined && body.runId !== undefined && body.retryOf === body.runId) {
    throw new TaskOutcomeError("retryOf não pode apontar para o próprio run.");
  }
}

/** O run apontado por `retryOf`, como achado no projeto da credencial. */
export interface PreviousRun {
  taskId: string | null;
  attempt: number | null;
}

/**
 * Ordinal final do evento. `previous` é `null` quando o `retryOf` não existe
 * no projeto (422); `undefined` quando o corpo não tem `retryOf`.
 */
export function resolveAttempt(body: TaskOutcomeBody, previous: PreviousRun | null | undefined): number | null {
  if (!body.taskId) return null;
  if (body.kind === "human_review") return body.attempt ?? null;
  if (body.retryOf === undefined) return body.attempt ?? 1;
  if (!previous) throw new TaskOutcomeError("retryOf não aponta para um run conhecido deste projeto.");
  if (previous.taskId !== body.taskId) throw new TaskOutcomeError("retryOf aponta para run de outra task.");
  if (previous.attempt === null) throw new TaskOutcomeError("retryOf aponta para run sem attempt.");
  const esperado = previous.attempt + 1;
  if (body.attempt !== undefined && body.attempt !== esperado) {
    throw new TaskOutcomeError(`attempt deveria ser ${esperado} (anterior + 1).`);
  }
  return esperado;
}

/**
 * Quando a tarefa foi aceita por este evento: revisão aprovada, ou aceite
 * declarado num evento comum. Revisão rejeitada não aceita.
 */
export function acceptedAtFor(body: TaskOutcomeBody, occurredAt: Date): Date | null {
  if (body.kind === "human_review") return body.success ? (body.acceptedAt ?? occurredAt) : null;
  if (body.acceptedByKind === undefined) return null;
  return body.acceptedAt ?? occurredAt;
}

export const TASK_TRAIL_EVENT_TYPE = "agent.task.trail";

/**
 * Registro de trilha (camada 3): toda revisão humana e todo aceite. Vai ao
 * outbox já `completed` — não é trabalho para worker, é histórico que a E6
 * transforma em trilha imutável.
 */
export function taskTrailPayload(input: {
  agentId: string;
  agentEventId: string;
  body: TaskOutcomeBody;
  attempt: number | null;
  acceptedAt: Date | null;
  occurredAt: Date;
}): Record<string, unknown> | null {
  const { body } = input;
  const isReview = body.kind === "human_review";
  if (!isReview && body.acceptedByKind === undefined) return null;
  return {
    agentId: input.agentId,
    agentEventId: input.agentEventId,
    record: isReview ? "human_review" : "acceptance",
    taskId: body.taskId ?? null,
    runId: body.runId ?? null,
    attempt: input.attempt,
    decision: isReview ? (body.success ? "approved" : "rejected") : "accepted",
    acceptedBy: body.acceptedBy ?? null,
    acceptedByKind: isReview ? "human" : body.acceptedByKind,
    acceptedRuleVersion: body.acceptedRuleVersion ?? null,
    acceptedAt: input.acceptedAt?.toISOString() ?? null,
    humanMinutes: body.humanMinutes ?? null,
    occurredAt: input.occurredAt.toISOString(),
  };
}
