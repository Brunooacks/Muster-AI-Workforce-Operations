import { z } from "zod";

/**
 * Envelope de tarefa (E1 · T1.8), espelho de
 * `lib/api-spec/task-envelope.schema.json`. Escrito à mão porque o orval só
 * gera a partir do OpenAPI; `task-envelope.test.ts` (api-server) confere que
 * os dois não divergem.
 */

/** D-E3-1: 8 tentativas com espera crescente até ~30 min, depois DLQ. */
export const TASK_ENVELOPE_MAX_ATTEMPTS_DEFAULT = 8;

export const TaskEnvelopeEnvironment = z.enum(["sandbox", "prod"]);

export const TaskEnvelope = z
  .object({
    task_id: z.string().min(1),
    org_id: z.string().min(1),
    project_id: z.string().min(1),
    environment: TaskEnvelopeEnvironment,
    agent_id: z.string().min(1),
    stage: z.string().min(1),
    attempt: z.number().int().min(1),
    max_attempts: z.number().int().min(1).default(TASK_ENVELOPE_MAX_ATTEMPTS_DEFAULT),
    idempotency_key: z.string().min(1).max(200),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict()
  .refine((envelope) => envelope.attempt <= envelope.max_attempts, {
    message: "attempt não pode passar de max_attempts.",
    path: ["attempt"],
  });

export type TaskEnvelope = z.infer<typeof TaskEnvelope>;
