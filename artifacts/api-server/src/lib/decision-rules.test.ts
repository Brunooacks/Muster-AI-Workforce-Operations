import { describe, it, expect } from "vitest";
import {
  DECISION_RULES,
  decideVerdict,
  type DecisionInput,
} from "./decision-rules";

// Healthy defaults: no guardrail rule fires unless a test opts in.
function input(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    healthScore: 70,
    layerScores: {
      efficacy: 70,
      efficiency: 70,
      adoption: 70,
      governance: 70,
      value: 70,
    },
    dataSource: "telemetry",
    totalExecutions: 500,
    windowDays: 30,
    trendDelta: null,
    ...overrides,
  };
}

describe("DECISION_RULES ordering", () => {
  it("keeps the documented order with retire-floor as catch-all", () => {
    expect(DECISION_RULES.map((r) => r.id)).toEqual([
      "insufficient-data",
      "governance-critical-retire",
      "governance-critical-mentor",
      "value-negative",
      "declining-trend",
      "promote",
      "mentor-band",
      "observation-band",
      "retire-floor",
    ]);
    expect(DECISION_RULES.at(-1)?.when(input())).toBe(true);
  });
});

describe("decideVerdict — each rule fires", () => {
  it("insufficient-data: real data with < 20 executions stays in observation", () => {
    const r = decideVerdict(input({ totalExecutions: 19, healthScore: 90 }));
    expect(r.verdict).toBe("observation");
    expect(r.rulesFired[0]).toBe("insufficient-data");
  });

  it("insufficient-data does not apply to seeded evaluations", () => {
    const r = decideVerdict(
      input({ dataSource: "seeded", totalExecutions: 0, healthScore: 70 }),
    );
    expect(r.rulesFired[0]).not.toBe("insufficient-data");
    expect(r.verdict).toBe("mentor");
  });

  it("governance-critical-retire: governance < 30 retires the agent", () => {
    const r = decideVerdict(
      input({ layerScores: { governance: 29 }, healthScore: 85 }),
    );
    expect(r.verdict).toBe("retire");
    expect(r.rulesFired[0]).toBe("governance-critical-retire");
  });

  it("governance-critical-mentor: governance in [30, 45) sends to mentoring", () => {
    const r = decideVerdict(
      input({ layerScores: { governance: 44 }, healthScore: 85 }),
    );
    expect(r.verdict).toBe("mentor");
    expect(r.rulesFired[0]).toBe("governance-critical-mentor");
  });

  it("value-negative: weak value plus weak health retires", () => {
    const r = decideVerdict(
      input({
        layerScores: { governance: 80, value: 35 },
        healthScore: 55,
      }),
    );
    expect(r.verdict).toBe("retire");
    expect(r.rulesFired[0]).toBe("value-negative");
  });

  it("value-negative does not fire when health is strong", () => {
    const r = decideVerdict(
      input({ layerScores: { governance: 80, value: 35 }, healthScore: 80 }),
    );
    expect(r.rulesFired).not.toContain("value-negative");
    expect(r.verdict).toBe("promote");
  });

  it("declining-trend: sharp drop below promote band sends to mentoring", () => {
    const r = decideVerdict(input({ trendDelta: -10, healthScore: 55 }));
    expect(r.verdict).toBe("mentor");
    expect(r.rulesFired[0]).toBe("declining-trend");
  });

  it("declining-trend spares an agent already at promote health", () => {
    const r = decideVerdict(input({ trendDelta: -15, healthScore: 80 }));
    expect(r.verdict).toBe("promote");
    expect(r.rulesFired[0]).toBe("promote");
  });

  it("promote: health ≥ 78 with governance ≥ 60", () => {
    const r = decideVerdict(input({ healthScore: 78 }));
    expect(r.verdict).toBe("promote");
    expect(r.rulesFired[0]).toBe("promote");
  });

  it("promote requires positive governance evidence (missing score blocks it)", () => {
    const r = decideVerdict(input({ healthScore: 90, layerScores: {} }));
    expect(r.verdict).toBe("mentor");
    expect(r.rulesFired[0]).toBe("mentor-band");
  });

  it("mentor-band: health in [62, 78)", () => {
    const r = decideVerdict(input({ healthScore: 62 }));
    expect(r.verdict).toBe("mentor");
    expect(r.rulesFired[0]).toBe("mentor-band");
  });

  it("observation-band: health in [50, 62)", () => {
    const r = decideVerdict(input({ healthScore: 50 }));
    expect(r.verdict).toBe("observation");
    expect(r.rulesFired[0]).toBe("observation-band");
  });

  it("retire-floor: health below 50 with no mitigating rule", () => {
    const r = decideVerdict(input({ healthScore: 49 }));
    expect(r.verdict).toBe("retire");
    expect(r.rulesFired[0]).toBe("retire-floor");
  });
});

describe("decideVerdict — first match wins, audit trail kept", () => {
  it("governance collapse beats value-negative but both are audited", () => {
    const r = decideVerdict(
      input({
        layerScores: { governance: 20, value: 30 },
        healthScore: 40,
      }),
    );
    expect(r.verdict).toBe("retire");
    expect(r.rulesFired[0]).toBe("governance-critical-retire");
    expect(r.rulesFired).toContain("value-negative");
    expect(r.rulesFired).toContain("retire-floor");
  });

  it("insufficient-data overrides everything for thin real data", () => {
    const r = decideVerdict(
      input({
        totalExecutions: 5,
        layerScores: { governance: 10 },
        healthScore: 20,
      }),
    );
    expect(r.verdict).toBe("observation");
    expect(r.rulesFired[0]).toBe("insufficient-data");
  });
});

describe("decideVerdict — confidence", () => {
  it("gives telemetry a higher base than mixed", () => {
    const telemetry = decideVerdict(input({ dataSource: "telemetry" }));
    const mixed = decideVerdict(input({ dataSource: "mixed" }));
    expect(telemetry.confidence).toBeGreaterThan(mixed.confidence);
    expect(telemetry.confidence).toBe(95); // 70 + 20 + 500/100
    expect(mixed.confidence).toBe(75); // 70 + 0 + 500/100
  });

  it("caps confidence at 98 for very high volume", () => {
    const r = decideVerdict(input({ totalExecutions: 100_000 }));
    expect(r.confidence).toBe(98);
  });

  it("keeps seeded confidence in [65, 75] without randomness", () => {
    for (const healthScore of [0, 33, 50, 64, 77, 91, 100]) {
      const r = decideVerdict(
        input({ dataSource: "seeded", totalExecutions: 0, healthScore }),
      );
      expect(r.confidence).toBeGreaterThanOrEqual(65);
      expect(r.confidence).toBeLessThanOrEqual(75);
    }
  });

  it("is fully deterministic for identical inputs", () => {
    const i = input({ dataSource: "seeded", healthScore: 67 });
    expect(decideVerdict(i)).toEqual(decideVerdict(i));
    const j = input({ trendDelta: -12, healthScore: 70 });
    expect(decideVerdict(j)).toEqual(decideVerdict(j));
  });
});

describe("decideVerdict — rationale", () => {
  it("writes a pt-BR rationale citing the deciding rule's key numbers", () => {
    const r = decideVerdict(
      input({ layerScores: { governance: 25 }, healthScore: 80 }),
    );
    expect(r.rationale).toContain("25");
    expect(r.rationale).toContain("80");
    expect(r.rationale.length).toBeGreaterThan(20);
  });

  it("cites execution volume for insufficient data", () => {
    const r = decideVerdict(input({ totalExecutions: 7, windowDays: 14 }));
    expect(r.rationale).toContain("7");
    expect(r.rationale).toContain("14");
  });
});
