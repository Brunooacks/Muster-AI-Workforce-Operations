import { describe, expect, it } from "vitest";
import type { KpiLayer } from "@workspace/db";
import { buildFleetInsights } from "./fleet-insights";

const layer = (key: KpiLayer["key"], score: number): KpiLayer => ({
  key,
  label: key,
  score,
  severity: score >= 80 ? "stable" : score >= 65 ? "medium" : score >= 50 ? "high" : "critical",
  metrics: [],
});

const completeLayers = (score: number, governance = score): KpiLayer[] => [
  layer("efficacy", score),
  layer("efficiency", score),
  layer("adoption", score),
  layer("governance", governance),
  layer("value", score),
];

describe("fleet insights", () => {
  it("keeps a fresh, decision-grade fleet eligible", () => {
    const result = buildFleetInsights({
      now: new Date("2026-08-23T12:00:00.000Z"),
      agents: [{ id: "healthy", name: "Healthy", platform: "local", monthlyVolume: 500 }],
      evaluations: [{
        agentId: "healthy",
        evaluatedAt: new Date("2026-08-23T11:00:00.000Z"),
        layers: completeLayers(90),
        verdictConfidence: 95,
      }],
      points: [],
    });

    expect(result.coverage).toMatchObject({ freshAgents: 1, decisionGradeAgents: 1 });
    expect(result.agents[0]).toMatchObject({ operationalScore: 89.1, decisionEligible: true });
    expect(result.insights).toEqual([]);
  });

  it("prioritizes expired data and governance breach before low score", () => {
    const result = buildFleetInsights({
      now: new Date("2026-08-23T12:00:00.000Z"),
      agents: [{ id: "risk", name: "Risk", platform: "cloud", monthlyVolume: 2_000 }],
      evaluations: [{
        agentId: "risk",
        evaluatedAt: new Date("2026-08-18T12:00:00.000Z"),
        layers: completeLayers(85, 40),
        verdictConfidence: 92,
      }],
      points: [],
    });

    expect(result.coverage.staleAgents).toBe(1);
    expect(result.agents[0]).toMatchObject({ operationalScore: 49, decisionEligible: false });
    expect(result.insights.map((insight) => insight.id)).toEqual([
      "risk:freshness",
      "risk:guardrail",
    ]);
    expect(result.insights.every((insight) => insight.priority === "now")).toBe(true);
  });
});
