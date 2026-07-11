import { describe, it, expect } from "vitest";
import {
  summarizeEvents,
  layersFromTelemetry,
  type AgentEventRow,
  type TelemetrySummary,
} from "./telemetry";

let seq = 0;
function event(overrides: Partial<AgentEventRow> = {}): AgentEventRow {
  seq += 1;
  return {
    id: `evt-${seq}`,
    agentId: "agent-1",
    ts: new Date("2026-07-01T12:00:00.000Z"),
    kind: "execution",
    durationMs: null,
    costCents: null,
    tokensIn: null,
    tokensOut: null,
    success: null,
    metadata: null,
    ...overrides,
  };
}

function emptySummary(windowDays = 30): TelemetrySummary {
  return summarizeEvents([], windowDays);
}

describe("summarizeEvents", () => {
  it("returns a fully-null/zero summary for no events", () => {
    const s = summarizeEvents([], 30);
    expect(s).toEqual({
      windowDays: 30,
      totalExecutions: 0,
      successRate: null,
      avgDurationMs: null,
      p95DurationMs: null,
      totalCostCents: 0,
      avgCostCentsPerExecution: null,
      executionsPerDay: 0,
      escalationRate: null,
      errorRate: null,
      activeDays: 0,
      firstEventAt: null,
      lastEventAt: null,
    });
  });

  it("aggregates mixed kinds: rates relative to executions only", () => {
    const events = [
      event({ kind: "execution", success: true, durationMs: 1000, costCents: 20 }),
      event({ kind: "execution", success: true, durationMs: 2000, costCents: 30 }),
      event({ kind: "execution", success: false, durationMs: 3000, costCents: 40 }),
      // success=null execution: counts for volume, not for successRate.
      event({ kind: "execution", success: null, durationMs: 2000, costCents: 10 }),
      event({ kind: "error", costCents: 5 }),
      event({ kind: "escalation" }),
      event({ kind: "escalation" }),
      event({ kind: "feedback" }),
    ];
    const s = summarizeEvents(events, 10);
    expect(s.totalExecutions).toBe(4);
    expect(s.successRate).toBeCloseTo(2 / 3, 10);
    expect(s.avgDurationMs).toBe(2000);
    expect(s.totalCostCents).toBe(105); // error cost counts too
    expect(s.avgCostCentsPerExecution).toBeCloseTo(105 / 4, 10);
    expect(s.escalationRate).toBeCloseTo(2 / 4, 10);
    expect(s.errorRate).toBeCloseTo(1 / 4, 10);
    expect(s.executionsPerDay).toBeCloseTo(4 / 10, 10);
  });

  it("keeps successRate null when no execution has a judged outcome", () => {
    const s = summarizeEvents(
      [event({ kind: "execution", success: null }), event({ kind: "error" })],
      7,
    );
    expect(s.totalExecutions).toBe(1);
    expect(s.successRate).toBeNull();
    expect(s.errorRate).toBe(1);
  });

  it("computes p95 via nearest-rank sorted index", () => {
    // 20 executions with durations 100..2000 → p95 index ceil(0.95*20)-1 = 18.
    const events = Array.from({ length: 20 }, (_, i) =>
      event({ kind: "execution", durationMs: (i + 1) * 100 }),
    );
    const s = summarizeEvents(events, 30);
    expect(s.p95DurationMs).toBe(1900);
  });

  it("uses the max duration as p95 for a single sample", () => {
    const s = summarizeEvents([event({ durationMs: 1234 })], 30);
    expect(s.p95DurationMs).toBe(1234);
    expect(s.avgDurationMs).toBe(1234);
  });

  it("counts distinct UTC days as activeDays and tracks first/last event", () => {
    const events = [
      event({ ts: new Date("2026-07-01T08:00:00.000Z") }),
      event({ ts: new Date("2026-07-01T23:59:00.000Z") }),
      event({ ts: new Date("2026-07-03T10:00:00.000Z"), kind: "feedback" }),
      event({ ts: new Date("2026-07-05T10:00:00.000Z"), kind: "error" }),
    ];
    const s = summarizeEvents(events, 30);
    expect(s.activeDays).toBe(3);
    expect(s.firstEventAt).toBe("2026-07-01T08:00:00.000Z");
    expect(s.lastEventAt).toBe("2026-07-05T10:00:00.000Z");
  });

  it("divides executionsPerDay by the window, not by activeDays", () => {
    const events = Array.from({ length: 30 }, () =>
      event({ ts: new Date("2026-07-01T12:00:00.000Z") }),
    );
    const s = summarizeEvents(events, 30);
    expect(s.activeDays).toBe(1);
    expect(s.executionsPerDay).toBe(1);
  });
});

describe("layersFromTelemetry", () => {
  it("omits every layer when there is no data", () => {
    expect(layersFromTelemetry(emptySummary())).toEqual({});
  });

  it("derives efficacy from successRate with a clamped score", () => {
    const s: TelemetrySummary = { ...emptySummary(), successRate: 0.955 };
    const layers = layersFromTelemetry(s);
    expect(layers.efficacy?.score).toBe(96);
    const m = layers.efficacy?.metrics[0];
    expect(m).toMatchObject({
      label: "Taxa de sucesso",
      value: 95.5,
      unit: "%",
      target: "≥ 90%",
      trend: 0,
      direction: "flat",
    });
  });

  it("scores efficiency 100 when both metrics are on target", () => {
    const s: TelemetrySummary = {
      ...emptySummary(),
      avgDurationMs: 2000, // 2 s < 3 s → on
      avgCostCentsPerExecution: 25, // R$ 0,25 in 0,10–0,40 → on
    };
    const layers = layersFromTelemetry(s);
    expect(layers.efficiency?.score).toBe(100);
    expect(layers.efficiency?.metrics.map((m) => m.label)).toEqual([
      "Tempo de resposta",
      "Custo por execução",
    ]);
    expect(layers.efficiency?.metrics[0]?.value).toBe(2);
    expect(layers.efficiency?.metrics[1]?.value).toBe(0.25);
  });

  it("scores efficiency at the floor when both metrics miss target", () => {
    const s: TelemetrySummary = {
      ...emptySummary(),
      avgDurationMs: 8000, // 8 s ≥ 3 s → off
      avgCostCentsPerExecution: 90, // R$ 0,90 out of range → off
    };
    expect(layersFromTelemetry(s).efficiency?.score).toBe(40);
  });

  it("blends efficiency when only one of two metrics is on target", () => {
    const s: TelemetrySummary = {
      ...emptySummary(),
      avgDurationMs: 2000, // on
      avgCostCentsPerExecution: 90, // off
    };
    expect(layersFromTelemetry(s).efficiency?.score).toBe(70);
  });

  it("emits efficiency with a single metric when only duration exists", () => {
    const s: TelemetrySummary = { ...emptySummary(), avgDurationMs: 1500 };
    const layers = layersFromTelemetry(s);
    expect(layers.efficiency?.metrics).toHaveLength(1);
    expect(layers.efficiency?.metrics[0]?.label).toBe("Tempo de resposta");
  });

  it("scales adoption by volume and active-day consistency", () => {
    const s: TelemetrySummary = {
      ...emptySummary(30),
      totalExecutions: 1500,
      executionsPerDay: 50, // exactly at target → 80 points
      activeDays: 30, // full consistency → 20 points
    };
    const layers = layersFromTelemetry(s);
    expect(layers.adoption?.score).toBe(100);
    expect(layers.adoption?.metrics[0]).toMatchObject({
      label: "Execuções por dia",
      value: 50,
      unit: "/dia",
      target: "≥ 50",
    });
  });

  it("caps adoption at 100 even with very high volume", () => {
    const s: TelemetrySummary = {
      ...emptySummary(30),
      totalExecutions: 30000,
      executionsPerDay: 1000,
      activeDays: 30,
    };
    expect(layersFromTelemetry(s).adoption?.score).toBe(100);
  });

  it("keeps governance at 100 when rates are within tolerance", () => {
    const s: TelemetrySummary = {
      ...emptySummary(),
      totalExecutions: 100,
      escalationRate: 0.2, // exactly at ≤ 20%
      errorRate: 0.05, // exactly at ≤ 5%
    };
    const layers = layersFromTelemetry(s);
    expect(layers.governance?.score).toBe(100);
    expect(layers.governance?.metrics.map((m) => m.label)).toEqual([
      "Escalonamento",
      "Taxa de erro",
    ]);
  });

  it("penalizes governance for rates above tolerance", () => {
    const s: TelemetrySummary = {
      ...emptySummary(),
      totalExecutions: 100,
      escalationRate: 0.4, // 40% → 20 over → -30
      errorRate: 0.15, // 15% → 10 over → -30
    };
    expect(layersFromTelemetry(s).governance?.score).toBe(40);
  });

  it("omits value when there is no cost, includes it in R$ when small", () => {
    expect(layersFromTelemetry(emptySummary()).value).toBeUndefined();

    const s: TelemetrySummary = { ...emptySummary(), totalCostCents: 4550 };
    const layers = layersFromTelemetry(s);
    expect(layers.value?.metrics[0]).toMatchObject({
      label: "Custo total mensal",
      value: 45.5,
      unit: "R$",
    });
  });

  it("switches value to R$ mil at scale", () => {
    const s: TelemetrySummary = {
      ...emptySummary(),
      totalCostCents: 250_000, // R$ 2.500 → 2,5 mil
    };
    const layers = layersFromTelemetry(s);
    expect(layers.value?.metrics[0]).toMatchObject({
      value: 2.5,
      unit: "R$ mil",
    });
  });

  it("reports every telemetry metric with flat trend in v1", () => {
    const s: TelemetrySummary = {
      ...emptySummary(30),
      successRate: 0.9,
      avgDurationMs: 2000,
      avgCostCentsPerExecution: 25,
      totalExecutions: 300,
      executionsPerDay: 10,
      activeDays: 20,
      escalationRate: 0.1,
      errorRate: 0.01,
      totalCostCents: 7500,
    };
    const layers = layersFromTelemetry(s);
    for (const layer of Object.values(layers)) {
      for (const m of layer.metrics) {
        expect(m.trend).toBe(0);
        expect(m.direction).toBe("flat");
      }
    }
  });
});
