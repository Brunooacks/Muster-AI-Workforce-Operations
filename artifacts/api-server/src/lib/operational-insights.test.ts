import { describe, expect, it } from "vitest";
import {
  analyzeTrendAndAnomaly,
  assessFreshness,
  calculateOperationalScore,
  classifyConfidence,
  prioritizeOperationalInsights,
} from "./operational-insights";

const freshnessPolicy = {
  expectedWithinMinutes: 15,
  staleAfterMinutes: 60,
  expiresAfterMinutes: 120,
};

describe("operational insight primitives", () => {
  it("classifies freshness through the complete lifecycle", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");

    expect(assessFreshness("2026-08-23T11:50:00.000Z", now, freshnessPolicy)).toMatchObject({
      status: "fresh",
      ageMinutes: 10,
      score: 100,
      decisionEligible: true,
    });
    expect(assessFreshness("2026-08-23T11:30:00.000Z", now, freshnessPolicy).status).toBe("aging");
    expect(assessFreshness("2026-08-23T10:30:00.000Z", now, freshnessPolicy)).toMatchObject({
      status: "stale",
      decisionEligible: false,
    });
    expect(assessFreshness("2026-08-23T08:00:00.000Z", now, freshnessPolicy).status).toBe("expired");
    expect(assessFreshness(null, now, freshnessPolicy).status).toBe("missing");
  });

  it("creates confidence bands with explicit decision eligibility", () => {
    expect(classifyConfidence(45)).toMatchObject({ band: "insufficient", decisionEligible: false });
    expect(classifyConfidence(75)).toMatchObject({ band: "indicative", decisionEligible: false });
    expect(classifyConfidence(85)).toMatchObject({ band: "reliable", decisionEligible: true });
    expect(classifyConfidence(94)).toMatchObject({ band: "decision-grade", decisionEligible: true });
  });

  it("combines layer performance with data readiness and caps breached guardrails", () => {
    const healthy = calculateOperationalScore({
      layers: { efficacy: 80, efficiency: 80, adoption: 80, governance: 80, value: 80 },
      freshnessScore: 100,
      confidence: 100,
    });
    expect(healthy).toMatchObject({
      score: 80,
      baseScore: 80,
      evidenceModifier: 100,
      layerCoverage: 100,
      band: "controlled",
      decisionEligible: true,
    });

    const breached = calculateOperationalScore({
      layers: { efficacy: 95, efficiency: 95, adoption: 95, governance: 95, value: 95 },
      freshnessScore: 100,
      confidence: 100,
      guardrailBreached: true,
    });
    expect(breached.score).toBe(49);
    expect(breached.band).toBe("critical");
    expect(breached.reasons).toContain("guardrail violado");
  });

  it("detects directional improvement and anomalies without an external model", () => {
    const decreasingLatency = analyzeTrendAndAnomaly(
      [100, 92, 84, 76, 68].map((value, index) => ({
        value,
        observedAt: `2026-08-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
      })),
      "lower-is-better",
    );
    expect(decreasingLatency.trend).toBe("improving");

    const spike = analyzeTrendAndAnomaly(
      [10, 10, 10, 10, 30].map((value, index) => ({
        value,
        observedAt: `2026-08-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
      })),
      "higher-is-better",
    );
    expect(spike).toMatchObject({ trend: "improving", anomaly: "spike", latestZScore: 10 });
  });

  it("refuses a relative change when the early average is zero", () => {
    const series = [0, 0, 10, 10].map((value, index) => ({
      value,
      observedAt: `2026-08-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
    }));

    const rising = analyzeTrendAndAnomaly(series, "higher-is-better");
    expect(rising).toMatchObject({
      trend: "insufficient-data",
      relativeChangePercent: null,
      reason: "zero_baseline",
      absoluteChange: 10,
      pointsAnalyzed: 4,
    });
    expect(rising.anomaly).not.toBe("insufficient-data");

    const falling = analyzeTrendAndAnomaly(series, "lower-is-better");
    expect(falling).toMatchObject({
      trend: "insufficient-data",
      relativeChangePercent: null,
      reason: "zero_baseline",
      absoluteChange: 10,
    });
  });

  it("keeps directionless series stable but still drops the relative change on a zero baseline", () => {
    const informational = analyzeTrendAndAnomaly(
      [0, 0, 10, 10].map((value, index) => ({
        value,
        observedAt: `2026-08-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
      })),
      "informational",
    );

    expect(informational).toMatchObject({
      trend: "stable",
      relativeChangePercent: null,
      reason: "zero_baseline",
      absoluteChange: 10,
    });
  });

  it("keeps a flat zero series stable without a zero_baseline reason", () => {
    const flat = analyzeTrendAndAnomaly(
      [0, 0, 0, 0].map((value, index) => ({
        value,
        observedAt: `2026-08-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
      })),
      "higher-is-better",
    );

    expect(flat).toMatchObject({
      trend: "stable",
      relativeChangePercent: 0,
      anomaly: "none",
    });
    expect(flat.reason).toBeUndefined();
  });

  it("keeps the relative change untouched when the early average is not zero", () => {
    const growing = analyzeTrendAndAnomaly(
      [10, 10, 20, 20].map((value, index) => ({
        value,
        observedAt: `2026-08-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
      })),
      "higher-is-better",
    );

    expect(growing).toMatchObject({
      trend: "improving",
      relativeChangePercent: 100,
    });
    expect(growing.reason).toBeUndefined();
  });

  it("prioritizes guardrails, impact, freshness and SLA deterministically", () => {
    const ordered = prioritizeOperationalInsights([
      {
        id: "adoption",
        entityId: "agent-1",
        entityName: "Agente 1",
        category: "adoption",
        title: "Adoção em queda",
        explanation: "Uso abaixo do baseline.",
        recommendation: "Revisar workflow com usuários.",
        severity: "medium",
        impact: 55,
        confidence: 80,
        freshness: "fresh",
        guardrail: false,
      },
      {
        id: "governance",
        entityId: "agent-2",
        entityName: "Agente 2",
        category: "governance",
        title: "Guardrail violado",
        explanation: "Saída fora da política.",
        recommendation: "Conter autonomia e revisar evidência.",
        severity: "critical",
        impact: 95,
        confidence: 95,
        freshness: "fresh",
        guardrail: true,
        slaRisk: true,
        affectedExecutions: 1_000,
      },
    ]);

    expect(ordered[0]).toMatchObject({ id: "governance", priority: "now", dueWithinMinutes: 60 });
    expect(ordered[0]!.priorityScore).toBeGreaterThan(ordered[1]!.priorityScore);
  });
});
