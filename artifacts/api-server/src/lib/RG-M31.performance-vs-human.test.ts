import { describe, expect, it } from "vitest";
import {
  CALC_VERSION,
  computeOutcome,
  normalizeTasks,
  type OutcomeEventRow,
} from "./outcome-layers";
import { humanBaselineProblems } from "./human-baseline-input";

function ev(over: Partial<OutcomeEventRow>): OutcomeEventRow {
  return {
    id: `ev_${Math.random().toString(36).slice(2, 8)}`,
    kind: "execution",
    ts: "2026-11-10T12:00:00.000Z",
    taskId: null,
    runId: null,
    attempt: null,
    durationMs: null,
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

describe("RG-M31 · ficha do agente: desempenho vs humano equivalente (MUS-195)", () => {
  it("calcula tarefas validadas, resolvidas sem escalar, escalonamento desnecessário, supervisão/retrabalho e ganho líquido", () => {
    const events: OutcomeEventRow[] = [
      // t1: resolvida de verdade sem escalar em 3000ms
      ev({ id: "e1", taskId: "t1", runId: "r1", attempt: 1, durationMs: 3000, costCents: 10, acceptedBy: "regra", acceptedByKind: "auto", acceptedRuleVersion: "v1" }),
      // t2: retry + revisão humana de 2 min -> total 6000ms, teve retrabalho
      ev({ id: "e2", taskId: "t2", runId: "r2a", attempt: 1, durationMs: 2000, costCents: 10, success: false }),
      ev({ id: "e3", taskId: "t2", runId: "r2b", attempt: 2, durationMs: 4000, costCents: 15, success: true }),
      ev({ id: "e4", kind: "human_review", taskId: "t2", runId: "r2b", attempt: 2, success: true, acceptedBy: "ana", acceptedByKind: "human", humanMinutes: 2 }),
      // t3: escalonada e rejeitada (3000ms) + 5 min retrabalho humano
      ev({ id: "e5", taskId: "t3", runId: "r3", attempt: 1, durationMs: 3000, costCents: 12, success: true }),
      ev({ id: "e6", kind: "escalation", taskId: "t3", runId: "r3", attempt: 1, humanMinutes: 5 }),
      ev({ id: "e7", kind: "human_review", taskId: "t3", runId: "r3", attempt: 1, success: false, acceptedBy: "ana" }),
      // t4: resolvida sem escalar, mas com reworkCount = 1 (6000ms)
      ev({ id: "e8", taskId: "t4", runId: "r4", attempt: 1, durationMs: 6000, costCents: 8, reworkCount: 1, acceptedBy: "regra", acceptedByKind: "auto", acceptedRuleVersion: "v1" }),
      // t5: escalonada, porém expected===actual e aceita sem retrabalho -> escalonamento desnecessário
      ev({ id: "e9", taskId: "t5", runId: "r5", attempt: 1, durationMs: 3000, costCents: 9, expected: { ok: true }, actual: { ok: true }, acceptedBy: "regra", acceptedByKind: "auto", acceptedRuleVersion: "v1" }),
      ev({ id: "e10", kind: "escalation", taskId: "t5", runId: "r5", attempt: 1 }),
    ];

    const { tasks, coverage } = normalizeTasks(events);
    const res = computeOutcome({
      calcVersion: CALC_VERSION,
      agentId: "ag_1",
      period: { start: "2026-11-01", end: "2026-11-30" },
      tasks,
      coverage,
      contract: null,
      hourlyRate: null,
      offInvoice: { cents: 0, itemIds: [], missingFx: false },
      priceTable: null,
      fx: null,
      humanBaseline: {
        id: "hb_1",
        taskType: "Triagem N1",
        source: "task_type_baseline",
        humanMinutesPerTask: 15,
        humanAccuracyRate: 85,
        humanEscalationRate: 20,
        measurementKind: "measured",
        measuredAt: "2026-10-15",
        notes: "Medição pré-implantação em amostra de 200 chamados",
      },
    });

    expect(res.performance.totalTasks).toBe(5);
    expect(res.performance.completedTasks).toBe(5);
    expect(res.performance.validatedTasks).toBe(4); // t1, t2, t4, t5
    expect(res.performance.resolvedAutonomouslyTasks).toBe(1); // só t1 foi resolvida sem escalar e sem retrabalho
    expect(res.performance.escalatedTasks).toBe(2); // t3, t5
    expect(res.performance.unnecessaryEscalationTasks).toBe(1); // t5
    expect(res.performance.unnecessaryEscalationRate).toEqual({
      status: "ok",
      value: { rate: 50, unnecessaryTasks: 1, escalatedTasks: 2 },
    });
    expect(res.performance.accuracyRate).toEqual({ status: "ok", value: 80 });
    // durations: 3000, 6000, 3000, 6000, 3000 -> avg = 4200ms (0.07 min)
    expect(res.performance.avgDeliveryMs).toEqual({
      status: "ok",
      value: { avgMs: 4200, avgMinutes: 0.07, tasksWithDuration: 5 },
    });
    // supervisionMinutes = 2 (t2 review), reworkMinutes = 5 (t3 escalation) -> total = 7 min (0.12 h)
    expect(res.performance.humanSupervisionAndRework).toEqual({
      status: "ok",
      value: { supervisionMinutes: 2, reworkMinutes: 5, totalMinutes: 7, totalHours: 0.12 },
    });
    // grossSavedMinutes = (15 - 0.07) * 4 = 59.72 min (~1.0 h); net = (59.72 - 7)/60 = 0.88 h
    expect(res.performance.humanBaseline).toEqual({
      status: "ok",
      value: {
        id: "hb_1",
        taskType: "Triagem N1",
        source: "task_type_baseline",
        humanMinutesPerTask: 15,
        humanAccuracyRate: 85,
        humanEscalationRate: 20,
        measurementKind: "measured",
        measuredAt: "2026-10-15",
        notes: "Medição pré-implantação em amostra de 200 chamados",
        deltas: {
          accuracyPp: -5,
          speedup: 214.3,
          timeSavedMinutesPerTask: 14.93,
          escalationReworkPp: 60,
          grossSavedHours: 1,
          netSavedHours: 0.88,
        },
      },
    });
  });

  it("sem tarefas, sem duração ou sem baseline humano retorna unavailable (nada inventado)", () => {
    const empty = computeOutcome({
      calcVersion: CALC_VERSION,
      agentId: "ag_1",
      period: { start: "2026-11-01", end: "2026-11-30" },
      tasks: [],
      coverage: { eventsWithTask: 0, totalEvents: 0 },
      contract: null,
      hourlyRate: null,
      offInvoice: { cents: 0, itemIds: [], missingFx: false },
      priceTable: null,
      fx: null,
      humanBaseline: null,
    });
    expect(empty.performance.validatedTasks).toBe(0);
    expect(empty.performance.accuracyRate).toEqual({ status: "unavailable", reason: "no_tasks" });
    expect(empty.performance.avgDeliveryMs).toEqual({ status: "unavailable", reason: "no_tasks" });
    expect(empty.performance.escalationReworkRate).toEqual({ status: "unavailable", reason: "no_tasks" });
    expect(empty.performance.humanSupervisionAndRework).toEqual({ status: "unavailable", reason: "no_tasks" });
    expect(empty.performance.humanBaseline).toEqual({ status: "unavailable", reason: "no_human_baseline" });

    const { tasks, coverage } = normalizeTasks([
      ev({ id: "e1", taskId: "t1", runId: "r1", attempt: 1, durationMs: null }),
    ]);
    const noDuration = computeOutcome({
      calcVersion: CALC_VERSION,
      agentId: "ag_1",
      period: { start: "2026-11-01", end: "2026-11-30" },
      tasks,
      coverage,
      contract: null,
      hourlyRate: null,
      offInvoice: { cents: 0, itemIds: [], missingFx: false },
      priceTable: null,
      fx: null,
      humanBaseline: null,
    });
    expect(noDuration.performance.avgDeliveryMs).toEqual({ status: "unavailable", reason: "no_duration" });
  });

  it("exige data de medição pré-implantação quando origem for 'measured' e valida limites", () => {
    expect(
      humanBaselineProblems({
        taskType: "Triagem",
        humanMinutesPerTask: 12,
        humanAccuracyRate: 92,
        humanEscalationRate: 15,
        measurementKind: "measured",
        measuredAt: "2026-11-10",
      }),
    ).toEqual([]);
    expect(
      humanBaselineProblems({
        taskType: "Triagem",
        humanMinutesPerTask: 12,
        humanAccuracyRate: 92,
        humanEscalationRate: 15,
        measurementKind: "measured",
        measuredAt: "",
      }),
    ).toEqual(["measuredAt é obrigatório quando a origem for 'measured' (pré-implantação)."]);
    expect(
      humanBaselineProblems({
        taskType: "Triagem",
        humanMinutesPerTask: 12,
        humanAccuracyRate: 92,
        humanEscalationRate: 15,
        measurementKind: "estimated",
        measuredAt: null,
      }),
    ).toEqual([]);
    expect(
      humanBaselineProblems({
        taskType: " ",
        humanMinutesPerTask: -1,
        humanAccuracyRate: 110,
        humanEscalationRate: -5,
        measurementKind: "estimated",
      }).length,
    ).toBe(4);
  });
});
