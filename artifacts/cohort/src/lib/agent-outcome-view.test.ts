import assert from "node:assert/strict";
import test from "node:test";
import { outcomeView, type OutcomePayload } from "./agent-outcome-view";

const na = (reason: string) => ({ status: "unavailable" as const, reason });
const money = (cents: number) => ({ cents });

function vazio(): OutcomePayload {
  return {
    agentId: "ag",
    period: "2026-10",
    source: "live",
    calcVersion: "cunha-1",
    coverage: na("no_events"),
    layer1: { cost: na("no_tasks"), decomposition: { retry: na("no_tasks"), context: na("no_context_tokens"), model: na("missing_price_table") } },
    layer2: {
      tasks: 0,
      acceptanceRate: na("no_tasks"),
      interventionRate: na("no_tasks"),
      autoAcceptShare: na("no_accepted_tasks"),
      expectedMatchRate: na("no_expected_actual"),
      contract: na("no_contract"),
    },
    layer3: {
      provenance: na("no_tasks"),
      trail: na("no_trail_records"),
      ownerCoverage: { status: "ok", value: { covered: 0, of: 4, missing: ["business_owner", "technical_owner", "governance_sponsor", "contract_owner"] } },
      credentialCoverage: na("no_active_agent_key"),
      snapshot: na("period_not_closed"),
    },
    signals: { adoption: na("no_tasks"), illusoryWin: na("no_tasks"), tokenAnomaly: na("too_few_tasks") },
    verdict: { status: "coming_soon" },
  };
}

test("estado vazio: nada inventado, tudo indisponível com motivo legível", () => {
  const v = outcomeView(vazio());
  assert.equal(v.empty, true);
  assert.equal(v.headline.text, "Indisponível");
  assert.equal(v.headline.hint, "nenhum evento com tarefa no período");
  assert.ok([...v.cost, ...v.quality, ...v.signals].every((c) => c.unavailable));
  assert.equal(v.quality.at(-1)!.hint, "agente sem contrato numérico (contrato pendente)");
  assert.equal(v.proof[2]!.hint, "falta: dono de negócio, dono técnico, patrocinador de governança, dono do contrato");
});

test("custo-hora ausente aparece como motivo, nunca como R$ 0", () => {
  const o = vazio();
  o.layer2.tasks = 3;
  o.layer1.cost = na("missing_hourly_rate");
  const v = outcomeView(o);
  assert.equal(v.empty, false);
  assert.equal(v.headline.text, "Indisponível");
  assert.equal(v.headline.hint, "sem custo-hora cadastrado para o papel do agente");
  assert.ok(!JSON.stringify(v).includes("R$ 0"));
});

test("estado ok: custo, comparação humana, decomposição, aceite auto e regra na prova", () => {
  const o = vazio();
  o.source = "snapshot";
  o.layer2.tasks = 4;
  o.coverage = { status: "ok", value: { ratio: 0.8, eventsWithTask: 4, totalEvents: 5 } };
  o.layer1.cost = {
    status: "ok",
    value: {
      tasks: 4, acceptedTasks: 3, attempts: 5,
      totalCost: money(1860), costPerValidatedTask: money(620), humanCostPerTask: money(2000),
      breakEven: { savingsPerTask: money(1380), savingsPercent: 69 },
      breakdown: { tokens: money(160), review: money(1000), rework: money(200), offInvoice: money(500) },
    },
  };
  o.layer1.decomposition.retry = { status: "ok", value: { cents: 45, share: 0.28, tasksWithRetry: 1 } };
  o.layer2.autoAcceptShare = { status: "ok", value: 33.33 };
  o.layer3.trail = { status: "ok", value: { records: 4, humanReviews: 3, autoAcceptances: 1, ruleVersions: ["v1"] } };
  const v = outcomeView(o);
  assert.match(v.headline.text, /6,20/);
  assert.equal(v.headline.hint, "3 de 4 tarefas aceitas · 5 tentativas");
  assert.match(v.cost[0]!.text, /20,00/);
  assert.match(v.cost[1]!.text, /13,80.*69%/);
  assert.equal(v.quality[1]!.text, "33,33%");
  assert.match(v.proof[1]!.hint!, /regras v1/);
  assert.equal(v.coverage.text, "80%");
  assert.equal(v.sourceLabel, "Snapshot fechado · cunha-1");
});
