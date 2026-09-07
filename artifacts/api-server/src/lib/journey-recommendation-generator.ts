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

export interface JourneyRecommendationContext {
  slaMinutes?: number | null;
  minimumBaselineRuns?: number;
}

function percent(value: number | null): string {
  return value === null ? "sem amostra" : `${Math.round(value * 100)}%`;
}

export function generateJourneyRecommendation(
  monitoring: JourneyMonitoringSummary,
  steps: RecommendationGenerationStep[],
  context: JourneyRecommendationContext = {},
): GeneratedJourneyRecommendation {
  const bottleneckStep =
    steps.find((step) => step.id === monitoring.bottleneckStepId) ?? steps[0] ?? null;
  const samplingStep = steps.find((step) => step.agentId) ?? bottleneckStep;
  const minimumBaselineRuns = Math.max(1, context.minimumBaselineRuns ?? 5);

  if (monitoring.totalRuns === 0) {
    return {
      stepId: samplingStep?.id ?? null,
      agentId: samplingStep?.agentId ?? null,
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
        ...(samplingStep?.agentId
          ? [{
              sequence: 2,
              actorType: "agent" as const,
              agentId: samplingStep.agentId,
              title: "Produzir amostra controlada",
              instructions: "Executar casos elegíveis sem alterar configuração e reportar etapa, handoff, duração, custo e outcome.",
              capability: "collect-baseline-sample",
              executionMode: "supervised" as const,
              controlScope: "external-agent" as const,
              owner: samplingStep.agentName ?? "Agente da etapa",
              slaMinutes: 240,
            }]
          : []),
        {
          sequence: samplingStep?.agentId ? 3 : 2,
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

  if (monitoring.totalRuns < minimumBaselineRuns) {
    const missingRuns = minimumBaselineRuns - monitoring.totalRuns;
    return {
      stepId: samplingStep?.id ?? null,
      agentId: samplingStep?.agentId ?? null,
      title: `Consolidar baseline com mais ${missingRuns} ${missingRuns === 1 ? "execução" : "execuções"}`,
      rationale:
        `A jornada possui ${monitoring.totalRuns} ${monitoring.totalRuns === 1 ? "run observado" : "runs observados"}. ` +
        `Conclusão em ${percent(monitoring.completionRate)} e handoff em ${percent(monitoring.handoffSuccessRate)} ainda não formam uma amostra suficiente para alterar autonomia ou runtime.`,
      expectedImpact:
        "Aumentar a confiança estatística da decisão e separar uma tendência operacional de um resultado pontual.",
      riskLevel: "medium",
      source: "system",
      reviewSlaMinutes: 240,
      actions: [
        {
          sequence: 1,
          actorType: "muster",
          title: "Manter supervisão e agendar nova leitura",
          instructions: `Acompanhar os próximos ${missingRuns} runs sem alterar o runtime e recalcular conclusão, handoff, p95 e custo.`,
          capability: "schedule-reevaluation",
          executionMode: "autonomous",
          controlScope: "muster-internal",
          owner: "Muster",
          slaMinutes: 60,
        },
        ...(samplingStep?.agentId
          ? [{
              sequence: 2,
              actorType: "agent" as const,
              agentId: samplingStep.agentId,
              title: "Completar amostra controlada",
              instructions: `Executar mais ${missingRuns} casos elegíveis sem mudança de configuração e preservar evidências de etapa, handoff, custo e outcome.`,
              capability: "collect-baseline-sample",
              executionMode: "supervised" as const,
              controlScope: "external-agent" as const,
              owner: samplingStep.agentName ?? "Agente da etapa",
              slaMinutes: 240,
            }]
          : []),
        {
          sequence: samplingStep?.agentId ? 3 : 2,
          actorType: "human",
          title: "Revisar a baseline antes de mudar autonomia",
          instructions: "Confirmar se a amostra representa o trabalho contratado e se os guardrails foram respeitados.",
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
  const slaMs = context.slaMinutes && context.slaMinutes > 0
    ? context.slaMinutes * 60_000
    : null;
  const p95WithinSla =
    slaMs === null || monitoring.p95DurationMs === null || monitoring.p95DurationMs <= slaMs;
  const stableOutcome =
    !monitoring.illusoryVictory &&
    completionRate >= 0.9 &&
    (handoffRate === null || handoffRate >= 0.9) &&
    p95WithinSla;
  if (stableOutcome) {
    return {
      stepId: bottleneckStep?.id ?? null,
      agentId: bottleneckStep?.agentId ?? null,
      title: "Preservar desempenho e confirmar estabilidade",
      rationale:
        `A jornada conclui ${percent(completionRate)} dos runs, com handoff em ${percent(handoffRate)}` +
        (context.slaMinutes
          ? ` e p95 dentro do SLA de ${context.slaMinutes} minutos.`
          : "."),
      expectedImpact:
        "Confirmar que o desempenho se mantém em novos ciclos antes de promover autonomia, aumentar volume ou reduzir supervisão.",
      riskLevel: "medium",
      source: "system",
      reviewSlaMinutes: 480,
      actions: [
        {
          sequence: 1,
          actorType: "muster",
          title: "Manter monitoramento contínuo",
          instructions: "Agendar nova leitura após o próximo ciclo comparável e preservar a configuração atual.",
          capability: "schedule-reevaluation",
          executionMode: "autonomous",
          controlScope: "muster-internal",
          owner: "Muster",
          slaMinutes: 60,
        },
        {
          sequence: 2,
          actorType: "human",
          title: "Confirmar prontidão para promoção",
          instructions: "Validar representatividade da amostra, aderência ao propósito e ausência de regressão antes de ampliar autonomia.",
          capability: "approve-promotion-readiness",
          executionMode: "human-only",
          controlScope: "human-decision",
          owner: "Owner da jornada",
          slaMinutes: 480,
        },
      ],
    };
  }

  const critical = completionRate < 0.5;
  const high =
    monitoring.illusoryVictory ||
    completionRate < 0.75 ||
    (handoffRate !== null && handoffRate < 0.8);
  const riskLevel = critical ? "critical" : high ? "high" : "medium";
  const reviewSlaMinutes = critical ? 60 : high ? 120 : 240;
  const bottleneckName = bottleneckStep?.name ?? "etapa com maior atrito";
  const title = monitoring.illusoryVictory
    ? `Corrigir perda end-to-end após ${bottleneckName}`
    : completionRate < 0.9
      ? `Recuperar conclusão após ${bottleneckName}`
      : handoffRate !== null && handoffRate < 0.9
        ? `Corrigir handoff após ${bottleneckName}`
        : !p95WithinSla
          ? `Reduzir tempo em ${bottleneckName}`
          : `Revisar desvio em ${bottleneckName}`;
  const expectedImpact = [
    completionRate < 0.9 ? "elevar a conclusão end-to-end" : null,
    handoffRate !== null && handoffRate < 0.9 ? "recuperar a integridade dos handoffs" : null,
    !p95WithinSla ? "trazer o p95 para dentro do SLA" : null,
    "preservar guardrails antes de ampliar autonomia",
  ].filter(Boolean).join(", ");

  return {
    stepId: bottleneckStep?.id ?? null,
    agentId: bottleneckStep?.agentId ?? null,
    title,
    rationale:
      `A jornada conclui ${percent(completionRate)} dos runs, com handoff em ${percent(handoffRate)}. ` +
      `${bottleneckName} concentra a maior duração média observada` +
      (monitoring.illusoryVictory
        ? " e há sucesso local sem confirmação equivalente no outcome final."
        : "."),
    expectedImpact: `${expectedImpact.charAt(0).toUpperCase()}${expectedImpact.slice(1)}.`,
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
      ...(bottleneckStep?.agentId
        ? [{
            sequence: 2,
            actorType: "agent" as const,
            agentId: bottleneckStep.agentId,
            title: `Ajustar execução de ${bottleneckName}`,
            instructions:
              "Aplicar o feedback aprovado em ambiente controlado, preservar o envelope de contexto e reportar evidências antes/depois.",
            capability: "apply-agent-adjustment",
            executionMode: "supervised" as const,
            controlScope: "external-agent" as const,
            owner: bottleneckStep.agentName ?? "Agente da etapa",
            slaMinutes: critical ? 120 : 240,
          }]
        : []),
      {
        sequence: bottleneckStep?.agentId ? 3 : 2,
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
