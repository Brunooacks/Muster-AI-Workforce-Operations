import { describe, expect, it } from "vitest";
import {
  calculateCostPerValidatedTask,
  type TaskCostInput,
} from "./cost-per-validated-task";

function task(overrides: Partial<TaskCostInput> = {}): TaskCostInput {
  return {
    taskRunId: "run-1",
    modelCostCents: 100,
    currency: "BRL",
    validation: { status: "validated", source: "human_review" },
    ...overrides,
  };
}

const humanReference = {
  hourlyRateCents: 200,
  minutesPerTask: 15,
  currency: "BRL" as const,
  declaredBy: "ana@example.com",
  declaredAt: "2026-10-11T12:00:00.000Z",
  source: "manual_entry" as const,
};

describe("calculateCostPerValidatedTask", () => {
  it("calcula custo, custo humano declarado e equilibrio apenas sobre validacoes observadas", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task({ correctionCostCents: 20, escalatedMinutes: 30 }),
        task({
          taskRunId: "run-2",
          modelCostCents: 200,
          validation: { status: "validated", source: "connector" },
        }),
      ],
      humanReference,
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      currency: "BRL",
      costPerValidatedTask: { cents: 210, currency: "BRL" },
      totalCost: { cents: 420, currency: "BRL" },
      humanCostPerTask: {
        cents: 50,
        declared: "manual_entry",
        declaredBy: "ana@example.com",
        declaredAt: "2026-10-11T12:00:00.000Z",
      },
      breakEven: { savingsPerTask: { cents: -160 }, savingsPercent: -320 },
    });
  });

  it("inclui tarefa rejeitada no custo mas nunca no denominador", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task({ modelCostCents: 100 }),
        task({
          taskRunId: "rejected",
          modelCostCents: 300,
          validation: { status: "rejected", source: "human_review" },
        }),
      ],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      totalCost: { cents: 400 },
      costPerValidatedTask: { cents: 400 },
    });
  });

  it("retorna evidencia insuficiente sem validacao observada", () => {
    expect(
      calculateCostPerValidatedTask({
        tasks: [task({ validation: null })],
        outputCurrency: "BRL",
      }),
    ).toEqual({
      status: "insufficient_evidence",
      reason: "no_observed_validations",
    });
  });

  it("nao usa auto relato como denominador", () => {
    expect(
      calculateCostPerValidatedTask({
        tasks: [
          task({
            validation: { status: "validated", source: "self_reported" },
          }),
        ],
        outputCurrency: "BRL",
      }),
    ).toEqual({
      status: "insufficient_evidence",
      reason: "no_observed_validations",
    });
  });

  it("retorna taxa de cambio ausente antes de calcular valores em USD", () => {
    expect(
      calculateCostPerValidatedTask({
        tasks: [task({ currency: "USD" })],
        outputCurrency: "BRL",
      }),
    ).toEqual({ status: "insufficient_evidence", reason: "missing_fx_rate" });
  });

  it("exige taxa de cambio quando a referencia humana esta em USD", () => {
    expect(
      calculateCostPerValidatedTask({
        tasks: [task()],
        humanReference: { ...humanReference, currency: "USD" },
        outputCurrency: "BRL",
      }),
    ).toEqual({ status: "insufficient_evidence", reason: "missing_fx_rate" });
  });

  it("converte custos USD, preserva BRL e carrega a procedencia cambial", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task({ modelCostCents: 100, correctionCostCents: 10, currency: "USD" }),
        task({
          taskRunId: "brl",
          modelCostCents: 50,
          validation: { status: "validated", source: "connector" },
        }),
      ],
      fx: { usdToBrl: 5, rateDate: "2026-10-10", source: "bcb" },
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      totalCost: { cents: 600 },
      costPerValidatedTask: { cents: 300 },
      fx: { rate: 5, date: "2026-10-10", source: "bcb" },
    });
  });

  it("nao produz equilibrio sem referencia humana", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [task()],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      humanCostPerTask: null,
      breakEven: null,
    });
  });

  it("recusa calcular o custo quando ha escalonamento sem referencia humana", () => {
    expect(
      calculateCostPerValidatedTask({
        tasks: [task({ escalatedMinutes: 10 })],
        outputCurrency: "BRL",
      }),
    ).toEqual({
      status: "insufficient_evidence",
      reason: "missing_human_reference",
    });
  });

  it("arredonda conversao monetaria ao centavo mais proximo", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [task({ modelCostCents: 101, currency: "USD" })],
      fx: { usdToBrl: 5.123, rateDate: "2026-10-10", source: "bcb" },
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      totalCost: { cents: 517 },
    });
  });

  it("arredonda custo por tarefa ao centavo mais proximo", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task({ modelCostCents: 50 }),
        task({
          taskRunId: "run-2",
          modelCostCents: 51,
          validation: { status: "validated", source: "connector" },
        }),
      ],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      costPerValidatedTask: { cents: 51 },
    });
  });

  it("arredonda o custo humano declarado ao centavo mais proximo", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [task()],
      humanReference: {
        ...humanReference,
        hourlyRateCents: 101,
        minutesPerTask: 1,
      },
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      humanCostPerTask: { cents: 2 },
    });
  });

  it("converte custo humano em USD antes de arredondar o centavo em BRL", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [task()],
      humanReference: {
        ...humanReference,
        hourlyRateCents: 101,
        minutesPerTask: 1,
        currency: "USD",
      },
      fx: { usdToBrl: 5, rateDate: "2026-10-10", source: "bcb" },
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      humanCostPerTask: { cents: 8 },
    });
  });

  it("separa contagem e percentual de cada fonte de validacao", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task({ taskRunId: "human-1" }),
        task({ taskRunId: "human-2" }),
        task({
          taskRunId: "connector",
          validation: { status: "validated", source: "connector" },
        }),
        task({
          taskRunId: "self",
          validation: { status: "validated", source: "self_reported" },
        }),
      ],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      validationBySource: {
        human_review: { count: 2, percent: 50 },
        connector: { count: 1, percent: 25 },
        self_reported: { count: 1, percent: 25 },
      },
    });
  });

  it("calcula o percentual por fonte sobre todas as tarefas, inclusive rejeitadas e sem validacao", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task({ taskRunId: "human-1" }),
        task({
          taskRunId: "rejected",
          validation: { status: "rejected", source: "human_review" },
        }),
        task({
          taskRunId: "pending",
          validation: { status: "unvalidated", source: "connector" },
        }),
        task({ taskRunId: "sem-feedback", validation: null }),
      ],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      validationBySource: {
        human_review: { count: 1, percent: 25 },
        connector: { count: 0, percent: 0 },
        self_reported: { count: 0, percent: 0 },
      },
    });
  });

  it("nao conta rejeicao auto relatada como validacao auto relatada", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task(),
        task({
          taskRunId: "self-rejected",
          validation: { status: "rejected", source: "self_reported" },
        }),
      ],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      validationBySource: { self_reported: { count: 0, percent: 0 } },
    });
  });

  it("anexa procedencia derivada aos numeros calculados", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [task()],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      costPerValidatedTask: {
        provenance: { kind: "derived", sources: ["task_input", "validation"] },
      },
      validationBySource: {
        human_review: {
          provenance: { kind: "observed", sources: ["validation"] },
        },
      },
    });
  });

  it("marca contagem auto relatada como declarada, nao como observada", () => {
    const result = calculateCostPerValidatedTask({
      tasks: [
        task(),
        task({
          taskRunId: "self",
          validation: { status: "validated", source: "self_reported" },
        }),
      ],
      outputCurrency: "BRL",
    });

    expect(result).toMatchObject({
      status: "available",
      validationBySource: {
        self_reported: { provenance: { kind: "declared" } },
      },
    });
  });
});
