import type { AgentEventKind } from "@workspace/db";

export type SupervisionPriority = "critical" | "high" | "normal" | "low";

export interface SupervisionDispatch {
  shouldReevaluate: boolean;
  priority: SupervisionPriority;
  debounceMs: number;
}
const DISPATCH_BY_KIND: Record<AgentEventKind, SupervisionDispatch> = {
  error: {
    shouldReevaluate: true,
    priority: "critical",
    debounceMs: 0,
  },
  escalation: {
    shouldReevaluate: true,
    priority: "high",
    debounceMs: 0,
  },
  feedback: {
    shouldReevaluate: true,
    priority: "high",
    debounceMs: 1_000,
  },
  execution: {
    shouldReevaluate: true,
    priority: "normal",
    debounceMs: 5_000,
  },
  heartbeat: {
    shouldReevaluate: false,
    priority: "low",
    debounceMs: 0,
  },
};

export function supervisionDispatchFor(
  kind: AgentEventKind,
): SupervisionDispatch {
  return DISPATCH_BY_KIND[kind];
}

export function retryDelayMs(
  attempts: number,
  baseDelayMs = 1_000,
  maxDelayMs = 5 * 60_000,
): number {
  const safeAttempts = Math.max(0, Math.floor(attempts));
  const exponential = baseDelayMs * 2 ** safeAttempts;
  return Math.min(maxDelayMs, exponential);
}

export function retryAvailableAt(
  now: Date,
  attempts: number,
  baseDelayMs?: number,
  maxDelayMs?: number,
): Date {
  return new Date(
    now.getTime() + retryDelayMs(attempts, baseDelayMs, maxDelayMs),
  );
}

export function shouldDeadLetter(attempts: number, maxAttempts = 5): boolean {
  return attempts >= maxAttempts;
}
