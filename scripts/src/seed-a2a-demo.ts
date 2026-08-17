export {};

const baseUrl = (process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");
const demoJourneySlug = "resolucao-atendimento-a2a-demo";

type Agent = { id: string; name: string; role: string };
type Purpose = { id: string; key: string; name: string };
type Team = { id: string; slug: string; name: string };
type TeamDetail = Team & { assignments: Array<{ agentId: string; status: string }> };
type Journey = { id: string; slug: string; name: string };
type Step = { id: string; stepKey: string; name: string };
type Handoff = { id: string; fromStepId: string; toStepId: string };
type JourneyDetail = Journey & { steps: Step[]; handoffs: Handoff[] };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const raw = await response.text();
  let body: unknown = undefined;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

async function ensurePurpose(): Promise<Purpose> {
  const purposes = await request<Purpose[]>("/purposes");
  const existing = purposes.find((purpose) => purpose.key === "atendimento-resolutivo");
  if (existing) return existing;
  return post<Purpose>("/purposes", {
    key: "atendimento-resolutivo",
    name: "Atendimento resolutivo",
    domain: "atendimento",
    outcome: "Resolver solicitações com qualidade e decisão rastreável.",
    riskTier: "medium",
  });
}

async function ensureTeam(purpose: Purpose): Promise<Team> {
  const teams = await request<Team[]>("/teams");
  const existing = teams.find((team) => team.slug === "squad-atendimento-hibrido");
  if (existing) return existing;
  return post<Team>("/teams", {
    name: "Squad Atendimento Híbrido",
    slug: "squad-atendimento-hibrido",
    description: "Time humano-agente responsável pela resolução ponta a ponta.",
    purposeId: purpose.id,
  });
}

async function ensureAssignments(team: Team, fleet: Agent[]) {
  const detail = await request<TeamDetail>(`/teams/${team.id}`);
  const assigned = new Set(
    detail.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => assignment.agentId),
  );
  for (const [index, agent] of fleet.entries()) {
    if (assigned.has(agent.id)) continue;
    await post(`/teams/${team.id}/agents`, {
      agentId: agent.id,
      assignmentRole: index === 0 ? "primary" : index === 2 ? "reviewer" : "supporting",
      responsibility: [
        "Qualificar a solicitação e preparar contexto",
        "Recomendar a decisão e preservar evidências",
        "Validar risco, exceções e necessidade de escalonamento",
      ][index],
    });
  }
}

async function ensureJourney(team: Team): Promise<Journey> {
  const journeys = await request<Journey[]>("/journeys");
  const existing = journeys.find((journey) => journey.slug === demoJourneySlug);
  if (existing) return existing;
  return post<Journey>("/journeys", {
    teamId: team.id,
    name: "Resolução inteligente de atendimento",
    slug: demoJourneySlug,
    description: "Cenário sintético de validação: triagem, decisão e revisão de risco em uma frota A2A.",
    entryCriterion: "Ticket elegível recebido com identificação e intenção mínima.",
    successCriterion: "Solicitação resolvida, evidência registrada e cliente notificado.",
    status: "active",
    slaMinutes: 20,
    owner: "Supervisão de Operações",
  });
}

async function ensureSteps(journey: Journey, fleet: Agent[]): Promise<Step[]> {
  let detail = await request<JourneyDetail>(`/journeys/${journey.id}`);
  const definitions = [
    {
      stepKey: "triagem-contextual",
      name: "Triagem contextual",
      agentId: fleet[0]!.id,
      responsibility: "Classificar intenção, prioridade e contexto necessário.",
      decisionMode: "autonomous",
      expectedDurationMs: 45_000,
      guardrails: ["Não avançar sem identificação", "Escalar risco crítico"],
    },
    {
      stepKey: "decisao-proxima-acao",
      name: "Decisão de próxima ação",
      agentId: fleet[1]!.id,
      responsibility: "Selecionar resposta, ação ou rota de escalonamento.",
      decisionMode: "human-approval",
      expectedDurationMs: 75_000,
      guardrails: ["Exigir confiança mínima de 80%", "Registrar evidência da decisão"],
    },
    {
      stepKey: "revisao-risco-outcome",
      name: "Revisão de risco e outcome",
      agentId: fleet[2]!.id,
      responsibility: "Validar conformidade, resultado e necessidade de intervenção humana.",
      decisionMode: "committee",
      expectedDurationMs: 110_000,
      guardrails: ["Bloquear encerramento sem outcome", "Revisão humana para risco alto"],
    },
  ];

  for (const [index, definition] of definitions.entries()) {
    if (detail.steps.some((step) => step.stepKey === definition.stepKey)) continue;
    await post(`/journeys/${journey.id}/steps`, {
      ...definition,
      sequence: index + 1,
      stepType: "agent",
      required: true,
    });
    detail = await request<JourneyDetail>(`/journeys/${journey.id}`);
  }
  return [...detail.steps].sort((left, right) =>
    definitions.findIndex((item) => item.stepKey === left.stepKey) -
    definitions.findIndex((item) => item.stepKey === right.stepKey),
  );
}

async function ensureHandoffs(journey: Journey, steps: Step[]) {
  const detail = await request<JourneyDetail>(`/journeys/${journey.id}`);
  const paths = [
    {
      fromStepId: steps[0]!.id,
      toStepId: steps[1]!.id,
      condition: "Contexto mínimo completo e intenção classificada",
      requiredContext: ["ticket_id", "intent", "priority", "customer_context"],
    },
    {
      fromStepId: steps[1]!.id,
      toStepId: steps[2]!.id,
      condition: "Próxima ação definida com confiança e evidência",
      requiredContext: ["decision", "confidence", "evidence", "approval_status"],
    },
  ];
  for (const path of paths) {
    if (detail.handoffs.some(
      (handoff) => handoff.fromStepId === path.fromStepId && handoff.toStepId === path.toStepId,
    )) continue;
    await post(`/journeys/${journey.id}/handoffs`, {
      ...path,
      protocol: "a2a-context-envelope-v1",
    });
  }
}

async function seedEvents(journey: Journey, steps: Step[], fleet: Agent[]) {
  const now = Date.now();
  for (let index = 0; index < 8; index += 1) {
    const runId = `demo-a2a-run-${index + 1}`;
    const startedAt = now - (8 - index) * 12 * 60_000;
    const completed = index < 6;
    const common = { synthetic: true, scenario: "a2a-demo", source: "seed-a2a-demo" };
    const events: Array<Record<string, unknown>> = [
      { kind: "journey_started", ts: startedAt },
      { kind: "step_completed", stepId: steps[0]!.id, agentId: fleet[0]!.id, ts: startedAt + 38_000, durationMs: 38_000, costCents: 12, success: true },
      { kind: "handoff", fromStepId: steps[0]!.id, toStepId: steps[1]!.id, ts: startedAt + 40_000, success: true },
      { kind: "step_completed", stepId: steps[1]!.id, agentId: fleet[1]!.id, ts: startedAt + 105_000, durationMs: 65_000, costCents: 24, success: true },
      { kind: "handoff", fromStepId: steps[1]!.id, toStepId: steps[2]!.id, ts: startedAt + 108_000, success: completed },
    ];
    if (completed) {
      events.push(
        { kind: "step_completed", stepId: steps[2]!.id, agentId: fleet[2]!.id, ts: startedAt + 205_000, durationMs: 97_000, costCents: 31, success: true },
        { kind: "journey_completed", ts: startedAt + 210_000, durationMs: 210_000, success: true },
      );
    } else {
      events.push({ kind: "journey_failed", stepId: steps[1]!.id, agentId: fleet[1]!.id, ts: startedAt + 115_000, durationMs: 115_000, success: false });
    }
    for (const [eventIndex, event] of events.entries()) {
      await post(`/journeys/${journey.id}/events`, {
        externalEventId: `${runId}-${eventIndex + 1}`,
        runId,
        metadata: common,
        ...event,
        ts: new Date(event.ts as number).toISOString(),
      });
    }
  }
}

async function main() {
  const agents = await request<Agent[]>("/agents");
  const preferredNames = ["Sofia", "Júlia", "Diego"];
  const fleet = preferredNames
    .map((name) => agents.find((agent) => agent.name === name))
    .filter((agent): agent is Agent => Boolean(agent));
  if (fleet.length < 3) throw new Error("São necessários três agentes para a demonstração A2A.");

  const purpose = await ensurePurpose();
  const team = await ensureTeam(purpose);
  await ensureAssignments(team, fleet);
  const journey = await ensureJourney(team);
  const steps = await ensureSteps(journey, fleet);
  await ensureHandoffs(journey, steps);
  await seedEvents(journey, steps, fleet);
  const monitoring = await request(`/journeys/${journey.id}/monitoring`);

  console.log(JSON.stringify({
    status: "ready",
    journey: { id: journey.id, name: journey.name, slug: journey.slug },
    fleet: fleet.map((agent) => ({ id: agent.id, name: agent.name, role: agent.role })),
    dataSource: "synthetic-demo",
    monitoring,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
