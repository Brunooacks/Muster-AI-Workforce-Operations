import {
  createMusterReporter,
  type AgentEvent,
} from "@workspace/telemetry-reporter";
import { requireMusterSessionToken } from "./muster-session";

const baseUrl = (process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(
  /\/+$/,
  "",
);
const authToken = requireMusterSessionToken();
const syntheticPrefix = "Gauntlet E2E";
const realtimeBudgetMs = 30_000;

type ProfileKey = "healthy" | "degrading" | "erratic";
type Verdict = "promote" | "mentor" | "retire" | "observation";

interface AgentSummary {
  id: string;
  name: string;
}

interface AgentDetail {
  agent: {
    id: string;
    name: string;
    role: string;
    platform: string;
    healthScore: number;
  };
  latestEvaluation: {
    layers: Array<{
      key: string;
      score: number;
      metrics: Array<{ label: string; target?: string }>;
    }>;
  };
}

interface TelemetrySummary {
  totalExecutions: number;
  successRate: number | null;
  avgDurationMs: number | null;
  totalCostCents: number;
  escalationRate: number | null;
  errorRate: number | null;
  lastEventAt: string | null;
}

interface Supervision {
  status: "live" | "delayed" | "stale" | "unknown";
  isStale: boolean;
  lastHeartbeatAt: string | null;
  runtime?: string | null;
}

interface Reevaluation {
  agentId: string;
  changed: boolean;
  healthScore: number;
  verdict: Verdict;
  dataSource: "telemetry" | "seeded" | "mixed" | "none";
  rationale: string;
  rulesFired?: string[];
}

interface VerdictRecord {
  id: string;
  agentId: string;
  verdict: Verdict;
  confidence: number;
  decision: "pending" | "approved" | "disagreed" | "exported";
  decidedBy?: string | null;
  decidedAt?: string | null;
  rationale: string;
}

interface EvidenceRecord {
  id: string;
  metricKey: string;
  agentId?: string | null;
  confidence: number;
  sampleSize?: number;
}

interface StepResult {
  step: string;
  status: "passed" | "failed";
  durationMs: number;
  observed?: unknown;
}

interface ProfileResult {
  profile: ProfileKey;
  vertical: string;
  platform: string;
  agentId: string;
  telemetry: TelemetrySummary;
  supervision: Supervision;
  reevaluation: Reevaluation;
  evidenceCount: number;
  committeeDecision: VerdictRecord["decision"];
  audit: VerdictRecord;
}

interface ProfileDefinition {
  key: ProfileKey;
  label: string;
  platform: string;
  vertical: string;
  role: string;
  committeeDecision: "approved" | "disagreed";
  execution: (index: number) => AgentEvent;
  additionalEvents: AgentEvent[];
}

class InvariantError extends Error {
  constructor(
    readonly step: string,
    message: string,
    readonly observed: unknown,
  ) {
    super(message);
    this.name = "InvariantError";
  }
}

const steps: StepResult[] = [];
const createdAgentIds = new Set<string>();

function observedError(error: unknown): unknown {
  if (error instanceof InvariantError) {
    return {
      name: error.name,
      message: error.message,
      step: error.step,
      observed: error.observed,
    };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

function assertInvariant(
  step: string,
  condition: unknown,
  message: string,
  observed: unknown,
): asserts condition {
  if (!condition) throw new InvariantError(step, message, observed);
}

async function runStep<T>(
  step: string,
  operation: () => Promise<T>,
  summarize?: (result: T) => unknown,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    steps.push({
      step,
      status: "passed",
      durationMs: Date.now() - startedAt,
      ...(summarize ? { observed: summarize(result) } : {}),
    });
    return result;
  } catch (error) {
    steps.push({
      step,
      status: "failed",
      durationMs: Date.now() - startedAt,
      observed: observedError(error),
    });
    throw error;
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
  const rawBody = await response.text();
  let body: unknown = undefined;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }
  if (!response.ok) {
    throw new InvariantError(
      `${init.method ?? "GET"} ${path}`,
      `API respondeu ${response.status}.`,
      { status: response.status, body },
    );
  }
  return body as T;
}

function createProfiles(): ProfileDefinition[] {
  const executionMetadata = (
    profile: ProfileKey,
    vertical: string,
    index: number,
  ) => ({
    gauntlet: true,
    profile,
    vertical,
    executionIndex: index + 1,
  });

  return [
    {
      key: "healthy",
      label: "Saudável",
      platform: "langchain",
      vertical: "engenharia-it",
      role: "Analista de confiabilidade e operações de engenharia",
      committeeDecision: "approved",
      execution: (index) => ({
        kind: "execution",
        durationMs: 850 + (index % 5) * 70,
        costCents: 20 + (index % 4),
        tokensIn: 180 + index,
        tokensOut: 90 + index,
        success: true,
        metadata: executionMetadata("healthy", "engenharia-it", index),
      }),
      additionalEvents: [],
    },
    {
      key: "degrading",
      label: "Degradando",
      platform: "crewai",
      vertical: "atendimento",
      role: "Qualificador e triador de solicitações de atendimento",
      committeeDecision: "disagreed",
      execution: (index) => ({
        kind: "execution",
        durationMs: 2_100 + (index % 6) * 110,
        costCents: 28 + (index % 5),
        tokensIn: 230 + index * 2,
        tokensOut: 120 + index,
        success: index < 24,
        metadata: executionMetadata("degrading", "atendimento", index),
      }),
      additionalEvents: [
        ...Array.from({ length: 4 }, (_, index) => ({
          kind: "error" as const,
          costCents: 12,
          metadata: executionMetadata("degrading", "atendimento", index),
        })),
        ...Array.from({ length: 8 }, (_, index) => ({
          kind: "escalation" as const,
          metadata: executionMetadata("degrading", "atendimento", index),
        })),
      ],
    },
    {
      key: "erratic",
      label: "Errático",
      platform: "agno",
      vertical: "vendas-crm",
      role: "Prospector e assistente de operações comerciais",
      committeeDecision: "approved",
      execution: (index) => ({
        kind: "execution",
        durationMs: index % 2 === 0 ? 1_100 : 9_200,
        costCents: index % 3 === 0 ? 45 : 95,
        tokensIn: 400 + index * 7,
        tokensOut: 250 + index * 4,
        success: index % 2 === 0,
        metadata: executionMetadata("erratic", "vendas-crm", index),
      }),
      additionalEvents: [
        ...Array.from({ length: 15 }, (_, index) => ({
          kind: "error" as const,
          costCents: 35,
          metadata: executionMetadata("erratic", "vendas-crm", index),
        })),
        ...Array.from({ length: 12 }, (_, index) => ({
          kind: "escalation" as const,
          metadata: executionMetadata("erratic", "vendas-crm", index),
        })),
      ],
    },
  ];
}

function admissionPayload(profile: ProfileDefinition, runId: string) {
  const name = `${syntheticPrefix} ${profile.label} ${runId}`;
  return {
    name,
    role: profile.role,
    platform: profile.platform,
    version: "gauntlet-1",
    bio: `Agente sintético do Gauntlet para validar o perfil ${profile.label.toLowerCase()} no vertical ${profile.vertical}.`,
    tagline: `Validação E2E ${profile.vertical}`,
    shouldDo: [
      "Executar tarefas do vertical declarado",
      "Reportar telemetria e escalonar exceções",
    ],
    shouldNotDo: ["Executar ações irreversíveis sem aprovação humana"],
    autonomyLevel: "escalates",
    autonomyNotes: "O comitê mantém a decisão final durante o Gauntlet.",
    limits: ["Somente dados sintéticos", "Sem acesso a credenciais reais"],
    businessOwner: "Gauntlet Business Owner",
    technicalOwner: "Gauntlet Technical Owner",
    governanceSponsor: "Gauntlet Committee",
    baseline: "30 execuções sintéticas com perfil controlado antes da decisão.",
    targetPayback: "Validação imediata da cadeia de evidência.",
    businessCaseDescription: `Provar o ciclo operacional do Muster em ${profile.vertical}.`,
    proposedMetrics: [
      {
        layer: "efficacy",
        label: "Qualidade da execução",
        unit: "%",
        target: "≥ 90%",
        value: profile.key === "healthy" ? 98 : profile.key === "degrading" ? 80 : 50,
      },
      {
        layer: "efficiency",
        label: "Tempo de resposta",
        unit: "s",
        target: "< 3 s",
        value: profile.key === "healthy" ? 1 : profile.key === "degrading" ? 2.5 : 6,
      },
      {
        layer: "adoption",
        label: "Execuções observadas",
        unit: "/dia",
        target: "≥ 1",
        value: 1,
      },
      {
        layer: "governance",
        label: "Taxa de erro",
        unit: "%",
        target: "≤ 5%",
        value: profile.key === "healthy" ? 0 : profile.key === "degrading" ? 13 : 50,
      },
      {
        layer: "value",
        label: "Custo controlado",
        unit: "R$",
        target: "≤ 30",
        value: profile.key === "healthy" ? 20 : profile.key === "degrading" ? 30 : 90,
      },
    ],
  };
}

async function waitForTelemetry(
  agentId: string,
  expectedExecutions: number,
): Promise<TelemetrySummary> {
  const deadline = Date.now() + realtimeBudgetMs;
  let observed: TelemetrySummary | undefined;
  while (Date.now() <= deadline) {
    observed = await request<TelemetrySummary>(
      `/agents/${encodeURIComponent(agentId)}/telemetry/30d`,
    );
    if (
      observed.totalExecutions >= expectedExecutions &&
      observed.lastEventAt !== null
    ) {
      return observed;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new InvariantError(
    "telemetry-realtime",
    `Telemetria não refletiu ${expectedExecutions} execuções em até ${realtimeBudgetMs / 1000}s.`,
    observed,
  );
}

async function cleanupSyntheticFleet(): Promise<number> {
  const agents = await request<AgentSummary[]>(
    `/agents?search=${encodeURIComponent(syntheticPrefix)}`,
  );
  const syntheticAgents = agents.filter((agent) =>
    agent.name.startsWith(syntheticPrefix),
  );
  await Promise.all(
    syntheticAgents.map((agent) =>
      request<void>(`/agents/${encodeURIComponent(agent.id)}`, {
        method: "DELETE",
      }),
    ),
  );
  for (const agent of syntheticAgents) createdAgentIds.delete(agent.id);
  return syntheticAgents.length;
}

async function exerciseProfile(
  profile: ProfileDefinition,
  detail: AgentDetail,
): Promise<ProfileResult> {
  const agentId = detail.agent.id;
  const reporterErrors: unknown[] = [];
  const credential = await request<{ plaintext: string }>(
    `/agents/${encodeURIComponent(agentId)}/api-keys`,
    { method: "POST", body: JSON.stringify({ label: "gauntlet-e2e" }) },
  );
  const reporter = createMusterReporter({
    baseUrl,
    agentId,
    token: credential.plaintext,
    onError: (error, event) => reporterErrors.push({ error: String(error), event }),
  });

  const heartbeatAccepted = await reporter.heartbeat({
    runtime: "gauntlet-headless",
    version: "1",
    intervalSeconds: 30,
    status: profile.key === "healthy" ? "healthy" : "degraded",
    metadata: {
      gauntlet: true,
      framework: profile.platform,
      vertical: profile.vertical,
    },
  });
  assertInvariant(
    `${profile.key}:heartbeat`,
    heartbeatAccepted,
    "Heartbeat não foi aceito pelo SDK.",
    reporterErrors,
  );

  const executions = Array.from({ length: 30 }, (_, index) =>
    profile.execution(index),
  );
  const events = [...executions, ...profile.additionalEvents];
  const deliveryStartedAt = Date.now();
  const delivered = await reporter.reportMany(events);
  assertInvariant(
    `${profile.key}:delivery`,
    delivered === events.length,
    "Nem todos os eventos foram aceitos pelo SDK.",
    { expected: events.length, delivered, reporterErrors },
  );

  const telemetry = await waitForTelemetry(agentId, executions.length);
  const deliveryLatencyMs = Date.now() - deliveryStartedAt;
  assertInvariant(
    `${profile.key}:realtime`,
    deliveryLatencyMs <= realtimeBudgetMs,
    "Telemetria excedeu o orçamento de tempo quase real.",
    { deliveryLatencyMs, telemetry },
  );

  const supervision = await request<Supervision>(
    `/agents/${encodeURIComponent(agentId)}/supervision`,
  );
  assertInvariant(
    `${profile.key}:supervision`,
    supervision.status === "live" && !supervision.isStale,
    "Supervisão não está ao vivo após heartbeat.",
    supervision,
  );

  const reevaluation = await request<Reevaluation>(
    `/agents/${encodeURIComponent(agentId)}/reevaluate`,
    { method: "POST", body: "{}" },
  );
  assertInvariant(
    `${profile.key}:data-source`,
    reevaluation.dataSource === "telemetry",
    "Reavaliação não usou exclusivamente telemetria real.",
    reevaluation,
  );

  const evaluatedDetail = await request<AgentDetail>(
    `/agents/${encodeURIComponent(agentId)}`,
  );
  const layerKeys = new Set(
    evaluatedDetail.latestEvaluation.layers.map((layer) => layer.key),
  );
  assertInvariant(
    `${profile.key}:five-layers`,
    layerKeys.size === 5 &&
      ["efficacy", "efficiency", "adoption", "governance", "value"].every(
        (layer) => layerKeys.has(layer),
      ),
    "Avaliação não contém as cinco camadas obrigatórias.",
    evaluatedDetail.latestEvaluation.layers,
  );

  const evidence = await request<EvidenceRecord[]>(
    `/evidence?agentId=${encodeURIComponent(agentId)}`,
  );
  assertInvariant(
    `${profile.key}:evidence`,
    evidence.length >= 5 &&
      evidence.every((record) => record.agentId === agentId),
    "Rastro de evidência incompleto ou atribuído ao agente errado.",
    evidence,
  );

  const repeated = await request<Reevaluation>(
    `/agents/${encodeURIComponent(agentId)}/reevaluate`,
    { method: "POST", body: "{}" },
  );
  assertInvariant(
    `${profile.key}:idempotency`,
    !repeated.changed && repeated.verdict === reevaluation.verdict,
    "Reavaliação idempotente alterou o resultado sem novos eventos.",
    { first: reevaluation, repeated },
  );

  const committee = await request<VerdictRecord>(
    `/agents/${encodeURIComponent(agentId)}/verdict/decision`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: profile.committeeDecision,
        reason: `Decisão automatizada do Gauntlet para o perfil ${profile.key}.`,
      }),
    },
  );
  assertInvariant(
    `${profile.key}:committee`,
    committee.decision === profile.committeeDecision &&
      Boolean(committee.decidedBy) &&
      Boolean(committee.decidedAt) &&
      committee.confidence > 0,
    "Decisão do comitê não registrou autor, instante e confiança.",
    committee,
  );

  const auditTrail = await request<VerdictRecord[]>(
    `/agents/${encodeURIComponent(agentId)}/verdicts`,
  );
  const audit = auditTrail.find((record) => record.id === committee.id);
  assertInvariant(
    `${profile.key}:audit`,
    audit?.decision === profile.committeeDecision &&
      Boolean(audit.decidedBy) &&
      Boolean(audit.decidedAt),
    "Decisão não foi reconstruída pelo rastro auditável.",
    { committee, auditTrail },
  );

  return {
    profile: profile.key,
    vertical: profile.vertical,
    platform: profile.platform,
    agentId,
    telemetry,
    supervision,
    reevaluation,
    evidenceCount: evidence.length,
    committeeDecision: profile.committeeDecision,
    audit: audit!,
  };
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const runId = crypto.randomUUID().slice(0, 8);
  const profiles = createProfiles();
  let results: ProfileResult[] = [];
  let failure: unknown;
  let cleanupCount = 0;

  try {
    await runStep(
      "preflight",
      async () => request<AgentSummary[]>("/agents"),
      (agents) => ({ existingAgents: agents.length }),
    );
    await runStep("cleanup-before", cleanupSyntheticFleet, (count) => ({ count }));

    await runStep(
      "reject-fabricated-evaluation",
      async () => {
        const probePayload = {
          ...admissionPayload(profiles[0]!, runId),
          name: `${syntheticPrefix} Sem Evidência ${runId}`,
          role: "Agente recém-admitido sem telemetria",
          platform: "external-api",
          baseline: "",
          proposedMetrics: [],
        };
        const detail = await request<AgentDetail>("/agents", {
          method: "POST",
          body: JSON.stringify(probePayload),
        });
        createdAgentIds.add(detail.agent.id);
        assertInvariant(
          "reject-fabricated-evaluation",
          detail.agent.healthScore === 0 &&
            detail.latestEvaluation.layers.length === 5 &&
            detail.latestEvaluation.layers.every(
              (layer) => layer.score === 0 && layer.metrics.length === 0,
            ),
          "A admissão sem telemetria inventou score ou métricas.",
          detail,
        );
        const reevaluation = await request<Reevaluation>(
          `/agents/${encodeURIComponent(detail.agent.id)}/reevaluate`,
          { method: "POST", body: "{}" },
        );
        assertInvariant(
          "reject-fabricated-evaluation",
          reevaluation.dataSource === "none" &&
            reevaluation.healthScore === 0 &&
            reevaluation.verdict === "observation" &&
            reevaluation.rationale.toLowerCase().includes("evidência"),
          "Agente sem telemetria não foi mantido explicitamente sem evidência.",
          reevaluation,
        );
        return reevaluation;
      },
      (reevaluation) => ({
        dataSource: reevaluation.dataSource,
        healthScore: reevaluation.healthScore,
        verdict: reevaluation.verdict,
      }),
    );

    const admitted = await runStep(
      "admit-three-agents",
      async () =>
        Promise.all(
          profiles.map(async (profile) => {
            const detail = await request<AgentDetail>("/agents", {
              method: "POST",
              body: JSON.stringify(admissionPayload(profile, runId)),
            });
            createdAgentIds.add(detail.agent.id);
            return { profile, detail };
          }),
        ),
      (items) =>
        items.map(({ profile, detail }) => ({
          profile: profile.key,
          agentId: detail.agent.id,
          platform: detail.agent.platform,
        })),
    );

    results = await runStep(
      "exercise-three-profiles",
      async () =>
        Promise.all(
          admitted.map(({ profile, detail }) => exerciseProfile(profile, detail)),
        ),
      (profileResults) =>
        profileResults.map((result) => ({
          profile: result.profile,
          healthScore: result.reevaluation.healthScore,
          verdict: result.reevaluation.verdict,
          evidenceCount: result.evidenceCount,
        })),
    );

    await runStep("compare-profile-outcomes", async () => {
      const byProfile = Object.fromEntries(
        results.map((result) => [result.profile, result]),
      ) as Record<ProfileKey, ProfileResult>;
      const verdicts = new Set(
        results.map((result) => result.reevaluation.verdict),
      );
      assertInvariant(
        "compare-profile-outcomes",
        verdicts.size === profiles.length,
        "Perfis distintos não produziram três vereditos distintos.",
        results.map((result) => ({
          profile: result.profile,
          healthScore: result.reevaluation.healthScore,
          verdict: result.reevaluation.verdict,
          rulesFired: result.reevaluation.rulesFired,
          rationale: result.reevaluation.rationale,
        })),
      );
      assertInvariant(
        "compare-profile-outcomes",
        byProfile.degrading.reevaluation.verdict !== "promote",
        "O perfil degradando foi promovido.",
        byProfile.degrading.reevaluation,
      );
      assertInvariant(
        "compare-profile-outcomes",
        byProfile.healthy.reevaluation.healthScore >
          byProfile.degrading.reevaluation.healthScore &&
          byProfile.degrading.reevaluation.healthScore >
            byProfile.erratic.reevaluation.healthScore,
        "A ordenação de saúde não acompanha os perfis injetados.",
        results.map((result) => ({
          profile: result.profile,
          healthScore: result.reevaluation.healthScore,
        })),
      );
      return { verdicts: [...verdicts] };
    });
  } catch (error) {
    failure = error;
  } finally {
    try {
      cleanupCount = await runStep("cleanup-after", cleanupSyntheticFleet, (count) => ({
        count,
      }));
      assertInvariant(
        "cleanup-after",
        createdAgentIds.size === 0,
        "A limpeza final deixou agentes sintéticos conhecidos.",
        [...createdAgentIds],
      );
    } catch (cleanupError) {
      failure ??= cleanupError;
    }
  }

  const report = {
    ok: failure === undefined,
    runId,
    baseUrl,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    steps,
    profiles: results,
    cleanupCount,
    knownGaps: [
      "Fast Assessment ainda depende de fonte GitHub remota; esta versão admite a carteira pela API pública.",
      "Os três frameworks são representados pelo SDK, mas o disparo dos containers reais entra na evolução multi-plataforma.",
      "A reavaliação atual usa métricas operacionais genéricas; o vínculo automático ao catálogo vertical entra na rodada de lentes KPI.",
      "A sessão Clerk administra a frota; cada agente reporta com uma credencial própria e revogável.",
    ],
    ...(failure ? { failure: observedError(failure) } : {}),
  };

  const serialized = JSON.stringify(report, null, 2);
  if (failure) {
    console.error(serialized);
    process.exitCode = 1;
    return;
  }
  console.log(serialized);
}

void main();
