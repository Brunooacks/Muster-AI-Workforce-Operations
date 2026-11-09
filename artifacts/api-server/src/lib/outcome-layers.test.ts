import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALC_VERSION,
  allocateOffInvoice,
  computeOutcome,
  normalizeTasks,
  selectReferenceModel,
  type OutcomeContract,
  type OutcomeEventRow,
  type OutcomeInputs,
  type PriceTable,
} from "./outcome-layers";

let seq = 0;
function ev(over: Partial<OutcomeEventRow>): OutcomeEventRow {
  seq += 1;
  return {
    id: `ev_${String(seq).padStart(4, "0")}`,
    kind: "execution",
    ts: `2026-10-0${1 + (seq % 9)}T10:00:00.000Z`,
    taskId: null,
    runId: null,
    attempt: null,
    costCents: null,
    tokensIn: null,
    tokensOut: null,
    contextTokens: null,
    model: null,
    capabilities: null,
    success: true,
    expected: null,
    actual: null,
    acceptedBy: null,
    acceptedByKind: null,
    acceptedRuleVersion: null,
    humanMinutes: null,
    reworkCount: null,
    ...over,
  };
}

const contrato = (over: Partial<OutcomeContract> = {}): OutcomeContract => ({
  id: "ct_1",
  version: 1,
  metricKey: "acceptance_rate",
  unit: "%",
  direction: "up",
  baseline: 50,
  target: 80,
  referenceHumanMinutes: 20,
  requireHumanAccept: false,
  referenceModel: null,
  ...over,
});

const rate = { rateId: "rr_1", hourlyCostCents: 6000, currency: "BRL" as const, role: "support", areaId: null };

function inputs(events: OutcomeEventRow[], over: Partial<OutcomeInputs> = {}): OutcomeInputs {
  const { tasks, coverage } = normalizeTasks(events);
  return {
    calcVersion: CALC_VERSION,
    agentId: "ag_1",
    period: { start: "2026-10-01", end: "2026-10-31" },
    tasks,
    coverage,
    contract: contrato(),
    hourlyRate: rate,
    offInvoice: { cents: 0, itemIds: [], missingFx: false },
    priceTable: null,
    fx: null,
    ...over,
  };
}

const t1 = [
  ev({ taskId: "t1", runId: "r1", attempt: 1, costCents: 30, tokensIn: 1000, tokensOut: 200, contextTokens: 900, model: "big", success: false }),
  ev({ taskId: "t1", runId: "r2", attempt: 2, costCents: 40, tokensIn: 1000, tokensOut: 200, contextTokens: 950, model: "big" }),
  ev({ kind: "human_review", taskId: "t1", runId: "r2", attempt: 2, humanMinutes: 5, acceptedBy: "ana", acceptedByKind: "human", success: true }),
];
const t2 = [
  ev({ taskId: "t2", runId: "r3", attempt: 1, costCents: 50, tokensIn: 800, tokensOut: 100, model: "big", acceptedBy: "regra:schema", acceptedByKind: "auto", acceptedRuleVersion: "v2" }),
];
const semTask = [ev({ costCents: 999 }), ev({ kind: "heartbeat" })];

describe("normalizeTasks", () => {
  it("agrupa por task_id, ordena tentativas e separa revisão de retrabalho; heartbeat fora da cobertura", () => {
    const { tasks, coverage } = normalizeTasks([...t1, ...t2, ...semTask]);
    expect(tasks.map((t) => [t.taskId, t.attempts.map((a) => a.runId), t.acceptance?.kind])).toEqual([
      ["t1", ["r1", "r2"], "human"],
      ["t2", ["r3"], "auto"],
    ]);
    expect(tasks[0]).toMatchObject({ reviewMinutes: 5, reworkMinutes: 0, humanReviews: 1 });
    expect(coverage).toEqual({ eventsWithTask: 4, totalEvents: 5 });
  });

  it("rejeição humana derruba aceite automático", () => {
    const { tasks } = normalizeTasks([
      ...t2,
      ev({ kind: "human_review", taskId: "t2", runId: "r3", attempt: 1, success: false, humanMinutes: 2, acceptedBy: "bia" }),
    ]);
    expect(tasks[0]).toMatchObject({ acceptance: null, rejected: true });
  });
});

describe("computeOutcome", () => {
  it("eventos sem task ficam fora do cálculo, mas entram na cobertura", () => {
    const r = computeOutcome(inputs([...t1, ...t2, ...semTask]));
    expect(r.layer1.cost).toMatchObject({ status: "ok", value: { tasks: 2, breakdown: { tokens: { cents: 120 } } } });
    expect(r.coverage).toEqual({ status: "ok", value: { ratio: 0.8, eventsWithTask: 4, totalEvents: 5 } });
  });

  it("custo-hora ausente → indisponível com motivo (sem default)", () => {
    expect(computeOutcome(inputs(t1, { hourlyRate: null })).layer1.cost).toEqual({ status: "unavailable", reason: "missing_hourly_rate" });
  });

  it("zero tarefas aceitas → indisponível", () => {
    const r = computeOutcome(inputs([ev({ taskId: "tx", runId: "rx", attempt: 1, costCents: 10 })]));
    expect(r.layer1.cost).toEqual({ status: "unavailable", reason: "no_accepted_tasks" });
    expect(r.signals.illusoryWin).toEqual({ status: "ok", value: { count: 1, rate: 100 } });
  });

  it("retries: custo das tentativas > 1 e tarefas com retry", () => {
    const r = computeOutcome(inputs([...t1, ...t2]));
    expect(r.layer1.decomposition.retry).toEqual({ status: "ok", value: { cents: 40, share: 0.3333, tasksWithRetry: 1 } });
  });

  it("contexto alto: context_tokens ÷ tokens_in", () => {
    const r = computeOutcome(inputs(t1));
    expect(r.layer1.decomposition.context).toEqual({ status: "ok", value: { ratio: 0.925, contextTokens: 1850, tokensIn: 2000 } });
  });

  it("require_human_accept ignora aceite auto no denominador e na camada 2", () => {
    const r = computeOutcome(inputs([...t1, ...t2], { contract: contrato({ requireHumanAccept: true }) }));
    expect(r.layer1.cost).toMatchObject({ value: { acceptedTasks: 1 } });
    expect(r.layer2.acceptanceRate).toEqual({ status: "ok", value: 50 });
    expect(r.layer2.autoAcceptShare).toEqual({ status: "ok", value: 0 });
    const livre = computeOutcome(inputs([...t1, ...t2]));
    expect(livre.layer2.autoAcceptShare).toEqual({ status: "ok", value: 50 });
  });

  it("camada 2 compara com baseline e meta do contrato vigente", () => {
    const r = computeOutcome(inputs([...t1, ...t2]));
    expect(r.layer2.contract).toMatchObject({
      status: "ok",
      value: { metricKey: "acceptance_rate", value: 100, onTarget: true, progress: 1, contractVersion: 1 },
    });
    expect(computeOutcome(inputs(t1, { contract: null })).layer2.contract).toEqual({ status: "unavailable", reason: "no_contract" });
    expect(computeOutcome(inputs(t1, { contract: contrato({ metricKey: "nps" }) })).layer2.contract).toEqual({
      status: "unavailable",
      reason: "contract_metric_not_computed",
    });
  });

  const tabela: PriceTable = {
    version: "veltrix-2026-10",
    models: [
      { model: "big", inputCentsPerMTok: 1500, outputCentsPerMTok: 7500, currency: "BRL", capabilities: { tools: true, vision: true, contextWindow: 200000 } },
      { model: "small", inputCentsPerMTok: 100, outputCentsPerMTok: 500, currency: "BRL", capabilities: { tools: true, vision: false, contextWindow: 128000 } },
    ],
  };

  it("nenhum modelo aprovado → modelo de referência indisponível", () => {
    const sem = computeOutcome(inputs(t1)).layer1.decomposition.model;
    expect(sem).toEqual({ status: "unavailable", reason: "missing_price_table" });
    // "small" não foi usado: não passou na meta do contrato deste agente.
    const r = computeOutcome(inputs(t1, { priceTable: tabela, contract: contrato({ target: 101 }) }));
    expect(r.layer1.decomposition.model).toEqual({ status: "unavailable", reason: "no_qualified_model" });
    const semMeta = computeOutcome(inputs(t1, { priceTable: tabela, contract: contrato({ metricKey: "intervention_rate" }) }));
    expect(semMeta.layer1.decomposition.model).toEqual({ status: "unavailable", reason: "quality_goal_not_defined" });
  });

  it("modelo fixado pela conta vira a referência e mede o superdimensionamento", () => {
    const r = computeOutcome(inputs(t1, { priceTable: tabela, contract: contrato({ referenceModel: "small" }) }));
    // por tentativa: 1000×100/1e6 + 200×500/1e6 = 0,2 centavo → excesso 29,8 + 39,8.
    expect(r.layer1.decomposition.model).toEqual({
      status: "ok",
      value: { referenceModel: "small", source: "pinned", oversizeCents: 70, priceVersion: "veltrix-2026-10" },
    });
  });

  it("padrão: o mais barato que atende às capabilities e já bateu a meta", () => {
    const ref = selectReferenceModel({
      pinned: null,
      priceTable: tabela,
      required: { tools: true, vision: false, contextWindow: 1000 },
      qualified: ["big", "small"],
    });
    expect(ref).toMatchObject({ status: "ok", value: { model: "small", source: "cheapest_qualified" } });
    const visao = selectReferenceModel({ pinned: null, priceTable: tabela, required: { tools: false, vision: true, contextWindow: 0 }, qualified: ["big", "small"] });
    expect(visao).toMatchObject({ value: { model: "big" } });
  });

  it("anomalia de tokens precisa de ≥ 5 tarefas", () => {
    expect(computeOutcome(inputs(t1)).signals.tokenAnomaly).toEqual({ status: "unavailable", reason: "too_few_tasks" });
    const muitas = [1, 2, 3, 4, 5].map((i) =>
      ev({ taskId: `a${i}`, runId: `ra${i}`, attempt: 1, tokensIn: i === 5 ? 10000 : 1000, tokensOut: 0, costCents: 1 }),
    );
    expect(computeOutcome(inputs(muitas)).signals.tokenAnomaly).toEqual({ status: "ok", value: { count: 1, medianTokens: 1000, maxRatio: 10 } });
  });
});

describe("allocateOffInvoice", () => {
  const base = { period: { start: "2026-10-01", end: "2026-10-31" }, agentId: "ag_1", projectId: "prj_1", agentTasks: 10, projectTasks: 40, orgTasks: 100, fx: null };
  it("agente leva tudo; projeto e rateio pela fatia de tarefas; pró-rata pelos dias", () => {
    const r = allocateOffInvoice({
      ...base,
      costs: [
        { id: "a", agentId: "ag_1", projectId: "prj_1", amountCents: 3100, currency: "BRL", periodStart: "2026-10-01", periodEnd: "2026-10-31", allocation: "agent" },
        { id: "p", agentId: null, projectId: "prj_1", amountCents: 4000, currency: "BRL", periodStart: "2026-10-01", periodEnd: "2026-10-31", allocation: "project" },
        { id: "o", agentId: null, projectId: null, amountCents: 10000, currency: "BRL", periodStart: "2026-10-01", periodEnd: "2026-10-31", allocation: "per_task" },
        { id: "half", agentId: "ag_1", projectId: null, amountCents: 6100, currency: "BRL", periodStart: "2026-10-01", periodEnd: "2026-11-30", allocation: "agent" },
        { id: "fora", agentId: "ag_1", projectId: null, amountCents: 9999, currency: "BRL", periodStart: "2026-09-01", periodEnd: "2026-09-30", allocation: "agent" },
      ],
    });
    // 3100 + 4000×10/40 + 10000×10/100 + 6100×31/61
    expect(r).toEqual({ cents: 3100 + 1000 + 1000 + 3100, itemIds: ["a", "p", "o", "half"], missingFx: false });
  });

  it("custo em USD sem câmbio marca missingFx (camada 1 indisponível)", () => {
    const r = allocateOffInvoice({
      ...base,
      costs: [{ id: "u", agentId: "ag_1", projectId: null, amountCents: 100, currency: "USD", periodStart: "2026-10-01", periodEnd: "2026-10-31", allocation: "agent" }],
    });
    expect(r.missingFx).toBe(true);
    expect(computeOutcome(inputs(t1, { offInvoice: r })).layer1.cost).toEqual({ status: "unavailable", reason: "missing_fx_rate" });
  });
});

describe("varredura: nenhum score neutro fixo", () => {
  it("telemetry.ts, outcome-layers.ts e a lib de valor não têm `score: 50`", () => {
    for (const arquivo of ["telemetry.ts", "outcome-layers.ts", "value/cost-per-validated-task.ts"]) {
      const fonte = readFileSync(join(import.meta.dirname, arquivo), "utf8");
      expect(fonte, arquivo).not.toMatch(/score\s*:\s*50\b/);
    }
  });
});
