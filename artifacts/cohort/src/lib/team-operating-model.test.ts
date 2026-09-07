import test from "node:test";
import assert from "node:assert/strict";
import {
  accountableForWorkItem,
  participantForWorkItem,
  summarizeStageOperation,
  summarizeOperatingScenario,
  teamOperatingScenarios,
  workAllocationForParticipant,
} from "./team-operating-model";

test("todos os itens de trabalho possuem responsável válido", () => {
  for (const scenario of teamOperatingScenarios) {
    for (const workItem of scenario.workItems) {
      assert.ok(participantForWorkItem(scenario, workItem), `${scenario.id}:${workItem.id}`);
      assert.ok(accountableForWorkItem(scenario, workItem), `${scenario.id}:${workItem.id}:accountable`);
      for (const contributorId of workItem.contributorIds) {
        assert.ok(scenario.participants.some((participant) => participant.id === contributorId), `${scenario.id}:${workItem.id}:${contributorId}`);
      }
    }
  }
});

test("etapas possuem owner, SLA, WIP e contrato de passagem", () => {
  for (const scenario of teamOperatingScenarios) {
    scenario.stages.forEach((stage, index) => {
      assert.ok(scenario.participants.some((participant) => participant.id === stage.ownerId), `${scenario.id}:${stage.id}:owner`);
      assert.ok(stage.sla.length > 0, `${scenario.id}:${stage.id}:sla`);
      assert.ok(stage.wipLimit > 0, `${scenario.id}:${stage.id}:wip`);
      assert.ok(stage.successRate > 0 && stage.successRate <= 100, `${scenario.id}:${stage.id}:success`);
      if (index < scenario.stages.length - 1) assert.ok(stage.handoffContract, `${scenario.id}:${stage.id}:handoff`);
    });
  }
});

test("cenários cobrem resultado, fluxo, automação e governança", () => {
  for (const scenario of teamOperatingScenarios) {
    const categories = new Set(scenario.metrics.map((metric) => metric.category));
    assert.ok(categories.has("outcome"));
    assert.ok(categories.has("flow"));
    assert.ok(categories.has("automation"));
    assert.ok(categories.has("governance"));
    assert.ok(scenario.definitionOfDone.length >= 3);
    assert.ok(scenario.guardrails.length >= 2);
  }
});

test("resumo pondera progresso e automação pelo tamanho do trabalho", () => {
  const summary = summarizeOperatingScenario(teamOperatingScenarios[0]!);

  assert.ok(summary.progress > 0 && summary.progress < 100);
  assert.ok(summary.automationCoverage > 0 && summary.automationCoverage < 100);
  assert.equal(summary.blockedItems, 1);
  assert.equal(summary.completedItems, 1);
  assert.equal(summary.totalItems, teamOperatingScenarios[0]!.workItems.length);
  assert.ok(summary.averageWorkload > 0);
  assert.ok(summary.overloadedParticipants >= 0);
  assert.ok(summary.humanDecisionGates >= 2);
});

test("resumo de etapa expõe fila, WIP e responsável operacional", () => {
  const scenario = teamOperatingScenarios[0]!;
  const review = summarizeStageOperation(scenario, "review");

  assert.equal(review.owner.id, "caio");
  assert.equal(review.blockedItems, 1);
  assert.equal(review.activeItems, 1);
  assert.ok(review.utilization > 0);
  assert.ok(review.handoffContract);
});

test("alocação separa execução, accountability e contribuição", () => {
  const scenario = teamOperatingScenarios[0]!;
  const renata = workAllocationForParticipant(scenario, "renata");

  assert.ok(renata.executing.length > 0);
  assert.ok(renata.accountable.length > renata.executing.length);
  assert.ok(renata.contributing.length > 0);
});

test("integrações não nativas são explicitamente contratuais", () => {
  const development = teamOperatingScenarios.find((scenario) => scenario.id === "development")!;
  const jira = development.integrations.find((integration) => integration.platform === "jira")!;
  const confluence = development.integrations.find((integration) => integration.platform === "confluence")!;

  assert.equal(jira.status, "contract_ready");
  assert.equal(confluence.status, "contract_ready");
});
