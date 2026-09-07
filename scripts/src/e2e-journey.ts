export {};

import { requireMusterSessionToken } from "./muster-session";

const baseUrl = (process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(
  /\/+$/,
  "",
);
const authToken = requireMusterSessionToken();
const prefix = "Gauntlet A2A";

type Created = { id: string };
type Agent = Created & { name: string };
type Purpose = Created & { name: string; key: string };
type Team = Created & { name: string };
type Journey = Created & { name: string };
type JourneyStep = Created & { name: string };
type JourneyEvent = Created & { externalEventId?: string };

interface Monitoring {
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  failedRuns: number;
  completionRate: number | null;
  handoffSuccessRate: number | null;
  bottleneckStepId: string | null;
  illusoryVictory: boolean;
  warnings: string[];
  steps: Array<{
    stepId: string;
    executions: number;
    successRate: number | null;
  }>;
  recentRuns: Array<{ runId: string; status: string }>;
}

interface RecommendationAction extends Created {
  actorType: "muster" | "agent" | "human";
  status: "proposed" | "ready" | "in-progress" | "blocked" | "completed" | "cancelled";
  dueAt: string | null;
  result: string | null;
}

interface Recommendation extends Created {
  status: "pending" | "approved" | "rejected" | "executing" | "blocked" | "completed";
  rejectionDisposition: "revise" | "close" | "escalate" | null;
  nextReviewAt: string | null;
  actions: RecommendationAction[];
  autonomySummary: { muster: number; agent: number; human: number };
}

class ValidationError extends Error {
  constructor(message: string, readonly observed?: unknown) {
    super(message);
    this.name = "ValidationError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${authToken}`,
      ...init.headers,
    },
  });
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    throw new ValidationError(`${init.method ?? "GET"} ${path} retornou ${response.status}`, body);
  }
  return body as T;
}

function assertThat(condition: unknown, message: string, observed?: unknown): asserts condition {
  if (!condition) throw new ValidationError(message, observed);
}

async function createAgent(name: string, role: string): Promise<Agent> {
  const detail = await request<{ agent: Agent }>("/agents", {
    method: "POST",
    body: JSON.stringify({
      name,
      role,
      platform: "a2a-gauntlet",
      version: "1.0.0",
      bio: `Agente sintético para validar a jornada ${prefix}.`,
      tagline: "Validação de orquestração multiagente",
      autonomyLevel: "escalates",
      shouldDo: ["Executar a etapa atribuída", "Preservar o contexto no handoff"],
      shouldNotDo: ["Decidir fora dos guardrails"],
      limits: ["Somente dados sintéticos"],
      businessOwner: "Gauntlet",
      technicalOwner: "Gauntlet",
      governanceSponsor: "Gauntlet",
      baseline: "10 execuções controladas",
      targetPayback: "Validação imediata",
      businessCaseDescription: "Validar a cadeia A2A ponta a ponta.",
      proposedMetrics: [],
    }),
  });
  return detail.agent;
}

async function postEvent(journeyId: string, event: Record<string, unknown>) {
  return request<JourneyEvent>(`/journeys/${journeyId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
}

async function main() {
  const runSuffix = crypto.randomUUID().slice(0, 8);
  const created = {
    journeyId: "",
    teamId: "",
    purposeId: "",
    agentIds: [] as string[],
  };
  const startedAt = Date.now();

  try {
    await request<unknown>("/healthz");

    const agents = await Promise.all([
      createAgent(`${prefix} Triagem ${runSuffix}`, "Triagem e classificação"),
      createAgent(`${prefix} Decisão ${runSuffix}`, "Decisão e planejamento"),
      createAgent(`${prefix} Execução ${runSuffix}`, "Execução e confirmação"),
    ]);
    created.agentIds.push(...agents.map((agent) => agent.id));

    const purpose = await request<Purpose>("/purposes", {
      method: "POST",
      body: JSON.stringify({
        key: `gauntlet-a2a-${runSuffix}`,
        name: `${prefix} ${runSuffix}`,
        domain: "operacoes",
        outcome: "Resolver a solicitação com decisão rastreável e handoffs íntegros.",
        riskTier: "high",
      }),
    });
    created.purposeId = purpose.id;

    const team = await request<Team>("/teams", {
      method: "POST",
      body: JSON.stringify({
        name: `${prefix} Fleet ${runSuffix}`,
        purposeId: purpose.id,
      }),
    });
    created.teamId = team.id;

    await Promise.all(
      agents.map((agent, index) =>
        request(`/teams/${team.id}/agents`, {
          method: "POST",
          body: JSON.stringify({
            agentId: agent.id,
            assignmentRole: index === 0 ? "primary" : index === 2 ? "reviewer" : "supporting",
            responsibility: ["Qualificar entrada", "Tomar decisão", "Executar e validar outcome"][index],
          }),
        }),
      ),
    );

    const journey = await request<Journey>("/journeys", {
      method: "POST",
      body: JSON.stringify({
        teamId: team.id,
        name: `${prefix} Resolução ${runSuffix}`,
        description: "Frota de decisão com três agentes e supervisão por etapa.",
        entryCriterion: "Solicitação válida recebida",
        successCriterion: "Outcome confirmado e contexto auditável",
        status: "active",
        slaMinutes: 15,
        owner: "Gauntlet Supervisor",
      }),
    });
    created.journeyId = journey.id;

    const stepPayloads = [
      {
        stepKey: "triagem",
        name: "Triagem de contexto",
        sequence: 1,
        agentId: agents[0]!.id,
        responsibility: "Classificar intenção, risco e dados ausentes.",
        decisionMode: "autonomous",
        expectedDurationMs: 900,
        guardrails: ["Não prosseguir sem intenção classificada"],
      },
      {
        stepKey: "decisao",
        name: "Decisão coordenada",
        sequence: 2,
        agentId: agents[1]!.id,
        responsibility: "Selecionar a próxima melhor ação.",
        decisionMode: "human-approval",
        expectedDurationMs: 1_500,
        guardrails: ["Exigir aprovação para risco alto"],
      },
      {
        stepKey: "execucao",
        name: "Execução e validação",
        sequence: 3,
        agentId: agents[2]!.id,
        responsibility: "Executar a ação e confirmar o outcome.",
        decisionMode: "committee",
        expectedDurationMs: 2_500,
        guardrails: ["Confirmar resultado antes de encerrar"],
      },
    ];
    const steps = await Promise.all(
      stepPayloads.map((payload) =>
        request<JourneyStep>(`/journeys/${journey.id}/steps`, {
          method: "POST",
          body: JSON.stringify({ ...payload, stepType: "agent", required: true }),
        }),
      ),
    );

    await request(`/journeys/${journey.id}/handoffs`, {
      method: "POST",
      body: JSON.stringify({
        fromStepId: steps[0]!.id,
        toStepId: steps[1]!.id,
        condition: "contexto válido",
        protocol: "a2a",
        requiredContext: ["intent", "risk", "customer_context"],
      }),
    });
    await request(`/journeys/${journey.id}/handoffs`, {
      method: "POST",
      body: JSON.stringify({
        fromStepId: steps[1]!.id,
        toStepId: steps[2]!.id,
        condition: "decisão aprovada",
        protocol: "a2a",
        requiredContext: ["decision", "confidence", "approval"],
      }),
    });

    for (let index = 0; index < 10; index += 1) {
      const runId = `run-${runSuffix}-${index + 1}`;
      const baseTime = Date.now() - (10 - index) * 60_000;
      await postEvent(journey.id, {
        externalEventId: `${runId}-start`,
        runId,
        kind: "journey_started",
        ts: new Date(baseTime).toISOString(),
      });
      await postEvent(journey.id, {
        externalEventId: `${runId}-triage`,
        runId,
        stepId: steps[0]!.id,
        agentId: agents[0]!.id,
        kind: "step_completed",
        ts: new Date(baseTime + 800).toISOString(),
        durationMs: 800,
        costCents: 5,
        success: true,
      });
      await postEvent(journey.id, {
        externalEventId: `${runId}-handoff-1`,
        runId,
        fromStepId: steps[0]!.id,
        toStepId: steps[1]!.id,
        kind: "handoff",
        ts: new Date(baseTime + 900).toISOString(),
        success: true,
      });
      await postEvent(journey.id, {
        externalEventId: `${runId}-decision`,
        runId,
        stepId: steps[1]!.id,
        agentId: agents[1]!.id,
        kind: "step_completed",
        ts: new Date(baseTime + 2_300).toISOString(),
        durationMs: 1_400,
        costCents: 12,
        success: true,
      });

      const completed = index < 6;
      await postEvent(journey.id, {
        externalEventId: `${runId}-handoff-2`,
        runId,
        fromStepId: steps[1]!.id,
        toStepId: steps[2]!.id,
        kind: "handoff",
        ts: new Date(baseTime + 2_400).toISOString(),
        success: completed,
      });
      if (completed) {
        await postEvent(journey.id, {
          externalEventId: `${runId}-execution`,
          runId,
          stepId: steps[2]!.id,
          agentId: agents[2]!.id,
          kind: "step_completed",
          ts: new Date(baseTime + 5_200).toISOString(),
          durationMs: 2_800,
          costCents: 20,
          success: true,
        });
        await postEvent(journey.id, {
          externalEventId: `${runId}-complete`,
          runId,
          kind: "journey_completed",
          ts: new Date(baseTime + 5_300).toISOString(),
          durationMs: 5_300,
          success: true,
        });
      } else {
        await postEvent(journey.id, {
          externalEventId: `${runId}-failed`,
          runId,
          stepId: steps[1]!.id,
          kind: "journey_failed",
          ts: new Date(baseTime + 2_500).toISOString(),
          durationMs: 2_500,
          success: false,
          metadata: { reason: "handoff_context_rejected" },
        });
      }
    }

    const duplicatePayload = {
      externalEventId: `run-${runSuffix}-1-start`,
      runId: `run-${runSuffix}-1`,
      kind: "journey_started",
    };
    const duplicate = await postEvent(journey.id, duplicatePayload);
    assertThat(duplicate.externalEventId === duplicatePayload.externalEventId, "Idempotência não retornou o evento original", duplicate);

    const monitoring = await request<Monitoring>(`/journeys/${journey.id}/monitoring`);
    assertThat(monitoring.totalRuns === 10, "Total de runs incorreto", monitoring);
    assertThat(monitoring.completedRuns === 6 && monitoring.failedRuns === 4, "Estados finais incorretos", monitoring);
    assertThat(monitoring.activeRuns === 0, "Há runs indevidamente ativos", monitoring);
    assertThat(monitoring.completionRate === 0.6, "Taxa de conclusão incorreta", monitoring);
    assertThat(monitoring.handoffSuccessRate === 0.8, "Taxa de handoff incorreta", monitoring);
    assertThat(monitoring.illusoryVictory, "Detector de vitória ilusória não disparou", monitoring);
    assertThat(monitoring.bottleneckStepId === steps[2]!.id, "Gargalo incorreto", monitoring);
    assertThat(monitoring.steps.length === 3, "Monitoramento não retornou as três etapas", monitoring);

    const generated = await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/generate`,
      { method: "POST", body: JSON.stringify({}) },
    );
    assertThat(generated.status === "pending", "Recomendação gerada fora do estado pending", generated);
    assertThat(
      generated.autonomySummary.muster === 1 &&
        generated.autonomySummary.agent === 1 &&
        generated.autonomySummary.human === 1,
      "Recomendação não separou Muster, agente e humano",
      generated,
    );

    const approved = await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${generated.id}/decision`,
      {
        method: "POST",
        body: JSON.stringify({
          decision: "approved",
          decidedBy: "Gauntlet Supervisor",
          reason: "O gargalo foi confirmado e as mudanças permanecem dentro dos guardrails.",
        }),
      },
    );
    const musterAction = approved.actions.find((action) => action.actorType === "muster");
    const agentAction = approved.actions.find((action) => action.actorType === "agent");
    const humanAction = approved.actions.find((action) => action.actorType === "human");
    assertThat(approved.status === "approved", "Aprovação não liberou a recomendação", approved);
    assertThat(Boolean(approved.nextReviewAt), "Aprovação não agendou o próximo review", approved);
    assertThat(musterAction?.status === "completed", "Ação autônoma do Muster não executou", approved);
    assertThat(agentAction?.status === "ready" && Boolean(agentAction.dueAt), "Ação do agente não foi liberada com SLA", approved);
    assertThat(humanAction?.status === "ready" && Boolean(humanAction.dueAt), "Ação humana não foi liberada com SLA", approved);

    await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${approved.id}/actions/${agentAction!.id}`,
      { method: "PATCH", body: JSON.stringify({ status: "in-progress" }) },
    );
    const blocked = await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${approved.id}/actions/${agentAction!.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "blocked",
          result: "Aguardando credencial temporária do ambiente controlado.",
        }),
      },
    );
    assertThat(blocked.status === "blocked", "Bloqueio da ação não escalou o estado", blocked);
    await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${approved.id}/actions/${agentAction!.id}`,
      { method: "PATCH", body: JSON.stringify({ status: "ready" }) },
    );
    await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${approved.id}/actions/${agentAction!.id}`,
      { method: "PATCH", body: JSON.stringify({ status: "in-progress" }) },
    );
    await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${approved.id}/actions/${agentAction!.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          result: "Ajuste aplicado em amostra controlada com evidência antes/depois.",
        }),
      },
    );
    await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${approved.id}/actions/${humanAction!.id}`,
      { method: "PATCH", body: JSON.stringify({ status: "in-progress" }) },
    );
    const completed = await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${approved.id}/actions/${humanAction!.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          result: "Guardrails revisados e impacto aceito pelo owner da jornada.",
        }),
      },
    );
    assertThat(completed.status === "completed", "Plano aprovado não foi concluído", completed);

    const secondGenerated = await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/generate`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const rejected = await request<Recommendation>(
      `/journeys/${journey.id}/recommendations/${secondGenerated.id}/decision`,
      {
        method: "POST",
        body: JSON.stringify({
          decision: "rejected",
          decidedBy: "Gauntlet Supervisor",
          reason: "A amostra atual não sustenta uma segunda alteração de runtime.",
          rejectionDisposition: "revise",
        }),
      },
    );
    assertThat(rejected.status === "rejected", "Rejeição não encerrou a execução", rejected);
    assertThat(rejected.rejectionDisposition === "revise", "Destino da rejeição incorreto", rejected);
    assertThat(
      rejected.actions.every((action) => action.status === "cancelled"),
      "Ações rejeitadas não foram canceladas",
      rejected,
    );

    const monitoringAfterGovernance = await request<Monitoring>(`/journeys/${journey.id}/monitoring`);
    assertThat(
      monitoringAfterGovernance.totalRuns === 10,
      "Eventos de governança contaminaram os runs operacionais",
      monitoringAfterGovernance,
    );

    console.log(JSON.stringify({
      status: "passed",
      durationMs: Date.now() - startedAt,
      journeyId: journey.id,
      fleet: agents.map((agent) => ({ id: agent.id, name: agent.name })),
      monitoring,
      recommendationLifecycle: {
        approved: completed.id,
        rejected: rejected.id,
        rejectionDisposition: rejected.rejectionDisposition,
      },
    }, null, 2));
  } finally {
    if (created.journeyId) {
      await request(`/journeys/${created.journeyId}`, { method: "DELETE" }).catch(() => undefined);
    }
    if (created.teamId) {
      await request(`/teams/${created.teamId}`, { method: "DELETE" }).catch(() => undefined);
    }
    if (created.purposeId) {
      await request(`/purposes/${created.purposeId}`, { method: "DELETE" }).catch(() => undefined);
    }
    await Promise.all(
      created.agentIds.map((agentId) =>
        request(`/agents/${agentId}`, { method: "DELETE" }).catch(() => undefined),
      ),
    );
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "failed",
    message: error instanceof Error ? error.message : String(error),
    observed: error instanceof ValidationError ? error.observed : undefined,
  }, null, 2));
  process.exitCode = 1;
});
