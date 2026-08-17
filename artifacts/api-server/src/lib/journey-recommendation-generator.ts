import type { JourneyMonitoringSummary } from "./journey-monitoring";

export interface RecommendationGenerationStep {
  id: string;
  name: string;
  agentId: string | null;
  agentName: string | null;
}

export interface GeneratedRecommendationAction {
  sequence: number;
  actorType: "muster" | "agent" | "human";
  agentId?: string | null;
  title: string;
  instructions: string;
  capability: string;
  executionMode: "autonomous" | "supervised" | "human-only";
  controlScope: "muster-internal" | "external-agent" | "human-decision";
  owner: string;
  slaMinutes: number;
}

export interface GeneratedJourneyRecommendation {
  stepId: string | null;
  agentId: string | null;
  title: string;
  rationale: string;
  expectedImpact: string;
  riskLevel: "medium" | "high" | "critical";
  source: "system";
  reviewSlaMinutes: number;
  actions: GeneratedRecommendationAction[];
}

function percent(value: number | null): string {
  return value === null ? "sem amostra" : `${Math.round(value * 100)}%`;
}

export function generateJourneyRecommendation(
  monitoring: JourneyMonitoringSummary,
  steps: RecommendationGenerationStep[],
): GeneratedJourneyRecommendation {
  const targetStep =
    steps.find((step) => step.id === monitoring.bottleneckStepId) ?? steps[0] ?? null;

  if (monitoring.totalRuns === 0) {
    return {
      stepId: targetStep?.id ?? null,
      agentId: targetStep?.agentId ?? null,
      title: "Instrumentar a jornada antes de alterar autonomia",
      rationale:
        "A jornada ainda não possui runs observados. Sem baseline, qualquer ajuste de agente, prompt ou roteamento seria uma decisão sem evidência.",
      expectedImpact:
        "Criar uma amostra mínima auditável e reduzir o risco de otimizar métricas locais sem confirmar o resultado end-to-end.",
      riskLevel: "medium",
      source: "system",
      reviewSlaMinutes: 240,
      actions: [
        {
          sequence: 1,
          actorType: "muster",
          title: "Agendar revisão após a primeira amostra",
          instructions: "Registrar nova revisão operacional após a janela definida e manter a coleta contínua.",
          capability: "schedule-reevaluation",
          executionMode: "autonomous",
          controlScope: "muster-internal",
          owner: "Muster",
          slaMinutes: 60,
        },
        ...(targetStep?.agentId
          ? [{
              sequence: 2,
              actorType: "agent" as const,
              agentId: targetStep.agentId,
              title: "Produzir amostra controlada",
              instructions: "Executar casos elegíveis sem alterar configuração e reportar etapa, handoff, duração, custo e outcome.",
              capability: "collect-baseline-sample",
              executionMode: "supervised" as const,
              controlScope: "external-agent" as const,
              owner: targetStep.agentName ?? "Agente da etapa",
              slaMinutes: 240,
            }]
          : []),
        {
          sequence: targetStep?.agentId ? 3 : 2,
          actorType: "human",
          title: "Validar baseline e critérios de sucesso",
          instructions: "Confirmar amostra mínima, SLA, guardrails e evidência que caracteriza o outcome real.",
          capability: "approve-baseline",
          executionMode: "human-only",
          controlScope: "human-decision",
          owner: "Owner da jornada",
          slaMinutes: 480,
        },
      ],
    };
  }

  const completionRate = monitoring.completionRate;
  const handoffRate = monitoring.handoffSuccessRate;
  const critical = completionRate < 0.5;
  const high =
    monitoring.illusoryVictory ||
    completionRate < 0.75 ||
    (handoffRate !== null && handoffRate < 0.8);
  const riskLevel = critical ? "critical" : high ? "high" : "medium";
  const reviewSlaMinutes = critical ? 60 : high ? 120 : 240;
  const bottleneckName = targetStep?.name ?? "etapa com maior atrito";

  return {
    stepId: targetStep?.id ?? null,
    agentId: targetStep?.agentId ?? null,
    title: monitoring.illusoryVictory
      ? `Corrigir perda end-to-end após ${bottleneckName}`
      : `Reduzir gargalo em ${bottleneckName}`,
    rationale:
      `A jornada conclui ${percent(completionRate)} dos runs, com handoff em ${percent(handoffRate)}. ` +
      `${bottleneckName} concentra a maior duração média observada` +
      (monitoring.illusoryVictory
        ? " e há sucesso local sem confirmação equivalente no outcome final."
        : "."),
    expectedImpact:
      "Elevar a conclusão end-to-end, reduzir o p95 e preservar guardrails antes de ampliar a autonomia do agente.",
    riskLevel,
    source: "system",
    reviewSlaMinutes,
    actions: [
      {
        sequence: 1,
        actorType: "muster",
        title: "Agendar reavaliação e ampliar supervisão",
        instructions:
          "Registrar uma nova revisão após a janela da ação e acompanhar conclusão, handoff, p95 e custo sem alterar o runtime externo.",
        capability: "schedule-reevaluation",
        executionMode: "autonomous",
        controlScope: "muster-internal",
        owner: "Muster",
        slaMinutes: 30,
      },
      ...(targetStep?.agentId
        ? [{
            sequence: 2,
            actorType: "agent" as const,
            agentId: targetStep.agentId,
            title: `Ajustar execução de ${bottleneckName}`,
            instructions:
              "Aplicar o feedback aprovado em ambiente controlado, preservar o envelope de contexto e reportar evidências antes/depois.",
            capability: "apply-agent-adjustment",
            executionMode: "supervised" as const,
            controlScope: "external-agent" as const,
            owner: targetStep.agentName ?? "Agente da etapa",
            slaMinutes: critical ? 120 : 240,
          }]
        : []),
      {
        sequence: targetStep?.agentId ? 3 : 2,
        actorType: "human",
        title: "Validar guardrails e aceitar o impacto",
        instructions:
          "Revisar a mudança proposta, confirmar limites de autonomia e decidir se o resultado permite manter, promover ou reverter o ajuste.",
        capability: "approve-runtime-change",
        executionMode: "human-only",
        controlScope: "human-decision",
        owner: "Owner da jornada",
        slaMinutes: critical ? 180 : 480,
      },
    ],
  };
}
