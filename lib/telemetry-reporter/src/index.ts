/**
 * Muster Telemetry Reporter — the connector a RUNNING agent (or its host
 * process) embeds to report execution events to Muster. Muster only collects
 * and stores; it never executes the agent nor exposes metrics back through
 * this SDK.
 *
 * Design constraints:
 * - Zero runtime dependencies (global fetch, Node 18+ / browsers / edge).
 * - Fire-and-forget: reporting must NEVER break the agent. `report` resolves
 *   `false` on any failure and routes the error to `onError`.
 * - Timestamps are optional: live agents omit `ts` (server stamps "now");
 *   batch/replay integrations pass the real occurrence time.
 */

export type AgentEventKind =
  | "execution"
  | "error"
  | "escalation"
  | "feedback"
  | "heartbeat"
  /** Aprovação/rejeição humana de uma tarefa (use `run.review`). */
  | "human_review";

/** Headers do Veltrix com a mesma semântica de `taskId`/`runId` (regra R2). */
export const VELTRIX_TASK_HEADER = "x-veltrix-task";
export const VELTRIX_RUN_HEADER = "x-veltrix-run";

export type AcceptedByKind = "human" | "auto";

export interface TaskCapabilities {
  tools?: boolean;
  vision?: boolean;
  /** Janela de contexto usada, em tokens. */
  contextWindow?: number;
  [key: string]: unknown;
}

export interface AgentEvent {
  kind?: AgentEventKind;
  /** Occurrence time (ISO 8601 or Date). Omit to let the server stamp now. */
  ts?: string | Date;
  durationMs?: number;
  costCents?: number;
  tokensIn?: number;
  tokensOut?: number;
  /** For kind=execution: whether the work item was resolved correctly. */
  success?: boolean;
  metadata?: Record<string, unknown>;
  /** Stable per-event key; resend the same key after a network failure. */
  idempotencyKey?: string;
  // --- Resultado da tarefa (cunha) -----------------------------------------
  /** Tarefa (x-veltrix-task). */
  taskId?: string;
  /** Execução/tentativa (x-veltrix-run). */
  runId?: string;
  /** Ordinal do run dentro da task: 1, 2, … */
  attempt?: number;
  /** runId da tentativa anterior da mesma task. */
  retryOf?: string;
  expected?: unknown;
  actual?: unknown;
  /** Quem decidiu: pessoa (human) ou regra (auto). */
  acceptedBy?: string;
  acceptedByKind?: AcceptedByKind;
  /** Obrigatório quando acceptedByKind = "auto". */
  acceptedRuleVersion?: string;
  acceptedAt?: string | Date;
  capabilities?: TaskCapabilities;
  /** Rodadas de retrabalho dentro do run. */
  rework?: number;
  /** Minutos humanos reais (revisão ou retrabalho). */
  humanMinutes?: number;
  /** Tokens de contexto dentro de tokensIn. */
  contextTokens?: number;
  model?: string;
}

/** Identidade de um run: o que vai nos campos taskId/runId/attempt/retryOf. */
export interface TaskRunRef {
  taskId: string;
  runId: string;
  attempt: number;
  retryOf?: string;
}

export interface ReviewInput {
  approved: boolean;
  /** Minutos que a pessoa gastou revisando. */
  minutes?: number;
  /** Quem revisou. */
  by: string;
  ts?: string | Date;
}

export interface AcceptInput {
  by: string;
  kind: AcceptedByKind;
  /** Obrigatório para kind = "auto" (o servidor recusa sem ela). */
  ruleVersion?: string;
  ts?: string | Date;
}

/** Um run em andamento, com os campos da tarefa já preenchidos. */
export interface TaskRun extends TaskRunRef {
  /** Reporta um evento deste run (os campos da tarefa são do run). */
  report(event?: AgentEvent): Promise<boolean>;
  /** Mede e reporta uma unidade de trabalho deste run. */
  trackExecution<T>(work: () => Promise<T> | T, options?: TrackOptions): Promise<T>;
  /** Nova tentativa da mesma tarefa (attempt + 1, retryOf = este run). */
  retry(options?: { runId?: string }): TaskRun;
  /** Aprovação ou rejeição humana deste run (kind human_review). */
  review(input: ReviewInput): Promise<boolean>;
  /** Aceite humano ou automático deste run. */
  accept(input: AcceptInput): Promise<boolean>;
}

/** Lê task/run dos headers do Veltrix (objeto simples ou Headers). */
export function taskFromVeltrixHeaders(
  headers: Headers | Record<string, string | string[] | undefined>,
): { taskId?: string; runId?: string } {
  const get = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? undefined;
    const record = headers as Record<string, string | string[] | undefined>;
    const key = Object.keys(record).find((k) => k.toLowerCase() === name);
    const value = key ? record[key] : undefined;
    return Array.isArray(value) ? value[0] : value;
  };
  const taskId = get(VELTRIX_TASK_HEADER);
  const runId = get(VELTRIX_RUN_HEADER);
  return { ...(taskId ? { taskId } : {}), ...(runId ? { runId } : {}) };
}

function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Próxima tentativa de um run: calcula attempt e retryOf. */
export function nextAttempt(prev: TaskRunRef, runId: string = newId()): TaskRunRef {
  return { taskId: prev.taskId, runId, attempt: prev.attempt + 1, retryOf: prev.runId };
}

function runFields(run: TaskRunRef): Pick<AgentEvent, "taskId" | "runId" | "attempt" | "retryOf"> {
  return {
    taskId: run.taskId,
    runId: run.runId,
    attempt: run.attempt,
    ...(run.retryOf ? { retryOf: run.retryOf } : {}),
  };
}

export type MusterCaptureMode =
  | "metadata_only"
  | "redacted_sample"
  | "full_controlled"
  | "local_only";

export interface MusterContextSource {
  type: "instruction" | "memory" | "retrieval" | "file" | "database" | "api" | "tool" | "handoff";
  ref?: string;
  version?: string;
  hash?: string;
  capturedAt?: string;
  owner?: string;
  authorizationScope?: string;
  tokens?: number;
  freshnessSeconds?: number;
  relevance?: number;
  status?: "available" | "missing" | "stale" | "denied" | "truncated" | "not_collected";
}

export interface MusterExecutionContext {
  correlation?: {
    runId?: string;
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
    sessionId?: string;
    journeyId?: string;
    stageId?: string;
    workItemId?: string;
    handoffId?: string;
  };
  release?: {
    environment?: string;
    deploymentId?: string;
    releaseId?: string;
    agentVersion?: string;
    contractVersion?: string;
    group?: "control" | "canary" | "shadow";
  };
  configuration?: {
    provider?: string;
    model?: string;
    modelVersion?: string;
    promptId?: string;
    promptVersion?: string;
    toolsetVersion?: string;
    inputSchemaVersion?: string;
    outputSchemaVersion?: string;
    contextPolicyId?: string;
  };
  input?: {
    caseId?: string;
    taskClass?: string;
    domain?: string;
    channel?: string;
    language?: string;
    complexity?: string;
    format?: string;
    hash?: string;
    sizeBytes?: number;
    tokens?: number;
    sensitivity?: string[];
    captureMode: MusterCaptureMode;
  };
  context?: {
    captureMode: MusterCaptureMode;
    required?: string[];
    sources?: MusterContextSource[];
  };
  evaluation?: {
    grounded?: boolean;
    hallucinationFlag?: boolean;
    evaluator?: string;
    score?: number;
    evidenceRefs?: string[];
  };
}

export function withMusterExecutionContext(
  metadata: Record<string, unknown> | undefined,
  context: MusterExecutionContext | undefined,
): Record<string, unknown> | undefined {
  if (!context) return metadata;
  return {
    ...metadata,
    muster: {
      schemaVersion: "1.0",
      ...context,
    },
  };
}

export interface MusterReporterOptions {
  /** Muster API origin, e.g. "http://localhost:8080". */
  baseUrl: string;
  /** Muster agent id (the fleet identity this telemetry belongs to). */
  agentId: string;
  /** Per-agent Muster API key used as the bearer token. */
  token?: string;
  /** Abort slow deliveries so the agent never hangs on telemetry. */
  timeoutMs?: number;
  /** Delivery failures land here (default: silent). */
  onError?: (error: unknown, event: AgentEvent) => void;
  /** Override fetch (tests, custom transports). */
  fetchImpl?: typeof fetch;
}

export interface TrackOptions {
  /**
   * Derive cost/token fields from the wrapped function's result, e.g.
   * (r) => ({ tokensIn: r.usage.input, costCents: r.costCents }).
   */
  enrich?: (result: unknown) => Omit<AgentEvent, "kind" | "ts" | "durationMs">;
  metadata?: Record<string, unknown>;
  /** Structured descriptors for comparison and attribution. Raw content is intentionally absent. */
  executionContext?: MusterExecutionContext;
  /** Campos extras do evento de erro (o TaskRun usa para levar task/run). */
  errorFields?: Omit<AgentEvent, "kind" | "durationMs" | "metadata">;
}

export interface MusterReporter {
  /** Send one event. Never throws; resolves false on delivery failure. */
  report(event?: AgentEvent): Promise<boolean>;
  /** Send a batch (e.g. replayed history). Resolves the delivered count. */
  reportMany(events: AgentEvent[]): Promise<number>;
  /** Report runtime liveness without affecting the agent's work path. */
  heartbeat(options?: HeartbeatOptions): Promise<boolean>;
  /** Start periodic liveness reporting; returns a function that stops it. */
  startHeartbeat(options?: HeartbeatOptions): () => void;
  /**
   * Wrap one unit of agent work: measures duration, reports
   * kind=execution/success on resolve and kind=error on throw, then
   * re-throws so the agent's own error handling still runs.
   */
  trackExecution<T>(work: () => Promise<T> | T, options?: TrackOptions): Promise<T>;
  /**
   * Começa uma tarefa (attempt 1). Sem ids, gera; com os headers do Veltrix,
   * use `taskFromVeltrixHeaders(req.headers)`.
   */
  startTask(options?: { taskId?: string; runId?: string }): TaskRun;
  /** Nova tentativa de um run anterior (attempt + 1, retryOf = runId anterior). */
  retry(prevRun: TaskRunRef, options?: { runId?: string }): TaskRun;
  /** Revisão humana de um run. */
  review(run: TaskRunRef, input: ReviewInput): Promise<boolean>;
  /** Aceite humano ou automático de um run. */
  accept(run: TaskRunRef, input: AcceptInput): Promise<boolean>;
}

export interface HeartbeatOptions {
  runtime?: string;
  version?: string;
  intervalSeconds?: number;
  status?: "healthy" | "degraded" | "stopped";
  metadata?: Record<string, unknown>;
}

function toIso(ts: string | Date): string {
  return ts instanceof Date ? ts.toISOString() : ts;
}

export function createMusterReporter(
  options: MusterReporterOptions,
): MusterReporter {
  const { baseUrl, agentId, token, timeoutMs = 5000, onError, fetchImpl } = options;
  if (!baseUrl) throw new Error("baseUrl é obrigatório");
  if (!agentId) throw new Error("agentId é obrigatório");

  const doFetch = fetchImpl ?? fetch;
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/agents/${encodeURIComponent(agentId)}/events`;
  const heartbeatEndpoint = `${baseUrl.replace(/\/+$/, "")}/api/agents/${encodeURIComponent(agentId)}/heartbeat`;

  async function report(event: AgentEvent = {}): Promise<boolean> {
    try {
      const { ts, acceptedAt, rework, ...rest } = event;
      const body = {
        ...rest,
        ...(ts !== undefined ? { ts: toIso(ts) } : {}),
        ...(acceptedAt !== undefined ? { acceptedAt: toIso(acceptedAt) } : {}),
        ...(rework !== undefined ? { reworkCount: rework } : {}),
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          onError?.(new Error(`Muster ingest respondeu ${res.status}`), event);
          return false;
        }
        return true;
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      onError?.(error, event);
      return false;
    }
  }

  async function reportMany(events: AgentEvent[]): Promise<number> {
    let delivered = 0;
    // Sequential on purpose: batches are backfills, not hot paths, and this
    // keeps ordering and avoids hammering the ingest endpoint.
    for (const event of events) {
      if (await report(event)) delivered += 1;
    }
    return delivered;
  }

  async function heartbeat(heartbeatOptions: HeartbeatOptions = {}): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(heartbeatEndpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(heartbeatOptions),
          signal: controller.signal,
        });
        if (!res.ok) {
          onError?.(new Error(`Muster heartbeat respondeu ${res.status}`), { kind: "heartbeat", metadata: heartbeatOptions as Record<string, unknown> });
          return false;
        }
        return true;
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      onError?.(error, { kind: "heartbeat", metadata: heartbeatOptions as Record<string, unknown> });
      return false;
    }
  }

  function startHeartbeat(heartbeatOptions: HeartbeatOptions = {}): () => void {
    const intervalSeconds = Math.max(5, Math.min(900, heartbeatOptions.intervalSeconds ?? 30));
    void heartbeat(heartbeatOptions);
    const timer = setInterval(() => void heartbeat(heartbeatOptions), intervalSeconds * 1000);
    (timer as unknown as { unref?: () => void }).unref?.();
    return () => clearInterval(timer);
  }

  async function trackExecution<T>(
    work: () => Promise<T> | T,
    trackOptions: TrackOptions = {},
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await work();
      const enriched = trackOptions.enrich?.(result) ?? {};
      void report({
        kind: "execution",
        success: true,
        durationMs: Date.now() - startedAt,
        metadata: withMusterExecutionContext(trackOptions.metadata, trackOptions.executionContext),
        ...enriched,
      });
      return result;
    } catch (error) {
      void report({
        kind: "error",
        durationMs: Date.now() - startedAt,
        ...trackOptions.errorFields,
        metadata: withMusterExecutionContext({
          ...trackOptions.metadata,
          message: error instanceof Error ? error.message : String(error),
        }, trackOptions.executionContext),
      });
      throw error;
    }
  }

  function review(run: TaskRunRef, input: ReviewInput): Promise<boolean> {
    return report({
      kind: "human_review",
      taskId: run.taskId,
      runId: run.runId,
      attempt: run.attempt,
      success: input.approved,
      acceptedBy: input.by,
      ...(input.minutes !== undefined ? { humanMinutes: input.minutes } : {}),
      ...(input.ts !== undefined ? { ts: input.ts } : {}),
    });
  }

  function accept(run: TaskRunRef, input: AcceptInput): Promise<boolean> {
    // O aceite anota a tentativa (kind feedback): o resultado terminal dela
    // (execution/error) já foi reportado e é único por tentativa.
    return report({
      kind: "feedback",
      taskId: run.taskId,
      runId: run.runId,
      attempt: run.attempt,
      acceptedBy: input.by,
      acceptedByKind: input.kind,
      ...(input.ruleVersion !== undefined ? { acceptedRuleVersion: input.ruleVersion } : {}),
      ...(input.ts !== undefined ? { ts: input.ts } : {}),
    });
  }

  function bind(ref: TaskRunRef): TaskRun {
    return {
      ...ref,
      report: (event = {}) => report({ ...event, ...runFields(ref) }),
      trackExecution: (work, trackOptions = {}) =>
        trackExecution(work, {
          ...trackOptions,
          enrich: (result) => ({ ...(trackOptions.enrich?.(result) ?? {}), ...runFields(ref) }),
          errorFields: runFields(ref),
        }),
      retry: (retryOptions = {}) => bind(nextAttempt(ref, retryOptions.runId)),
      review: (input) => review(ref, input),
      accept: (input) => accept(ref, input),
    };
  }

  function startTask(taskOptions: { taskId?: string; runId?: string } = {}): TaskRun {
    return bind({ taskId: taskOptions.taskId ?? newId(), runId: taskOptions.runId ?? newId(), attempt: 1 });
  }

  function retry(prevRun: TaskRunRef, retryOptions: { runId?: string } = {}): TaskRun {
    return bind(nextAttempt(prevRun, retryOptions.runId));
  }

  return { report, reportMany, heartbeat, startHeartbeat, trackExecution, startTask, retry, review, accept };
}
