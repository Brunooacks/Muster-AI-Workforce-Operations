import assert from "node:assert/strict";
import test from "node:test";
import {
  canHighlightRoi, costBand, hoursFreed, isPartialMonth, productiveHours,
  resolveBaselineSource, suggestionFor, teamCostPerResult, withinTolerance,
} from "./routing-model";

test("productive hours default to 70% of the gross load", () => {
  assert.equal(productiveHours(168), 117.6);
  assert.equal(productiveHours(168, 0.8), 134.4);
  assert.equal(productiveHours(168, 0), 0);
  assert.equal(productiveHours(168, 1.2), 0);
});

test("team cost per result uses productive hours", () => {
  assert.equal(teamCostPerResult({ monthlyHours: 168, hourlyCost: 50, resultsPerMonth: 588 }), 10);
  assert.equal(teamCostPerResult({ monthlyHours: 168, hourlyCost: 50, resultsPerMonth: 0 }), null);
});

test("month is partial below 80% measured coverage; ROI only highlighted at 80%+", () => {
  assert.equal(isPartialMonth(0.79), true);
  assert.equal(isPartialMonth(0.8), false);
  assert.equal(canHighlightRoi(0.5), false);
  assert.equal(canHighlightRoi(0.95), true);
});

test("declared baseline becomes measured with imported history or 30 parallel days", () => {
  assert.equal(resolveBaselineSource({ historyImported: false, parallelDays: 29 }), "declared");
  assert.equal(resolveBaselineSource({ historyImported: false, parallelDays: 30 }), "measured");
  assert.equal(resolveBaselineSource({ historyImported: true, parallelDays: 0 }), "measured");
});

test("cost band and suggestion: red returns the activity to the team", () => {
  assert.equal(costBand(4, 10), "green");
  assert.equal(costBand(9, 10), "yellow");
  assert.equal(costBand(11, 10), "red");
  assert.equal(costBand(1, 0), "red");
  assert.equal(suggestionFor("red"), "return_to_team");
  assert.equal(suggestionFor("yellow"), "adjust");
  assert.equal(suggestionFor("green"), "keep");
});

test("tolerance and hours freed", () => {
  assert.equal(withinTolerance(0.47, 0.4, 0.1), true);
  assert.equal(withinTolerance(0.55, 0.4, 0.1), false);
  assert.equal(hoursFreed(1200, 12), 240);
});
