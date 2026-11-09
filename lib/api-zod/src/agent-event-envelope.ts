import { TaskEnvelope } from "./task-envelope";

/**
 * Paridade entre `agent_events` e o envelope de tarefa da E3 (cunha · C1.5,
 * regra R1): a linha do evento já tem tudo o que o envelope carrega, então a
 * E3 só transporta — sem migração. Escrito à mão, como o `task-envelope.ts`.
 */

/** Campo do envelope/evento ↔ header do Veltrix (regra R2). */
export const VELTRIX_FIELD_HEADERS = {
  task_id: "x-veltrix-task",
  run_id: "x-veltrix-run",
} as const;

/** O que `toEnvelope` lê de uma linha de `agent_events` (+ o tipo do ambiente). */
export interface AgentEventEnvelopeSource {
  id: string;
  agentId: string;
  orgId: string | null;
  projectId: string | null;
  /** `environments.kind` do `environment_id` do evento. */
  environmentKind: "sandbox" | "prod" | null;
  kind: string;
  ts: Date | string;
  taskId: string | null;
  runId: string | null;
  attempt: number | null;
  retryOf: string | null;
}

export class EnvelopeError extends Error {}

/**
 * Evento → envelope. Evento sem `task_id` não é tarefa (D-C4) e evento sem
 * conta/projeto/ambiente não tem tenant completo: os dois lançam
 * `EnvelopeError` em vez de inventar valor.
 */
export function toEnvelope(row: AgentEventEnvelopeSource, options: { stage?: string } = {}): TaskEnvelope {
  if (!row.taskId) throw new EnvelopeError("evento sem task_id não vira envelope de tarefa");
  if (!row.orgId || !row.projectId || !row.environmentKind) {
    throw new EnvelopeError("evento sem conta, projeto ou ambiente não vira envelope de tarefa");
  }
  return TaskEnvelope.parse({
    task_id: row.taskId,
    org_id: row.orgId,
    project_id: row.projectId,
    environment: row.environmentKind,
    agent_id: row.agentId,
    stage: options.stage ?? "agent_event",
    attempt: row.attempt ?? 1,
    idempotency_key: `${row.agentId}:${row.id}`,
    payload: {
      event_id: row.id,
      kind: row.kind,
      run_id: row.runId,
      retry_of: row.retryOf,
      ts: typeof row.ts === "string" ? row.ts : row.ts.toISOString(),
    },
  });
}
