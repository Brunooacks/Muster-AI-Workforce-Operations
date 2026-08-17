export type JourneyMonitoringEventKind =
  | "journey_started"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "handoff"
  | "decision"
  | "journey_completed"
  | "journey_failed";

export interface JourneyMonitoringEvent {
  id: string;
  journeyId: string;
  runId: string;
  stepId?: string | null;
  agentId?: string | null;
  kind: JourneyMonitoringEventKind;
  fromStepId?: string | null;
  toStepId?: string | null;
  ts: Date;
  durationMs?: number | null;
  costCents?: number | null;
  success?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export interface JourneyMonitoringStep {
  id: string;
  name?: string;
  agentId?: string | null;
  sequence?: number;
}

export interface JourneyStepMonitoringSummary {
  id: string;
  name: string | null;
  agentId: string | null;
  sequence: number | null;
  executions: number;
  completedExecutions: number;
  failedExecutions: number;
  successRate: number | null;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  totalCostCents: number;
  avgCostCentsPerExecution: number | null;
  judgedHandoffs: number;
  handoffSuccessRate: number | null;
  illusoryVictory: boolean;
}

export type JourneyRunStatus = "active" | "completed" | "failed";

export interface JourneyRunMonitoringSummary {
  runId: string;
  status: JourneyRunStatus;
  startedAt: string | null;
  endedAt: string | null;
  lastEventAt: string | null;
  durationMs: number | null;
  costCents: number;
  eventCount: number;
  currentStepId: string | null;
}

export interface JourneyMonitoringSummary {
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  failedRuns: number;
  completionRate: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  totalCostCents: number;
  avgCostCentsPerRun: number | null;
  handoffSuccessRate: number | null;
  bottleneckStepId: string | null;
  illusoryVictory: boolean;
  warnings: string[];
  steps: JourneyStepMonitoringSummary[];
  recentRuns: JourneyRunMonitoringSummary[];
}

export interface SummarizeJourneyMonitoringInput {
  journeyId: string;
  steps: JourneyMonitoringStep[];
  events: JourneyMonitoringEvent[];
}

interface AggregatedRun {
  runId: string;
  events: JourneyMonitoringEvent[];
}

interface StepRunOutcome {
  success: boolean | null;
  durationMs: number | null;
  costCents: number;
}

function isFiniteNonNegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function timestamp(event: JourneyMonitoringEvent): number | null {
  const value = event.ts.getTime();
  return Number.isFinite(value) ? value : null;
}

function isoTimestamp(event: JourneyMonitoringEvent | undefined): string | null {
  if (!event || timestamp(event) === null) return null;
  return event.ts.toISOString();
}

function compareEvents(
  left: JourneyMonitoringEvent,
  right: JourneyMonitoringEvent,
): number {
  const leftTime = timestamp(left) ?? Number.NEGATIVE_INFINITY;
  const rightTime = timestamp(right) ?? Number.NEGATIVE_INFINITY;
  return leftTime - rightTime || left.id.localeCompare(right.id);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
}

function eventCost(event: JourneyMonitoringEvent): number {
  return isFiniteNonNegative(event.costCents) ? event.costCents : 0;
}

function terminalRunEvent(
  events: JourneyMonitoringEvent[],
): JourneyMonitoringEvent | undefined {
  return [...events]
    .reverse()
    .find(
      (event) =>
        event.kind === "journey_completed" || event.kind === "journey_failed",
    );
}

function runDuration(
  events: JourneyMonitoringEvent[],
  terminal: JourneyMonitoringEvent | undefined,
): number | null {
  if (!terminal) return null;
  if (isFiniteNonNegative(terminal.durationMs)) return terminal.durationMs;

  const started = events.find((event) => event.kind === "journey_started") ?? events[0];
  const startedAt = started ? timestamp(started) : null;
  const endedAt = timestamp(terminal);
  if (startedAt === null || endedAt === null) return null;
  return Math.max(0, endedAt - startedAt);
}

function currentStepId(events: JourneyMonitoringEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    const stepId = event.toStepId ?? event.stepId ?? event.fromStepId;
    if (stepId) return stepId;
  }
  return null;
}

function summarizeRun(run: AggregatedRun): JourneyRunMonitoringSummary {
  const terminal = terminalRunEvent(run.events);
  const status: JourneyRunStatus =
    terminal?.kind === "journey_completed"
      ? "completed"
      : terminal?.kind === "journey_failed"
        ? "failed"
        : "active";
  const firstEvent = run.events[0];
  const lastEvent = run.events.at(-1);

  return {
    runId: run.runId,
    status,
    startedAt: isoTimestamp(
      run.events.find((event) => event.kind === "journey_started") ?? firstEvent,
    ),
    endedAt: isoTimestamp(terminal),
    lastEventAt: isoTimestamp(lastEvent),
    durationMs: runDuration(run.events, terminal),
    costCents: run.events.reduce((sum, event) => sum + eventCost(event), 0),
    eventCount: run.events.length,
    currentStepId: currentStepId(run.events),
  };
}

function stepOutcome(
  run: AggregatedRun,
  stepId: string,
): StepRunOutcome | null {
  const events = run.events.filter((event) => event.stepId === stepId);
  const executionEvents = events.filter(
    (event) =>
      event.kind === "step_started" ||
      event.kind === "step_completed" ||
      event.kind === "step_failed",
  );
  if (executionEvents.length === 0) return null;

  const terminal = [...executionEvents]
    .reverse()
    .find(
      (event) =>
        event.kind === "step_completed" || event.kind === "step_failed",
    );
  let success: boolean | null = null;
  if (terminal) {
    success =
      typeof terminal.success === "boolean"
        ? terminal.success
        : terminal.kind === "step_completed";
  }

  let durationMs: number | null = null;
  if (terminal && isFiniteNonNegative(terminal.durationMs)) {
    durationMs = terminal.durationMs;
  } else if (terminal) {
    const started = executionEvents.find((event) => event.kind === "step_started");
    const startedAt = started ? timestamp(started) : null;
    const endedAt = timestamp(terminal);
    if (startedAt !== null && endedAt !== null) {
      durationMs = Math.max(0, endedAt - startedAt);
    }
  }

  return {
    success,
    durationMs,
    costCents: events.reduce((sum, event) => sum + eventCost(event), 0),
  };
}

function uniqueSteps(steps: JourneyMonitoringStep[]): JourneyMonitoringStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (seen.has(step.id)) return false;
    seen.add(step.id);
    return true;
  });
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function summarizeJourneyMonitoring({
  journeyId,
  steps,
  events,
}: SummarizeJourneyMonitoringInput): JourneyMonitoringSummary {
  const journeyEvents = events
    .filter((event) => event.journeyId === journeyId)
    .sort(compareEvents);
  const groupedRuns = new Map<string, JourneyMonitoringEvent[]>();
  for (const event of journeyEvents) {
    const runEvents = groupedRuns.get(event.runId) ?? [];
    runEvents.push(event);
    groupedRuns.set(event.runId, runEvents);
  }

  const runs: AggregatedRun[] = [...groupedRuns.entries()].map(
    ([runId, runEvents]) => ({ runId, events: runEvents }),
  );
  const recentRuns = runs
    .map(summarizeRun)
    .sort((left, right) => {
      const byTime =
        (right.lastEventAt ? Date.parse(right.lastEventAt) : -Infinity) -
        (left.lastEventAt ? Date.parse(left.lastEventAt) : -Infinity);
      return byTime || left.runId.localeCompare(right.runId);
    });

  const totalRuns = recentRuns.length;
  const completedRuns = recentRuns.filter(
    (run) => run.status === "completed",
  ).length;
  const failedRuns = recentRuns.filter((run) => run.status === "failed").length;
  const activeRuns = totalRuns - completedRuns - failedRuns;
  const completionRate = totalRuns > 0 ? completedRuns / totalRuns : 0;
  const durations = recentRuns
    .map((run) => run.durationMs)
    .filter((duration): duration is number => duration !== null);
  const totalCostCents = recentRuns.reduce(
    (sum, run) => sum + run.costCents,
    0,
  );

  const judgedHandoffs = journeyEvents.filter(
    (event) => event.kind === "handoff" && typeof event.success === "boolean",
  );
  const handoffSuccessRate =
    judgedHandoffs.length > 0
      ? judgedHandoffs.filter((event) => event.success === true).length /
        judgedHandoffs.length
      : null;

  const warnings: string[] = [];
  const stepSummaries = uniqueSteps(steps).map((step) => {
    const outcomes = runs
      .map((run) => stepOutcome(run, step.id))
      .filter((outcome): outcome is StepRunOutcome => outcome !== null);
    const judgedOutcomes = outcomes.filter(
      (outcome) => outcome.success !== null,
    );
    const successRate =
      judgedOutcomes.length > 0
        ? judgedOutcomes.filter((outcome) => outcome.success === true).length /
          judgedOutcomes.length
        : null;
    const stepDurations = outcomes
      .map((outcome) => outcome.durationMs)
      .filter((duration): duration is number => duration !== null);
    const outgoingHandoffs = judgedHandoffs.filter(
      (event) => (event.fromStepId ?? event.stepId) === step.id,
    );
    const outgoingHandoffSuccessRate =
      outgoingHandoffs.length > 0
        ? outgoingHandoffs.filter((event) => event.success === true).length /
          outgoingHandoffs.length
        : null;
    const journeyGap =
      successRate !== null &&
      successRate >= 0.9 &&
      successRate - completionRate >= 0.2 - Number.EPSILON;
    const handoffGap =
      successRate !== null &&
      successRate >= 0.9 &&
      outgoingHandoffSuccessRate !== null &&
      outgoingHandoffSuccessRate < 0.75;
    const illusoryVictory = journeyGap || handoffGap;
    const stepLabel = step.name ?? step.id;

    if (journeyGap) {
      warnings.push(
        `Vitória ilusória em ${stepLabel}: sucesso local de ${percentage(successRate)} e conclusão da jornada de ${percentage(completionRate)}.`,
      );
    }
    if (handoffGap) {
      warnings.push(
        `Vitória ilusória em ${stepLabel}: sucesso local de ${percentage(successRate)} e handoff de saída de ${percentage(outgoingHandoffSuccessRate)}.`,
      );
    }

    const stepCostCents = outcomes.reduce(
      (sum, outcome) => sum + outcome.costCents,
      0,
    );
    return {
      id: step.id,
      name: step.name ?? null,
      agentId: step.agentId ?? null,
      sequence: step.sequence ?? null,
      executions: outcomes.length,
      completedExecutions: judgedOutcomes.filter(
        (outcome) => outcome.success === true,
      ).length,
      failedExecutions: judgedOutcomes.filter(
        (outcome) => outcome.success === false,
      ).length,
      successRate,
      avgDurationMs: average(stepDurations),
      p95DurationMs: percentile95(stepDurations),
      totalCostCents: stepCostCents,
      avgCostCentsPerExecution:
        outcomes.length > 0 ? stepCostCents / outcomes.length : null,
      judgedHandoffs: outgoingHandoffs.length,
      handoffSuccessRate: outgoingHandoffSuccessRate,
      illusoryVictory,
    } satisfies JourneyStepMonitoringSummary;
  });

  const bottleneck = stepSummaries.reduce<
    JourneyStepMonitoringSummary | null
  >((slowest, step) => {
    if (step.executions === 0 || step.avgDurationMs === null) return slowest;
    if (slowest === null || slowest.avgDurationMs === null) return step;
    return step.avgDurationMs > slowest.avgDurationMs ? step : slowest;
  }, null);

  return {
    totalRuns,
    activeRuns,
    completedRuns,
    failedRuns,
    completionRate,
    avgDurationMs: average(durations),
    p95DurationMs: percentile95(durations),
    totalCostCents,
    avgCostCentsPerRun: totalRuns > 0 ? totalCostCents / totalRuns : null,
    handoffSuccessRate,
    bottleneckStepId: bottleneck?.id ?? null,
    illusoryVictory: stepSummaries.some((step) => step.illusoryVictory),
    warnings,
    steps: stepSummaries,
    recentRuns,
  };
}
