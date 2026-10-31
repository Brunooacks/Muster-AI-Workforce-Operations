import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { agentEvents, metricPoints } from "@workspace/db";
import type { LayerKey } from "@workspace/db";
import { layersFromTelemetry, summarizeEvents, type AgentEventRow } from "./telemetry";

/**
 * RG-M12: eventos validados (aceitos no ingest) viram um ponto diário em
 * metric_points. Um ponto por agente por dia UTC, marcado com timestamp
 * exatamente à meia-noite UTC. O ponto é sempre recalculado a partir de TODOS
 * os eventos do dia, então reprocessar (replay, retry, worker repetido) dá o
 * mesmo resultado: idempotente sem índice novo (sem migração de schema).
 * Concorrência: advisory lock transacional por (agente, dia).
 */
const LAYERS: LayerKey[] = ["efficacy", "efficiency", "adoption", "governance", "value"] as LayerKey[];

export function utcDayStart(ts: Date): Date {
  return new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate()));
}

export interface DailyPoint {
  agentId: string;
  timestamp: Date;
  efficacy: number;
  efficiency: number;
  adoption: number;
  governance: number;
  value: number;
}

/** Puro: ponto do dia a partir dos eventos do dia (heartbeat não conta). Null se não houver evento. */
export function dailyPointFromEvents(agentId: string, day: Date, events: AgentEventRow[]): DailyPoint | null {
  const start = utcDayStart(day).getTime();
  const end = start + 86_400_000;
  const inDay = events.filter(
    (e) => e.agentId === agentId && e.kind !== "heartbeat" && e.ts.getTime() >= start && e.ts.getTime() < end,
  );
  if (inDay.length === 0) return null;
  const layers = layersFromTelemetry(summarizeEvents(inDay, 1));
  const score = (k: LayerKey) => layers[k]?.score ?? 0;
  const point: DailyPoint = { agentId, timestamp: new Date(start), efficacy: 0, efficiency: 0, adoption: 0, governance: 0, value: 0 };
  for (const k of LAYERS) (point as unknown as Record<string, number>)[k] = score(k);
  return point;
}

type Tx = {
  execute: (q: ReturnType<typeof sql>) => Promise<unknown>;
  select: (...a: never[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  delete: (...a: never[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  insert: (...a: never[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** Recalcula (delete + insert) o ponto do dia do evento, dentro da transação do ingest. */
export async function rollupAgentDay(tx: Tx, agentId: string, ts: Date): Promise<DailyPoint | null> {
  const start = utcDayStart(ts);
  const end = new Date(start.getTime() + 86_400_000);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`metric_points:${agentId}:${start.toISOString()}`}))`);
  const rows = await (tx as any)
    .select()
    .from(agentEvents)
    .where(and(eq(agentEvents.agentId, agentId), gte(agentEvents.ts, start), lt(agentEvents.ts, end), ne(agentEvents.kind, "heartbeat")));
  const events: AgentEventRow[] = (rows as any[]).map((row) => ({
    id: row.id, agentId: row.agentId, ts: row.ts, kind: row.kind,
    durationMs: row.durationMs, costCents: row.costCents, tokensIn: row.tokensIn, tokensOut: row.tokensOut,
    success: row.success === null ? null : row.success === 1, metadata: row.metadata ?? null,
  }));
  const point = dailyPointFromEvents(agentId, start, events);
  await (tx as any).delete(metricPoints).where(and(eq(metricPoints.agentId, agentId), eq(metricPoints.timestamp, start)));
  if (point) await (tx as any).insert(metricPoints).values(point);
  return point;
}
