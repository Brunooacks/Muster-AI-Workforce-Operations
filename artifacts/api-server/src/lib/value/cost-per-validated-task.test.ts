import { describe, expect, it } from "vitest";
import {
  calculateCostPerValidatedTask,
  type CostPerValidatedTaskInput,
  type TaskCostInput,
} from "./cost-per-validated-task";

// Casos herdados do PR #44 (MUS-171), reescritos para tarefa + tentativas.

function task(overrides: Partial<TaskCostInput> = {}): TaskCostInput {
  return {
    taskId: "t1",
    attempts: [{ runId: "r1", attempt: 1, costCents: 100, currency: "BRL" }],
    reviewMinutes: 0,
    reworkMinutes: 0,
    acceptance: { kind: "human", by: "ana", ruleVersion: null },
    ...overrides,
  };
}

const hourlyRate = { rateId: "rate_1", hourlyCostCents: 200, currency: "BRL" as const, role: "support", areaId: null };
const humanReference = { minutesPerTask: 15, contractId: "ct_1", contractVersion: 2 };

function input(over: Partial<CostPerValidatedTaskInput> = {}): CostPerValidatedTaskInput {
  return {
    tasks: [task()],
    hourlyRate,
    humanReference,
    requireHumanAccept: false,
    offInvoice: { cents: 0, itemIds: [] },
    outputCurrency: "BRL",
    ...over,
  };
}

describe("calculateCostPerValidatedTask", () => {
  it("soma todas as tentativas da tarefa, revisão e retrabalho × custo-hora", () => {
    const result = calculateCostPerValidatedTask(
      input({
        tasks: [
          task({
            attempts: [
              { runId: "r1", attempt: 1, costCents: 100, currency: "BRL" },
              { runId: "r2", attempt: 2, costCents: 120, currency: "BRL" },
            ],
            reviewMinutes: 30,
          }),
          task({ taskId: "t2", attempts: [{ runId: "r3", attempt: 1, costCents: 200, currency: "BRL" }], reworkMinutes: 6 }),
        ],
      }),
    );
    expect(result).toMatchObject({
      status: "available",
      tasks: 2,
      attempts: 3,
      acceptedTasks: 2,
      breakdown: { tokens: { cents: 420 }, review: { cents: 100 }, rework: { cents: 20 }, offInvoice: { cents: 0 } },
      totalCost: { cents: 540 },
      costPerValidatedTask: { cents: 270 },
      humanCostPerTask: { cents: 50 },
      breakEven: { savingsPerTask: { cents: -220 }, savingsPercent: -440 },
    });
    if (result.status !== "available") throw new Error("esperado available");
    expect(result.totalCost.provenance.runIds).toEqual(["r1", "r2", "r3"]);
  });

  it("inclui tarefa rejeitada no custo mas nunca no denominador", () => {
    const result = calculateCostPerValidatedTask(
      input({
        tasks: [
          task(),
          task({ taskId: "rej", attempts: [{ runId: "rx", attempt: 1, costCents: 300, currency: "BRL" }], acceptance: null }),
        ],
      }),
    );
    expect(result).toMatchObject({ status: "available", totalCost: { cents: 400 }, costPerValidatedTask: { cents: 400 } });
  });

  it("aceite auto com versão conta; com require_human_accept não conta", () => {
    const auto = task({ taskId: "ta", acceptance: { kind: "auto", by: "regra:schema", ruleVersion: "v3" } });
    const livre = calculateCostPerValidatedTask(input({ tasks: [task(), auto] }));
    expect(livre).toMatchObject({ acceptedTasks: 2, acceptanceByKind: { human: { count: 1 }, auto: { count: 1, percent: 50 } } });
    const exige = calculateCostPerValidatedTask(input({ tasks: [task(), auto], requireHumanAccept: true }));
    expect(exige).toMatchObject({
      acceptedTasks: 1,
      costPerValidatedTask: { cents: 200 },
      acceptanceByKind: { auto: { count: 0 }, auto_not_counted: { count: 1 } },
    });
  });

  it("aceite auto sem versão da regra nunca conta", () => {
    const result = calculateCostPerValidatedTask(
      input({ tasks: [task({ acceptance: { kind: "auto", by: "regra", ruleVersion: null } })] }),
    );
    expect(result).toEqual({ status: "insufficient_evidence", reason: "no_accepted_tasks" });
  });

  it("sem custo-hora é indisponível (sem default, R4)", () => {
    expect(calculateCostPerValidatedTask(input({ hourlyRate: null }))).toEqual({
      status: "insufficient_evidence",
      reason: "missing_hourly_rate",
    });
  });

  it("sem tarefas é indisponível", () => {
    expect(calculateCostPerValidatedTask(input({ tasks: [] }))).toEqual({ status: "insufficient_evidence", reason: "no_tasks" });
  });

  it("custos fora da fatura entram no numerador com proveniência declarada", () => {
    const result = calculateCostPerValidatedTask(input({ offInvoice: { cents: 1000, itemIds: ["oic_1"] } }));
    expect(result).toMatchObject({
      totalCost: { cents: 1100 },
      breakdown: { offInvoice: { cents: 1000, provenance: { kind: "declared", sources: ["off_invoice_costs", "oic_1"] } } },
    });
  });

  it("retorna taxa de câmbio ausente antes de calcular valores em USD", () => {
    expect(
      calculateCostPerValidatedTask(input({ tasks: [task({ attempts: [{ runId: "r", attempt: 1, costCents: 10, currency: "USD" }] })] })),
    ).toEqual({ status: "insufficient_evidence", reason: "missing_fx_rate" });
    expect(calculateCostPerValidatedTask(input({ hourlyRate: { ...hourlyRate, currency: "USD" } }))).toEqual({
      status: "insufficient_evidence",
      reason: "missing_fx_rate",
    });
  });

  it("converte custos USD, preserva BRL e carrega a procedência cambial", () => {
    const result = calculateCostPerValidatedTask(
      input({
        tasks: [task({ attempts: [{ runId: "r", attempt: 1, costCents: 100, currency: "USD" }] })],
        fx: { usdToBrl: 5.37, rateDate: "2026-10-24", source: "bcb-ptax" },
      }),
    );
    expect(result).toMatchObject({ totalCost: { cents: 537 }, fx: { rate: 5.37, date: "2026-10-24", source: "bcb-ptax" } });
  });

  it("não produz equilíbrio sem referência humana do contrato", () => {
    const result = calculateCostPerValidatedTask(input({ humanReference: null }));
    expect(result).toMatchObject({ status: "available", humanCostPerTask: null, breakEven: null });
  });

  it("arredonda conversão, divisão e custo humano ao centavo mais próximo", () => {
    const result = calculateCostPerValidatedTask(
      input({
        tasks: [
          task({ attempts: [{ runId: "a", attempt: 1, costCents: 100, currency: "BRL" }] }),
          task({ taskId: "t2", attempts: [{ runId: "b", attempt: 1, costCents: 101, currency: "BRL" }] }),
          task({ taskId: "t3", attempts: [{ runId: "c", attempt: 1, costCents: 100, currency: "BRL" }] }),
        ],
        humanReference: { ...humanReference, minutesPerTask: 7 },
        hourlyRate: { ...hourlyRate, hourlyCostCents: 1000 },
      }),
    );
    // 301 ÷ 3 = 100,33 → 100; 1000 × 7 ÷ 60 = 116,67 → 117.
    expect(result).toMatchObject({ costPerValidatedTask: { cents: 100 }, humanCostPerTask: { cents: 117 } });
  });

  it("proveniência: aceitas no denominador, contrato e custo-hora na referência humana", () => {
    const result = calculateCostPerValidatedTask(input());
    if (result.status !== "available") throw new Error("esperado available");
    expect(result.costPerValidatedTask.provenance).toMatchObject({ kind: "derived", taskIds: ["t1"] });
    expect(result.humanCostPerTask?.provenance.sources).toEqual(["agent_contracts:ct_1@v2", "role_rates:rate_1"]);
  });
});
