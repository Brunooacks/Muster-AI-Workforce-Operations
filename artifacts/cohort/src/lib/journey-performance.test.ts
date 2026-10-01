import assert from "node:assert/strict";
import test from "node:test";
import { isActionableJourneyBottleneck } from "./journey-performance";

test("não transforma a etapa mais lenta em gargalo quando o SLA é cumprido", () => {
  assert.equal(isActionableJourneyBottleneck({
    totalRuns: 5,
    p95DurationMs: 25 * 60_000,
    bottleneckStepId: "human-review",
    slaMinutes: 45,
  }), false);
});

test("sinaliza gargalo quando o p95 excede o SLA", () => {
  assert.equal(isActionableJourneyBottleneck({
    totalRuns: 8,
    p95DurationMs: 51 * 60_000,
    bottleneckStepId: "agent-review",
    slaMinutes: 45,
  }), true);
});

test("não sinaliza gargalo sem amostra ou etapa observada", () => {
  assert.equal(isActionableJourneyBottleneck({
    totalRuns: 0,
    p95DurationMs: 0,
    bottleneckStepId: "agent-review",
    slaMinutes: 45,
  }), false);
  assert.equal(isActionableJourneyBottleneck({
    totalRuns: 4,
    p95DurationMs: 60 * 60_000,
    bottleneckStepId: null,
    slaMinutes: 45,
  }), false);
});
