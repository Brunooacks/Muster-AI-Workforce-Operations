import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALC_VERSION,
  computeOutcome,
  normalizeTasks,
  type OutcomeContract,
  type OutcomeEventRow,
  type OutcomeResult,
} from "./outcome-layers";
import type { HourlyRateInput } from "./value/cost-per-validated-task";

/**
 * Golden test da camada 1 (cunha · C4.3): 3 agentes sintéticos, valores
 * calculados à mão em specs/004-cunha/golden.csv (as contas estão em
 * formula.md). O cálculo precisa bater ao centavo.
 */

const CSV = join(import.meta.dirname, "../../../../specs/004-cunha/golden.csv");

let n = 0;
function ev(over: Partial<OutcomeEventRow>): OutcomeEventRow {
  n += 1;
  return {
    id: `g_${String(n).padStart(3, "0")}`,
    kind: "execution",
    ts: `2026-10-${String(1 + (n % 28)).padStart(2, "0")}T12:00:00.000Z`,
    taskId: null, runId: null, attempt: null, costCents: null, tokensIn: null, tokensOut: null, contextTokens: null,
    model: null, capabilities: null, success: true, expected: null, actual: null, acceptedBy: null,
    acceptedByKind: null, acceptedRuleVersion: null, humanMinutes: null, reworkCount: null,
    ...over,
  };
}
const run = (taskId: string, runId: string, attempt: number, costCents: number, over: Partial<OutcomeEventRow> = {}) =>
  ev({ taskId, runId, attempt, costCents, ...over });
const review = (taskId: string, runId: string, attempt: number, minutes: number, approved: boolean) =>
  ev({ kind: "human_review", taskId, runId, attempt, humanMinutes: minutes, success: approved, acceptedBy: "revisor", acceptedByKind: approved ? "human" : null });

const contract = (over: Partial<OutcomeContract>): OutcomeContract => ({
  id: "ct_g", version: 1, metricKey: "acceptance_rate", unit: "%", direction: "up", baseline: 50, target: 80,
  referenceHumanMinutes: 20, requireHumanAccept: false, referenceModel: null, ...over,
});
const rate = (cents: number): HourlyRateInput => ({ rateId: `rr_${cents}`, hourlyCostCents: cents, currency: "BRL", role: "support", areaId: null });

const AGENTS: Record<string, { events: OutcomeEventRow[]; contract: OutcomeContract; rate: HourlyRateInput | null; offInvoice: number }> = {
  ag_golden_a: {
    events: [
      run("a1", "a1r1", 1, 30, { success: false }),
      run("a1", "a1r2", 2, 45),
      review("a1", "a1r2", 2, 6, true),
      run("a2", "a2r1", 1, 25, { acceptedBy: "regra:schema", acceptedByKind: "auto", acceptedRuleVersion: "v1" }),
      run("a3", "a3r1", 1, 40),
      review("a3", "a3r1", 1, 3, false),
      run("a4", "a4r1", 1, 20),
      ev({ kind: "escalation", taskId: "a4", runId: "a4r1", attempt: 1, humanMinutes: 2, success: null }),
      review("a4", "a4r1", 1, 1, true),
    ],
    contract: contract({ referenceHumanMinutes: 20 }),
    rate: rate(6000),
    offInvoice: 500,
  },
  ag_golden_b: {
    events: [
      run("b1", "b1r1", 1, 100, { acceptedBy: "regra:x", acceptedByKind: "auto", acceptedRuleVersion: "v2" }),
      run("b2", "b2r1", 1, 50, { success: false }),
      run("b2", "b2r2", 2, 60, { success: false }),
      run("b2", "b2r3", 3, 70),
      review("b2", "b2r3", 3, 4, true),
      run("b3", "b3r1", 1, 80, { acceptedBy: "gestora", acceptedByKind: "human" }),
    ],
    contract: contract({ referenceHumanMinutes: 30, requireHumanAccept: true }),
    rate: rate(9000),
    offInvoice: 0,
  },
  ag_golden_c: {
    events: [
      run("c1", "c1r1", 1, 10, { acceptedBy: "regra:y", acceptedByKind: "auto", acceptedRuleVersion: "v1" }),
      run("c2", "c2r1", 1, 20),
    ],
    contract: contract({}),
    rate: null,
    offInvoice: 0,
  },
};

function outcomeOf(agentId: string): OutcomeResult {
  const a = AGENTS[agentId]!;
  const { tasks, coverage } = normalizeTasks(a.events);
  return computeOutcome({
    calcVersion: CALC_VERSION,
    agentId,
    period: { start: "2026-10-01", end: "2026-10-31" },
    tasks,
    coverage,
    contract: a.contract,
    hourlyRate: a.rate,
    offInvoice: { cents: a.offInvoice, itemIds: a.offInvoice ? ["oic_g"] : [], missingFx: false },
    priceTable: null,
    fx: null,
  });
}

/** Linha do resultado no mesmo formato da planilha. */
function row(o: OutcomeResult): Record<string, string> {
  const c = o.layer1.cost;
  const u = c.status === "ok" ? null : `unavailable:${c.reason}`;
  const v = c.status === "ok" ? c.value : null;
  const num = (x: number | null | undefined) => (x === null || x === undefined ? "" : String(x));
  const ok = <T,>(x: { status: string; value?: T }) => (x.status === "ok" ? (x.value as T) : null);
  const retry = ok(o.layer1.decomposition.retry) as { cents: number } | null;
  const illusory = ok(o.signals.illusoryWin) as { count: number } | null;
  const acceptedTasks = o.layer2.acceptanceRate.status === "ok" ? Math.round((o.layer2.acceptanceRate.value * o.layer2.tasks) / 100) : 0;
  return {
    agent: o.agentId,
    tasks: String(o.layer2.tasks),
    accepted: String(v?.acceptedTasks ?? acceptedTasks),
    auto_not_counted: String(v?.acceptanceByKind.auto_not_counted.count ?? 0),
    tokens_cents: u ?? num(v!.breakdown.tokens.cents),
    review_cents: u ?? num(v!.breakdown.review.cents),
    rework_cents: u ?? num(v!.breakdown.rework.cents),
    off_invoice_cents: u ?? num(v!.breakdown.offInvoice.cents),
    total_cents: u ?? num(v!.totalCost.cents),
    cost_per_validated_cents: u ?? num(v!.costPerValidatedTask.cents),
    human_cost_per_task_cents: u ?? num(v!.humanCostPerTask?.cents),
    savings_cents: u ?? num(v!.breakEven?.savingsPerTask.cents),
    savings_percent: u ?? num(v!.breakEven?.savingsPercent),
    acceptance_rate: num(ok(o.layer2.acceptanceRate) as number | null),
    auto_share: num(ok(o.layer2.autoAcceptShare) as number | null),
    intervention_rate: num(ok(o.layer2.interventionRate) as number | null),
    retry_cents: num(retry?.cents),
    illusory_win_count: num(illusory?.count),
  };
}

function readCsv(): Record<string, string>[] {
  const [header, ...lines] = readFileSync(CSV, "utf8").trim().split("\n");
  const cols = header!.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((cell, i) => [cols[i]!, cell])));
}

describe("golden · planilha × cálculo, ao centavo", () => {
  const planilha = readCsv();

  it("a planilha tem os 3 agentes sintéticos", () => {
    expect(planilha.map((r) => r.agent)).toEqual(Object.keys(AGENTS));
  });

  for (const esperado of planilha) {
    it(`${esperado.agent} bate com a planilha`, () => {
      expect(row(outcomeOf(esperado.agent!))).toEqual(esperado);
    });
  }
});
