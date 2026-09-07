import { describe, expect, it } from "vitest";
import { buildExecutiveMonthlyReport, executivePeriodBounds } from "./executive-reporting";

const agent = {
  id: "agent-1",
  name: "Atlas",
  platform: "github",
  status: "active" as const,
  currentVerdict: "promote" as const,
  severity: "stable" as const,
  healthScore: 90,
  admittedAt: new Date("2026-06-01T00:00:00Z"),
};

function point(id: string, timestamp: string, value: number) {
  return {
    id,
    agentId: agent.id,
    timestamp: new Date(timestamp),
    efficacy: value,
    efficiency: value,
    adoption: value,
    governance: value,
    value,
  };
}

function execution(id: string, timestamp: string, success: number, costCents: number) {
  return {
    id,
    agentId: agent.id,
    ts: new Date(timestamp),
    kind: "execution" as const,
    durationMs: 1_000,
    costCents,
    success,
  };
}

describe("executive monthly reporting", () => {
  it("valida e calcula os limites UTC do período", () => {
    const bounds = executivePeriodBounds("2026-01");
    expect(bounds.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(bounds.previousPeriod).toBe("2025-12");
    expect(() => executivePeriodBounds("2026-13")).toThrow("YYYY-MM");
  });

  it("compara o mês atual com o anterior sem depender de valor financeiro", () => {
    const events = [
      ...Array.from({ length: 40 }, (_, index) => execution(`jul-${index}`, "2026-07-10T10:00:00Z", index < 32 ? 1 : 0, 12)),
      ...Array.from({ length: 50 }, (_, index) => execution(`ago-${index}`, "2026-08-10T10:00:00Z", index < 45 ? 1 : 0, 10)),
    ];
    const report = buildExecutiveMonthlyReport({
      period: "2026-08",
      now: new Date("2026-08-31T12:00:00Z"),
      agents: [agent],
      events,
      points: [point("jul", "2026-07-15T00:00:00Z", 75), point("ago", "2026-08-15T00:00:00Z", 84)],
      evaluations: [{ id: "eval", agentId: agent.id, evaluatedAt: new Date("2026-08-20T00:00:00Z"), verdict: "promote", verdictConfidence: 92 }],
      alerts: [],
    });

    expect(report.metrics.executionCount.current).toBe(50);
    expect(report.metrics.successRate.current).toBe(90);
    expect(report.metrics.operationalScore.delta).toBe(9);
    expect(report.layerComparison.governance.current).toBe(84);
    expect(report.quality.decisionReady).toBe(true);
    expect(report.executiveSummary).toContain("execuções");
    expect(report.sections.some((section) => section.key === "risk-governance")).toBe(true);
  });

  it("bloqueia decisões quando cobertura e amostra são insuficientes", () => {
    const report = buildExecutiveMonthlyReport({
      period: "2026-08",
      now: new Date("2026-08-31T12:00:00Z"),
      agents: [agent],
      events: [],
      points: [],
      evaluations: [],
      alerts: [],
    });

    expect(report.quality.decisionReady).toBe(false);
    expect(report.quality.limitations.length).toBeGreaterThan(0);
    expect(report.insights.some((insight) => insight.category === "data-quality")).toBe(true);
  });
});
