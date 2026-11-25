import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { outcomeView, type OutcomePayload } from "./agent-outcome-view";

const na = (reason: string) => ({ status: "unavailable" as const, reason });
const money = (cents: number) => ({ cents });

function payloadComDesempenho(): OutcomePayload {
  return {
    agentId: "ag_1",
    taskType: "Triagem N1",
    period: "2026-11",
    source: "live",
    calcVersion: "cunha-1",
    coverage: { status: "ok", value: { ratio: 1, eventsWithTask: 5, totalEvents: 5 } },
    layer1: {
      cost: {
        status: "ok",
        value: {
          tasks: 5,
          acceptedTasks: 4,
          attempts: 6,
          totalCost: money(1200),
          costPerValidatedTask: money(300),
          humanCostPerTask: money(1500),
          breakEven: { savingsPerTask: money(1200), savingsPercent: 80 },
          breakdown: { tokens: money(200), review: money(400), rework: money(100), offInvoice: money(500) },
        },
      },
      decomposition: {
        retry: { status: "ok", value: { cents: 50, share: 0.25, tasksWithRetry: 1 } },
        context: na("no_context_tokens"),
        model: na("missing_price_table"),
      },
    },
    layer2: {
      tasks: 5,
      acceptanceRate: { status: "ok", value: 80 },
      interventionRate: { status: "ok", value: 40 },
      autoAcceptShare: { status: "ok", value: 75 },
      expectedMatchRate: na("no_expected_actual"),
      contract: na("no_contract"),
    },
    layer3: {
      provenance: { status: "ok", value: { sources: ["execution"], formula: "v1", taskCount: 5, runCount: 6 } },
      trail: { status: "ok", value: { records: 4, humanReviews: 1, autoAcceptances: 3, ruleVersions: ["v1"] } },
      ownerCoverage: { status: "ok", value: { covered: 4, of: 4, missing: [] } },
      credentialCoverage: { status: "ok", value: { activeKeys: 1, environments: ["prod"] } },
      snapshot: na("period_not_closed"),
    },
    signals: {
      adoption: { status: "ok", value: { tasks: 5, activeDays: 3 } },
      illusoryWin: { status: "ok", value: { count: 0, rate: 0 } },
      tokenAnomaly: na("too_few_tasks"),
    },
    performance: {
      totalTasks: 5,
      completedTasks: 5,
      validatedTasks: 4,
      resolvedAutonomouslyTasks: 2,
      escalatedTasks: 2,
      unnecessaryEscalationTasks: 1,
      unnecessaryEscalationRate: { status: "ok", value: { rate: 50, unnecessaryTasks: 1, escalatedTasks: 2 } },
      accuracyRate: { status: "ok", value: 80 },
      avgDeliveryMs: { status: "ok", value: { avgMs: 4200, avgMinutes: 0.07, tasksWithDuration: 5 } },
      escalationReworkRate: { status: "ok", value: { rate: 60, affectedTasks: 3, escalatedTasks: 2, reworkTasks: 2 } },
      humanSupervisionAndRework: { status: "ok", value: { supervisionMinutes: 12, reworkMinutes: 6, totalMinutes: 18, totalHours: 0.3 } },
      humanBaseline: {
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
          notes: "Amostra de 200 chamados",
          deltas: {
            accuracyPp: -5,
            speedup: 214.3,
            timeSavedMinutesPerTask: 14.93,
            escalationReworkPp: 40,
            grossSavedHours: 1,
            netSavedHours: 0.7,
          },
        },
      },
    },
    verdict: { status: "coming_soon" },
  };
}

test("RG-M33: ficha prioriza 4 KPIs de desempenho lado a lado com o humano pré-implantação e ganho líquido", () => {
  const v = outcomeView(payloadComDesempenho());
  assert.equal(v.performanceCards.length, 4);
  assert.equal(v.performanceCards[0]!.label, "Tarefas concluídas e validadas");
  assert.match(v.performanceCards[0]!.agentText, /4 validadas/);
  assert.match(v.performanceCards[0]!.agentHint!, /2 resolvidas sem escalar/);
  assert.match(v.performanceCards[0]!.humanText, /Triagem N1/);
  assert.match(v.performanceCards[0]!.humanHint!, /Medido pré-implantação.*2026-10-15/);

  assert.equal(v.performanceCards[1]!.label, "Taxa de acerto");
  assert.equal(v.performanceCards[1]!.agentText, "80%");
  assert.equal(v.performanceCards[1]!.humanText, "85%");
  assert.match(v.performanceCards[1]!.deltaText!, /-5 p\.p\./);

  assert.equal(v.performanceCards[2]!.label, "Tempo médio de entrega");
  assert.match(v.performanceCards[2]!.agentText, /4,2 s/);
  assert.match(v.performanceCards[2]!.humanText, /15 min/);
  assert.match(v.performanceCards[2]!.deltaText!, /214,3×/);

  assert.equal(v.performanceCards[3]!.label, "Escalonamento / retrabalho humano");
  assert.equal(v.performanceCards[3]!.agentText, "60%");
  assert.match(v.performanceCards[3]!.agentHint!, /50% desnecessários/);
  assert.equal(v.performanceCards[3]!.humanText, "20%");

  assert.ok(v.netGainSummary);
  assert.match(v.netGainSummary!.netText, /0,7 h/);
  assert.match(v.netGainSummary!.detail, /0,3 h de supervisão/);
});

test("RG-M33: componente coloca desempenho vs humano antes do bloco secundário de custo", () => {
  const src = readFileSync(join(import.meta.dirname, "../components/agent-outcome.tsx"), "utf8");
  const perfPos = src.indexOf("Desempenho vs humano equivalente");
  const costPos = src.indexOf("Custo por tarefa validada");
  assert.ok(perfPos > -1 && costPos > perfPos, "desempenho vs humano deve vir antes do custo");
  assert.ok(!src.includes("font-serif text-3xl"), "custo não deve ser a manchete gigante da ficha");
});
