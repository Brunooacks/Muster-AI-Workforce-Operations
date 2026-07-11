import type { LayerKey } from "@workspace/db";
import { metricTargetStatus } from "@workspace/metrics";

/**
 * Pure aggregation of raw agent telemetry events into a windowed summary and
 * per-layer KPI metrics derived from REAL data (as opposed to the seeded
 * values in discovery.ts). Rows are plain objects so this module has no
 * dependency on the drizzle table being added in parallel.
 *
 * Everything here is deterministic: no Math.random, no Date.now — outputs are
 * a pure function of the input rows and the window.
 */

export interface AgentEventRow {
  id: string;
  agentId: string;
  ts: Date; // event timestamp
  kind: "execution" | "error" | "escalation" | "feedback";
  durationMs: number | null;
  costCents: number | null; // integer cents (BRL)
  tokensIn: number | null;
  tokensOut: number | null;
  success: boolean | null; // for kind=execution
  metadata: Record<string, unknown> | null;
}

export interface TelemetrySummary {
  windowDays: number;
  totalExecutions: number;
  successRate: number | null;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  totalCostCents: number;
  avgCostCentsPerExecution: number | null;
  executionsPerDay: number;
  escalationRate: number | null;
  errorRate: number | null;
  activeDays: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface TelemetryMetric {
  label: string;
  value: number;
  unit: string;
  trend: number;
  direction: "up" | "down" | "flat";
  target?: string;
}

export interface TelemetryLayerResult {
  score: number;
  metrics: TelemetryMetric[];
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// p95 via sorted index (nearest-rank): sorted[ceil(0.95 * n) - 1].
function p95(sortedAsc: number[]): number | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil(0.95 * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

/**
 * Aggregate raw events into a summary over an observation window.
 *
 * - successRate: successes / executions, among kind=execution rows where
 *   `success` is not null. Null when there is no such row.
 * - Durations (avg/p95) come from kind=execution rows with a non-null
 *   durationMs — they describe response time of executions.
 * - totalCostCents sums cost across ALL kinds (errors and retries cost too).
 * - executionsPerDay uses windowDays as the denominator; activeDays is the
 *   count of distinct (UTC) days that saw any event.
 * - escalationRate / errorRate are relative to executions (null when there
 *   are no executions — a rate over zero work is meaningless).
 */
export function summarizeEvents(
  events: AgentEventRow[],
  windowDays: number,
): TelemetrySummary {
  const executions = events.filter((e) => e.kind === "execution");
  const totalExecutions = executions.length;

  const judged = executions.filter((e) => e.success !== null);
  const successRate =
    judged.length > 0
      ? judged.filter((e) => e.success === true).length / judged.length
      : null;

  const durations = executions
    .map((e) => e.durationMs)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const avgDurationMs =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;
  const p95DurationMs = p95(durations);

  const totalCostCents = events.reduce(
    (sum, e) => sum + (e.costCents ?? 0),
    0,
  );
  const avgCostCentsPerExecution =
    totalExecutions > 0 ? totalCostCents / totalExecutions : null;

  const escalations = events.filter((e) => e.kind === "escalation").length;
  const errors = events.filter((e) => e.kind === "error").length;
  const escalationRate =
    totalExecutions > 0 ? escalations / totalExecutions : null;
  const errorRate = totalExecutions > 0 ? errors / totalExecutions : null;

  const dayKeys = new Set(events.map((e) => e.ts.toISOString().slice(0, 10)));
  const activeDays = dayKeys.size;

  const executionsPerDay = totalExecutions / Math.max(1, windowDays);

  let firstEventAt: string | null = null;
  let lastEventAt: string | null = null;
  for (const e of events) {
    const iso = e.ts.toISOString();
    if (firstEventAt === null || iso < firstEventAt) firstEventAt = iso;
    if (lastEventAt === null || iso > lastEventAt) lastEventAt = iso;
  }

  return {
    windowDays,
    totalExecutions,
    successRate,
    avgDurationMs,
    p95DurationMs,
    totalCostCents,
    avgCostCentsPerExecution,
    executionsPerDay,
    escalationRate,
    errorRate,
    activeDays,
    firstEventAt,
    lastEventAt,
  };
}

/**
 * Derive per-layer KPI metrics from REAL telemetry. Layers without enough
 * data are OMITTED so the caller can merge these on top of the seeded
 * fallback evaluation. Trends are 0/"flat" for v1 (a single window has no
 * comparison point).
 *
 * Targets reuse the catalog vocabulary (metric-catalog.ts / discovery.ts)
 * and are all parseable by metricTargetStatus.
 */
export function layersFromTelemetry(
  summary: TelemetrySummary,
): Partial<Record<LayerKey, TelemetryLayerResult>> {
  const layers: Partial<Record<LayerKey, TelemetryLayerResult>> = {};

  const metric = (
    label: string,
    value: number,
    unit: string,
    target?: string,
  ): TelemetryMetric => ({
    label,
    value,
    unit,
    trend: 0,
    direction: "flat",
    ...(target ? { target } : {}),
  });

  // Efficacy — success rate of real executions.
  if (summary.successRate !== null) {
    const pct = round(summary.successRate * 100, 1);
    layers.efficacy = {
      score: Math.round(clamp(summary.successRate * 100, 0, 100)),
      metrics: [metric("Taxa de sucesso", pct, "%", "≥ 90%")],
    };
  }

  // Efficiency — response time and unit cost. Score is goal attainment:
  // 40 baseline + 60 * share of metrics on target (100 when both are on).
  {
    const metrics: TelemetryMetric[] = [];
    if (summary.avgDurationMs !== null) {
      metrics.push(
        metric(
          "Tempo de resposta",
          round(summary.avgDurationMs / 1000, 2),
          "s",
          "< 3 s",
        ),
      );
    }
    if (summary.avgCostCentsPerExecution !== null) {
      metrics.push(
        metric(
          "Custo por execução",
          round(summary.avgCostCentsPerExecution / 100, 2),
          "R$",
          "R$ 0,10–0,40",
        ),
      );
    }
    if (metrics.length > 0) {
      const statuses = metrics
        .map((m) => metricTargetStatus(m.value, m.target))
        .filter((s): s is "on" | "off" => s !== null);
      const attainment =
        statuses.length > 0
          ? statuses.filter((s) => s === "on").length / statuses.length
          : 0.5;
      layers.efficiency = {
        score: Math.round(clamp(40 + 60 * attainment, 0, 100)),
        metrics,
      };
    }
  }

  // Adoption — real usage volume plus consistency of use across the window.
  if (summary.totalExecutions > 0) {
    const perDay = round(summary.executionsPerDay, 1);
    const volumeComponent = (summary.executionsPerDay / 50) * 80;
    const consistencyComponent =
      (summary.activeDays / Math.max(1, summary.windowDays)) * 20;
    layers.adoption = {
      score: Math.round(
        clamp(Math.min(100, volumeComponent + consistencyComponent), 0, 100),
      ),
      metrics: [metric("Execuções por dia", perDay, "/dia", "≥ 50")],
    };
  }

  // Governance — escalation and error discipline. Score starts at 100 and is
  // penalized by how far each rate exceeds its tolerance (errors weigh more).
  if (summary.escalationRate !== null || summary.errorRate !== null) {
    const metrics: TelemetryMetric[] = [];
    let penalty = 0;
    if (summary.escalationRate !== null) {
      const escPct = round(summary.escalationRate * 100, 1);
      metrics.push(metric("Escalonamento", escPct, "%", "≤ 20%"));
      penalty += Math.max(0, escPct - 20) * 1.5;
    }
    if (summary.errorRate !== null) {
      const errPct = round(summary.errorRate * 100, 1);
      metrics.push(metric("Taxa de erro", errPct, "%", "≤ 5%"));
      penalty += Math.max(0, errPct - 5) * 3;
    }
    layers.governance = {
      score: Math.round(clamp(100 - penalty, 0, 100)),
      metrics,
    };
  }

  // Value — real spend is informational (cost alone proves no value), so the
  // layer gets a neutral score and surfaces the consolidated monthly cost.
  if (summary.totalCostCents > 0) {
    const totalReais = summary.totalCostCents / 100;
    const useThousands = totalReais >= 1000;
    layers.value = {
      score: 50,
      metrics: [
        metric(
          "Custo total mensal",
          useThousands ? round(totalReais / 1000, 1) : round(totalReais, 2),
          useThousands ? "R$ mil" : "R$",
          "—",
        ),
      ],
    };
  }

  return layers;
}
