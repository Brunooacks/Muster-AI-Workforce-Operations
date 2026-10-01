import test from "node:test";
import assert from "node:assert/strict";
import { adaptApiAgent } from "./workforce-agent-adapter";
import type { Agent, AgentDetail } from "@workspace/api-client-react";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "Atlas Build Sentinel",
    slug: "atlas-build-sentinel",
    role: "Verificador de desenvolvimento",
    platform: "local-cli-agent",
    version: "1",
    status: "active",
    bio: "Validar integridade e testes do repositório.",
    currentVerdict: "promote",
    verdictConfidence: 0.91,
    severity: "stable",
    healthScore: 94,
    admittedAt: "2026-09-02T10:00:00.000Z",
    lastEvaluatedAt: "2026-09-02T11:00:00.000Z",
    headlineKpis: [{ label: "Taxa de sucesso", value: 98, unit: "%", trend: 2, direction: "up", target: "≥ 95%" }],
    ...overrides,
  };
}

test("adapta um agente real sem inventar owner ou baseline", () => {
  const adapted = adaptApiAgent(agent());
  assert.equal(adapted.id, "agent-1");
  assert.equal(adapted.contractFulfillment, 98);
  assert.equal(adapted.owner, "Owner pendente");
  assert.equal(adapted.metrics[0]?.baseline, "Não informado");
  assert.equal(adapted.status, "healthy");
});

test("usa owner e contrato profissional quando a API os fornece", () => {
  const adapted = adaptApiAgent(agent({
    businessOwner: "Bruno Oliveira",
    monthlyVolume: 100,
    monthlyCost: 14,
  }));
  assert.equal(adapted.owner, "Bruno Oliveira");
  assert.equal(adapted.costPerExecution, 0.14);
  assert.equal(adapted.monthlyVolume, 100);
});

test("usa custo medido na avaliação enquanto a projeção mensal reconcilia", () => {
  const adapted = adaptApiAgent(agent({
    monthlyVolume: 0,
    monthlyCost: 0,
    targetMetrics: [{
      label: "Custo por execução",
      value: 0.14,
      unit: "R$",
      trend: 0,
      direction: "flat",
      target: "R$ 0,10–0,40",
    }],
  }));
  assert.equal(adapted.costPerExecution, 0.14);
});

test("mantém agente sem telemetria em experiência", () => {
  const adapted = adaptApiAgent(agent({
    status: "observation",
    healthScore: 0,
    verdictConfidence: 0,
    currentVerdict: "observation",
    headlineKpis: [],
  }));
  assert.equal(adapted.status, "probation");
  assert.equal(adapted.statusLabel, "Sem evidência");
  assert.match(adapted.recommendation, /baseline/);
});

test("preserva o contrato da admissão e explicita lacunas de evidência", () => {
  const detail = {
    identity: {
      bio: "Executar pesquisa técnica.",
      shouldDo: ["Pesquisar"],
      shouldNotDo: [],
      autonomyLevel: "escalates",
      limits: [],
      version: 1,
      businessCase: {
        baseline: "Sem supervisão central",
        targetPayback: "Não monetário",
        actualPayback: "—",
        description: "Cumprir o escopo técnico combinado.",
        metricContracts: [
          { layer: "efficacy", label: "Trabalho conforme contrato", unit: "%", target: "≥ 90%" },
          { layer: "governance", label: "Cobertura de evidências", unit: "%", target: "100%" },
        ],
      },
    },
    owners: { businessOwner: "Bruno", technicalOwner: "Bruno", governanceSponsor: "Bruno" },
  } as unknown as AgentDetail;
  const adapted = adaptApiAgent(agent({
    monthlyVolume: 1,
    targetMetrics: [{ label: "Trabalho conforme contrato", value: 94, unit: "%", trend: 0, target: "≥ 90%" }],
  }), detail);

  assert.equal(adapted.purpose, "Cumprir o escopo técnico combinado.");
  assert.equal(adapted.metrics.length, 2);
  assert.equal(adapted.metrics[0]?.current, "94%");
  assert.equal(adapted.metrics[0]?.observed, true);
  assert.equal(adapted.metrics[1]?.current, "Sem evidência");
  assert.equal(adapted.metrics[1]?.observed, false);
  assert.equal(adapted.observedMetricCount, 1);
  assert.equal(adapted.contractFulfillment, 50);
});
