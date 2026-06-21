import { and, desc, eq } from "drizzle-orm";
import {
  db,
  agents,
  agentIdentities,
  agentOwners,
  evaluations,
  verdicts,
  type KpiLayer,
  type KpiMetric,
  type NextAction,
} from "@workspace/db";

type AgentRow = typeof agents.$inferSelect;
type IdentityRow = typeof agentIdentities.$inferSelect;
type OwnersRow = typeof agentOwners.$inferSelect;
type EvaluationRow = typeof evaluations.$inferSelect;
type VerdictRow = typeof verdicts.$inferSelect;

export function toAgentSummary(a: AgentRow, targetMetrics: KpiMetric[] = []) {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
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

export async function buildAgentDetail(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
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

  return {
    agent: toAgentSummary(agent),
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
