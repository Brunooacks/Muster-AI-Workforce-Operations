import { describe, expect, it } from "vitest";
import { aggregateTaskValue, type TaskValueEvent } from "./task-value";

function event(overrides: Partial<TaskValueEvent>): TaskValueEvent {
  return {
    id: "event-1",
    taskRunId: "run-1",
    currency: "BRL",
    kind: "execution",
    costCents: 100,
    ts: new Date("2026-10-11T10:00:00.000Z"),
    metadata: {},
    ...overrides,
  };
}

describe("aggregateTaskValue", () => {
  it("agrega execuções por tarefa e mantém métricas separadas por moeda", () => {
    const result = aggregateTaskValue([
      event({ id: "brl-execution", taskRunId: "brl-validated", costCents: 100 }),
      event({
        id: "brl-feedback",
        taskRunId: "brl-validated",
        kind: "feedback",
        costCents: null,
        ts: new Date("2026-10-11T10:05:00.000Z"),
        metadata: { validation: { status: "validated", source: "human_review" } },
      }),
      event({ id: "brl-pending", taskRunId: "brl-pending", costCents: 50 }),
      event({ id: "usd-execution", taskRunId: "usd-rejected", currency: "USD", costCents: 200 }),
      event({
        id: "usd-feedback",
        taskRunId: "usd-rejected",
        currency: "USD",
        kind: "feedback",
        costCents: null,
        ts: new Date("2026-10-11T10:05:00.000Z"),
        metadata: { validation: { status: "rejected", source: "connector" } },
      }),
    ]);

    expect(result.metrics.BRL).toMatchObject({
      status: "available",
      currency: "BRL",
      totalCost: { cents: 150, currency: "BRL" },
      costPerValidatedTask: { cents: 150, currency: "BRL" },
    });
    expect(result.metrics.USD).toEqual({
      status: "insufficient_evidence",
      reason: "no_observed_validations",
    });
    expect(result.validationByStatus).toEqual({
      validated: 1,
      rejected: 1,
      unvalidated: 1,
    });
  });

  it("sinaliza execução sem moeda e não cria tarefa a partir de feedback isolado", () => {
    const result = aggregateTaskValue([
      event({ id: "missing-currency", taskRunId: "no-currency", currency: null }),
      event({
        id: "feedback-only",
        taskRunId: "without-execution",
        kind: "feedback",
        costCents: null,
        metadata: { validation: { status: "validated", source: "human_review" } },
      }),
    ]);

    expect(result.metrics).toEqual({});
    expect(result.validationByStatus).toEqual({
      validated: 0,
      rejected: 0,
      unvalidated: 1,
    });
    expect(result.tasksWithoutCurrency).toEqual({
      count: 1,
      taskRunIds: ["no-currency"],
    });
  });

  it("usa a validação mais recente de uma tarefa", () => {
    const result = aggregateTaskValue([
      event({ taskRunId: "reviewed", costCents: 100 }),
      event({
        id: "old-feedback",
        taskRunId: "reviewed",
        kind: "feedback",
        costCents: null,
        ts: new Date("2026-10-11T10:01:00.000Z"),
        metadata: { validation: { status: "rejected", source: "connector" } },
      }),
      event({
        id: "latest-feedback",
        taskRunId: "reviewed",
        kind: "feedback",
        costCents: null,
        ts: new Date("2026-10-11T10:02:00.000Z"),
        metadata: { validation: { status: "validated", source: "human_review" } },
      }),
    ]);

    expect(result.validationByStatus).toEqual({
      validated: 1,
      rejected: 0,
      unvalidated: 0,
    });
  });
});
