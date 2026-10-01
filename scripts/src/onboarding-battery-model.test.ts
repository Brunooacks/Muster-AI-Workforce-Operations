import { describe, expect, it } from "vitest";
import { buildOnboardingBattery } from "./onboarding-battery-model";

describe("buildOnboardingBattery", () => {
  it("creates comparable baseline and candidate execution windows", () => {
    const battery = buildOnboardingBattery(
      new Date("2026-09-05T15:00:00.000Z"),
    );
    const executions = battery.events.filter(
      (event) => event.kind === "execution",
    );
    const baseline = executions.filter(
      (event) => event.metadata.cycle === "baseline",
    );
    const candidate = executions.filter(
      (event) => event.metadata.cycle === "candidate",
    );

    expect(baseline).toHaveLength(48);
    expect(candidate).toHaveLength(48);
    expect(baseline.filter((event) => event.success).length).toBe(45);
    expect(candidate.filter((event) => event.success).length).toBe(36);
  });

  it("adds errors, escalations and human corrections to the degraded cycle", () => {
    const battery = buildOnboardingBattery(
      new Date("2026-09-05T15:00:00.000Z"),
    );

    expect(battery.events.filter((event) => event.kind === "error")).toHaveLength(12);
    expect(battery.events.filter((event) => event.kind === "escalation")).toHaveLength(8);
    expect(battery.events.filter((event) => event.kind === "feedback")).toHaveLength(5);
    expect(battery.events).toHaveLength(121);
  });
});
