import { and, desc, eq } from "drizzle-orm";
import {
  db,
  agents,
  areas,
  agentIdentities,
  agentOwners,
  agentDrafts,
  evaluations,
  verdicts,
  type KpiLayer,
  type KpiMetric,
  type NextAction,
  type DraftKpiMetric,
  type DraftBusinessCase,
} from "@workspace/db";

type AgentRow = typeof agents.$inferSelect;
type IdentityRow = typeof agentIdentities.$inferSelect;
type OwnersRow = typeof agentOwners.$inferSelect;
type EvaluationRow = typeof evaluations.$inferSelect;
type VerdictRow = typeof verdicts.$inferSelect;
type AgentDraftRow = typeof agentDrafts.$inferSelect;

export function toAgentDraftRecord(d: AgentDraftRow) {
  return {
    id: d.id,
    runId: d.runId,
    source: d.source,
    externalId: d.externalId ?? null,
    name: d.name,
    role: d.role,
    platform: d.platform,
    tagline: d.tagline,
    bio: d.bio,
    shouldDo: d.shouldDo,
    shouldNotDo: d.shouldNotDo,
    autonomyLevel: d.autonomyLevel,
    autonomyNotes: d.autonomyNotes ?? null,
    limits: d.limits,
    businessCase: d.businessCase as DraftBusinessCase,
    proposedMetrics: d.proposedMetrics as DraftKpiMetric[],
    summary: d.summary,
    confidence: d.confidence,
    enrichmentStatus: d.enrichmentStatus,
    reviewStatus: d.reviewStatus,
    promotedAgentId: d.promotedAgentId ?? null,
    reviewNote: d.reviewNote ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export function toAgentSummary(
  a: AgentRow,
  targetMetrics: KpiMetric[] = [],
  // Desnormalizado de propósito: a lista da frota mostra a área de cada agente,
  // e resolver o nome aqui evita uma segunda chamada por linha na tela.
  areaName: string | null = null,
) {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    areaId: a.areaId ?? null,
    areaName,
    role: a.role,
    platform: a.platform,
    version: a.version,
    status: a.status,
    avatarUrl: a.avatarUrl ?? null,
    bio: a.bio,
    tagline: a.tagline,
    monthlyVolume: a.monthlyVolume,
    headlineKpis: a.headlineKpis as KpiMetric[],
    targetMetrics,
    currentVerdict: a.currentVerdict,
    verdictConfidence: a.verdictConfidence,
    severity: a.severity,
    healthScore: a.healthScore,
    activeAlerts: a.activeAlerts,
    monthlyValue: a.monthlyValue,
    monthlyCost: a.monthlyCost,
    admittedAt: a.admittedAt.toISOString(),
    lastEvaluatedAt: a.lastEvaluatedAt.toISOString(),
  };
}

export function toEvaluation(e: EvaluationRow) {
  return {
    id: e.id,
    agentId: e.agentId,
    evaluatedAt: e.evaluatedAt.toISOString(),
    window: e.window,
    layers: e.layers as KpiLayer[],
    verdict: e.verdict,
    verdictConfidence: e.verdictConfidence,
    rationale: e.rationale,
  };
}

export function toVerdict(v: VerdictRow) {
  return {
    id: v.id,
    agentId: v.agentId,
    verdict: v.verdict,
    confidence: v.confidence,
    executionWindow: v.executionWindow,
    suggestedSponsor: v.suggestedSponsor,
    nextActions: v.nextActions as NextAction[],
    rationale: v.rationale,
    decision: v.decision,
    decidedBy: v.decidedBy ?? null,
    decidedAt: v.decidedAt ? v.decidedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
  };
}

function toIdentity(i: IdentityRow) {
  return {
    bio: i.bio,
    shouldDo: i.shouldDo,
    shouldNotDo: i.shouldNotDo,
    autonomyLevel: i.autonomyLevel,
    autonomyNotes: i.autonomyNotes ?? undefined,
    limits: i.limits,
    businessCase: i.businessCase,
    version: i.version,
  };
}

function toOwners(o: OwnersRow) {
  return {
    businessOwner: o.businessOwner,
    technicalOwner: o.technicalOwner,
    governanceSponsor: o.governanceSponsor,
  };
}

/**
 * Detalhe completo de um agente.
 *
 * `orgId` é obrigatório de propósito. Enquanto esta função buscava só por id,
 * `GET /agents/:agentId` parecia isolado — a rota tinha `requireOrg` — mas
 * devolvia o agente de qualquer organização a quem soubesse o id. O filtro
 * mora aqui, e não em cada chamador, porque são seis.
 */
export async function buildAgentDetail(agentId: string, orgId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)));
  if (!agent) return null;

  const [identity] = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, agentId));
  const [owners] = await db
    .select()
    .from(agentOwners)
    .where(eq(agentOwners.agentId, agentId));
  const [latestEvaluation] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.agentId, agentId))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  const [currentVerdict] = await db
    .select()
    .from(verdicts)
    .where(and(eq(verdicts.agentId, agentId), eq(verdicts.decision, "pending")))
    .orderBy(desc(verdicts.createdAt))
    .limit(1);
  const [anyVerdict] = await db
    .select()
    .from(verdicts)
    .where(eq(verdicts.agentId, agentId))
    .orderBy(desc(verdicts.createdAt))
    .limit(1);

  const emptyIdentity = {
    bio: agent.bio,
    shouldDo: [] as string[],
    shouldNotDo: [] as string[],
    autonomyLevel: "escalates" as const,
    autonomyNotes: undefined,
    limits: [] as string[],
    businessCase: {
      baseline: "",
      targetPayback: "",
      actualPayback: "",
      description: "",
    },
    version: 1,
  };

  const emptyEvaluation = {
    id: "",
    agentId: agent.id,
    evaluatedAt: agent.lastEvaluatedAt.toISOString(),
    window: "30d",
    layers: [] as KpiLayer[],
    verdict: agent.currentVerdict,
    verdictConfidence: agent.verdictConfidence,
    rationale: "",
  };

  const resolvedVerdict = currentVerdict ?? anyVerdict;

  // A área já foi validada como pertencente à organização quando foi atribuída;
  // aqui é só o nome para exibição.
  const [area] = agent.areaId
    ? await db
        .select({ name: areas.name })
        .from(areas)
        .where(and(eq(areas.id, agent.areaId), eq(areas.orgId, orgId)))
    : [];

  return {
    agent: toAgentSummary(agent, [], area?.name ?? null),
    identity: identity ? toIdentity(identity) : emptyIdentity,
    owners: owners
      ? toOwners(owners)
      : { businessOwner: "", technicalOwner: "", governanceSponsor: "" },
    latestEvaluation: latestEvaluation
      ? toEvaluation(latestEvaluation)
      : emptyEvaluation,
    currentVerdict: resolvedVerdict ? toVerdict(resolvedVerdict) : undefined,
  };
}
