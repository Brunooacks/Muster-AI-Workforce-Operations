import { describe, it, expect } from "vitest";
import { dailyPointFromEvents, rollupAgentDay, utcDayStart } from "./metric-points-rollup";
import type { AgentEventRow } from "./telemetry";

const ev = (i: number, over: Partial<AgentEventRow> = {}): AgentEventRow => ({
  id: `e${i}`, agentId: "a1", ts: new Date(Date.UTC(2026, 9, 30, 6, i)), kind: "execution",
  durationMs: 1200, costCents: 3, tokensIn: 10, tokensOut: 20, success: i % 4 !== 0, metadata: null, ...over,
});

// Tx falso: guarda metric_points em memória; select devolve os eventos fornecidos.
function fakeTx(events: AgentEventRow[]) {
  const points: Record<string, unknown>[] = [];
  const tx = {
    execute: async () => undefined,
    select: () => ({ from: () => ({ where: async () => events.map((e) => ({ ...e, success: e.success === null ? null : e.success ? 1 : 0 })) }) }),
    delete: () => ({ where: async () => { points.length = 0; } }),
    insert: () => ({ values: async (v: Record<string, unknown>) => { points.push(v); } }),
  };
  return { tx, points };
}

describe("RG-M12 eventos validados agregam em metric_points (idempotente)", () => {
  it("12 execuções geram um ponto do dia com eficácia real", () => {
    const events = Array.from({ length: 12 }, (_, i) => ev(i));
    const p = dailyPointFromEvents("a1", events[0]!.ts, events)!;
    expect(p.timestamp.toISOString()).toBe("2026-10-30T00:00:00.000Z");
    expect(p.efficacy).toBe(75); // 9 de 12
  });
  it("heartbeat sozinho não gera ponto", () => {
    expect(dailyPointFromEvents("a1", new Date(), [ev(1, { kind: "heartbeat" as never })])).toBeNull();
  });
  it("reprocessar o mesmo dia deixa exatamente um ponto com os mesmos valores", async () => {
    const events = Array.from({ length: 12 }, (_, i) => ev(i));
    const { tx, points } = fakeTx(events);
    await rollupAgentDay(tx as never, "a1", events[3]!.ts);
    const first = JSON.stringify(points);
    await rollupAgentDay(tx as never, "a1", events[7]!.ts);
    await rollupAgentDay(tx as never, "a1", events[11]!.ts);
    expect(points).toHaveLength(1);
    expect(JSON.stringify(points)).toBe(first);
    expect(utcDayStart(events[5]!.ts).toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });
  it("ingest chama o rollup na mesma transação do evento", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../routes/telemetry.ts", import.meta.url), "utf8");
    expect(src).toMatch(/await rollupAgentDay\(transaction/);
  });
});
