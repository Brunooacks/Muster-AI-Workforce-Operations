import { describe, expect, it } from "vitest";
import { telemetryAlertPlan } from "./telemetry-alert-policy";

describe("telemetryAlertPlan", () => {
  const evaluatedAt = new Date("2026-09-05T20:00:00.000Z");

  it("opens a bounded mentorship alert", () => {
    const plan = telemetryAlertPlan({
      verdict: "mentor",
      healthScore: 65,
      rationale: "Erro acima da meta.",
      evaluatedAt,
    });

    expect(plan?.severity).toBe("medium");
    expect(plan?.patternType).toBe("telemetry-performance");
    expect(plan?.dueAt.toISOString()).toBe("2026-09-12T20:00:00.000Z");
  });

  it("does not keep an alert for a healthy verdict", () => {
    expect(
      telemetryAlertPlan({
        verdict: "promote",
        healthScore: 92,
        rationale: "Contrato atendido.",
        evaluatedAt,
      }),
    ).toBeNull();
  });
});
