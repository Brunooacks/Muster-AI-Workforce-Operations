import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  db,
  agents,
  agentOwners,
  alerts,
  evaluations,
  verdicts,
  metricPoints,
  agentEvents,
  type KpiLayer,
  type LayerKey,
  type Severity,
} from "@workspace/db";
import {
  GetFleetSummaryResponse,
  GetFleetKpisResponse,
  GetFleetInsightsResponse,
  ListFleetAlertsQueryParams,
  ListFleetAlertsResponse,
  UpdateFleetAlertParams,
  UpdateFleetAlertBody,
  UpdateFleetAlertResponse,
  ListFleetDecisionsResponse,
  GetFleetGovernanceResponse,
  GetFleetBenchmarksResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgOperator } from "../middlewares/orgRole";
import { byAgentsOf, ofOrg } from "../lib/tenant-scope";
import { applyAlertUpdate } from "../lib/alert-workflow";
import { buildFleetInsights } from "../lib/fleet-insights";

const router: IRouter = Router();

const LAYER_LABELS: Record<LayerKey, string> = {
  efficacy: "Eficácia",
  efficiency: "Eficiência",
  adoption: "Adoção",
  governance: "Governança",
  value: "Valor",
};

const LAYER_ORDER: LayerKey[] = [
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
];

function severityFromScore(score: number): Severity {
  if (score >= 80) return "stable";
  if (score >= 65) return "medium";
  if (score >= 50) return "high";
  return "critical";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

router.get("/fleet/summary", requireAuth, requireOrg, async (req, res) => {
  const allAgents = await db.select().from(agents).where(ofOrg(agents, req.orgId!));
  const agentIds = allAgents.map((agent) => agent.id);
  const allAlerts = agentIds.length > 0
    ? await db.select().from(alerts).where(byAgentsOf(alerts.agentId, agentIds)!)
    : [];

  const byVerdict = { promote: 0, mentor: 0, retire: 0, observation: 0 };
  const bySeverity = { critical: 0, high: 0, medium: 0, stable: 0 };
  const byStatus = {
    observation: 0,
    active: 0,
    flagged: 0,
    retiring: 0,
    retired: 0,
  };
  const platformCounts = new Map<string, number>();
  let healthSum = 0;
  let valueSum = 0;
  let costSum = 0;

  for (const a of allAgents) {
    byVerdict[a.currentVerdict] += 1;
    bySeverity[a.severity] += 1;
    byStatus[a.status] += 1;
    platformCounts.set(a.platform, (platformCounts.get(a.platform) ?? 0) + 1);
    healthSum += a.healthScore;
    valueSum += a.monthlyValue;
    costSum += a.monthlyCost;
  }

  const activeAlerts = allAlerts.filter((a) => a.status === "active").length;

  const pendingVerdicts = agentIds.length > 0
    ? await db
        .select({ agentId: verdicts.agentId })
        .from(verdicts)
        .where(
          and(
            eq(verdicts.decision, "pending"),
            byAgentsOf(verdicts.agentId, agentIds)!,
          ),
        )
    : [];
  const pendingDecisions = new Set(pendingVerdicts.map((v) => v.agentId)).size;

  const data = GetFleetSummaryResponse.parse({
    totalAgents: allAgents.length,
    byVerdict,
    bySeverity,
    byStatus,
    byPlatform: [...platformCounts.entries()].map(([platform, count]) => ({
      platform,
      count,
    })),
    avgHealthScore: allAgents.length
      ? Math.round(healthSum / allAgents.length)
      : 0,
    activeAlerts,
    pendingDecisions,
    estimatedMonthlyValue: valueSum,
    estimatedMonthlyCost: costSum,
    connectedPlatforms: platformCounts.size,
  });

  res.json(data);
});

router.get("/fleet/kpis", requireAuth, requireOrg, async (req, res) => {
  const allAgents = await db.select().from(agents).where(ofOrg(agents, req.orgId!));
  const agentIds = allAgents.map((agent) => agent.id);
  const allEvaluations = agentIds.length > 0
    ? await db
        .select()
        .from(evaluations)
        .where(byAgentsOf(evaluations.agentId, agentIds)!)
        .orderBy(desc(evaluations.evaluatedAt))
    : [];
  const allPoints = agentIds.length > 0
    ? await db
        .select()
        .from(metricPoints)
        .where(byAgentsOf(metricPoints.agentId, agentIds)!)
    : [];
  const recentCostEvents = agentIds.length > 0
    ? await db
        .select({ costCents: agentEvents.costCents })
        .from(agentEvents)
        .where(
          and(
            byAgentsOf(agentEvents.agentId, agentIds)!,
            gte(agentEvents.ts, new Date(Date.now() - 30 * 86_400_000)),
          ),
        )
    : [];

  // Latest evaluation per agent.
  const latestByAgent = new Map<string, typeof allEvaluations[number]>();
  for (const e of allEvaluations) {
    if (!latestByAgent.has(e.agentId)) latestByAgent.set(e.agentId, e);
  }

  // Monthly trend across the whole fleet.
  const monthAcc = new Map<
    string,
    {
      efficacy: number;
      efficiency: number;
      adoption: number;
      governance: number;
      value: number;
      n: number;
    }
  >();
  for (const p of allPoints) {
    const period = p.timestamp.toISOString().slice(0, 7);
    const acc =
      monthAcc.get(period) ??
      {
        efficacy: 0,
        efficiency: 0,
        adoption: 0,
        governance: 0,
        value: 0,
        n: 0,
      };
    acc.efficacy += p.efficacy;
    acc.efficiency += p.efficiency;
    acc.adoption += p.adoption;
    acc.governance += p.governance;
    acc.value += p.value;
    acc.n += 1;
    monthAcc.set(period, acc);
  }

  const trend = [...monthAcc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, a]) => {
      const efficacy = round1(a.efficacy / a.n);
      const efficiency = round1(a.efficiency / a.n);
      const adoption = round1(a.adoption / a.n);
      const governance = round1(a.governance / a.n);
      const value = round1(a.value / a.n);
      const health = round1(
        (efficacy + efficiency + adoption + governance + value) / 5,
      );
      return { period, efficacy, efficiency, adoption, governance, value, health };
    });

  const prev = trend.length > 1 ? trend[trend.length - 2] : undefined;
  const curr = trend.length > 0 ? trend[trend.length - 1] : undefined;

  // Fleet-wide 5-layer averages from the latest evaluation of each agent.
  const layers = LAYER_ORDER.map((key) => {
    let sum = 0;
    let count = 0;
    let agentsAtRisk = 0;
    for (const e of latestByAgent.values()) {
      const layer = (e.layers as KpiLayer[]).find((l) => l.key === key);
      if (!layer) continue;
      sum += layer.score;
      count += 1;
      if (layer.score < 65) agentsAtRisk += 1;
    }
    const score = count ? round1(sum / count) : 0;
    const trendDelta =
      curr && prev ? round1(curr[key] - prev[key]) : 0;
    return {
      key,
      label: LAYER_LABELS[key],
      score,
      severity: severityFromScore(score),
      trend: trendDelta,
      agentsAtRisk,
    };
  });

  let monthlyValue = 0;
  let declaredMonthlyCost = 0;
  let profitableAgents = 0;
  for (const a of allAgents) {
    monthlyValue += a.monthlyValue;
    declaredMonthlyCost += a.monthlyCost;
    if (a.monthlyValue > a.monthlyCost) profitableAgents += 1;
  }
  const observedMonthlyCost = round1(
    recentCostEvents.reduce(
      (total, event) => total + Math.max(0, event.costCents ?? 0),
      0,
    ) / 100,
  );
  const monthlyCost = observedMonthlyCost > 0
    ? observedMonthlyCost
    : declaredMonthlyCost;
  const netValue = monthlyValue - monthlyCost;
  const roiPercent = monthlyCost > 0 ? round1((netValue / monthlyCost) * 100) : 0;

  const sortedByHealth = [...allAgents].sort(
    (a, b) => b.healthScore - a.healthScore,
  );
  const toRef = (a: typeof allAgents[number]) => ({
    id: a.id,
    name: a.name,
    platform: a.platform,
    role: a.role,
    healthScore: a.healthScore,
    currentVerdict: a.currentVerdict,
    severity: a.severity,
  });

  const data = GetFleetKpisResponse.parse({
    layers,
    trend,
    roi: { monthlyValue, monthlyCost, netValue, roiPercent, profitableAgents },
    topPerformers: sortedByHealth.slice(0, 3).map(toRef),
    atRisk: sortedByHealth.slice(-3).reverse().map(toRef),
    totalEvaluations: allEvaluations.length,
  });

  res.json(data);
});

router.get("/fleet/insights", requireAuth, requireOrg, async (req, res) => {
  const allAgents = await db.select().from(agents).where(ofOrg(agents, req.orgId!));
  const agentIds = allAgents.map((agent) => agent.id);
  const allEvaluations = agentIds.length > 0
    ? await db
        .select()
        .from(evaluations)
        .where(byAgentsOf(evaluations.agentId, agentIds)!)
        .orderBy(desc(evaluations.evaluatedAt))
    : [];
  const allPoints = agentIds.length > 0
    ? await db
        .select()
        .from(metricPoints)
        .where(byAgentsOf(metricPoints.agentId, agentIds)!)
    : [];
  const data = buildFleetInsights({
    agents: allAgents,
    evaluations: allEvaluations.map((evaluation) => ({
      agentId: evaluation.agentId,
      evaluatedAt: evaluation.evaluatedAt,
      layers: evaluation.layers,
      verdictConfidence: evaluation.verdictConfidence,
    })),
    points: allPoints,
    now: new Date(),
  });
  res.json(GetFleetInsightsResponse.parse(data));
});

router.get("/fleet/alerts", requireAuth, requireOrg, async (req, res) => {
  const query = ListFleetAlertsQueryParams.parse(req.query);

  const rows = await db
    .select({
      id: alerts.id,
      agentId: alerts.agentId,
      agentName: agents.name,
      pattern: alerts.pattern,
      patternType: alerts.patternType,
      severity: alerts.severity,
      hypothesis: alerts.hypothesis,
      recommendation: alerts.recommendation,
      detectedAt: alerts.detectedAt,
      status: alerts.status,
      assignedTo: alerts.assignedTo,
      dueAt: alerts.dueAt,
      acknowledgedAt: alerts.acknowledgedAt,
      resolvedAt: alerts.resolvedAt,
    })
    .from(alerts)
    .innerJoin(agents, eq(alerts.agentId, agents.id))
    .where(ofOrg(agents, req.orgId!))
    .orderBy(desc(alerts.detectedAt));

  const filtered = rows.filter(
    (r) =>
      (!query.severity || r.severity === query.severity) &&
      (!query.status || r.status === query.status),
  );

  const data = ListFleetAlertsResponse.parse(
    filtered.map((r) => ({
      ...r,
      detectedAt: r.detectedAt.toISOString(),
    })),
  );

  res.json(data);
});

router.patch("/fleet/alerts/:alertId", requireAuth, requireOrg, requireOrgOperator, async (req, res) => {
  const { alertId } = UpdateFleetAlertParams.parse(req.params);
  const body = UpdateFleetAlertBody.parse(req.body);

  const [current] = await db
    .select({ alert: alerts, agentName: agents.name })
    .from(alerts)
    .innerJoin(agents, eq(alerts.agentId, agents.id))
    .where(and(eq(alerts.id, alertId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Alerta não encontrado." });
    return;
  }

  const nextState = applyAlertUpdate(
    current.alert,
    {
      status: body.status,
      assignedTo: body.assignedTo,
      dueAt: body.dueAt,
    },
    new Date(),
  );
  const [updated] = await db
    .update(alerts)
    .set({
      status: nextState.status,
      assignedTo: nextState.assignedTo,
      dueAt: nextState.dueAt,
      acknowledgedAt: nextState.acknowledgedAt,
      resolvedAt: nextState.resolvedAt,
    })
    .where(
      and(
        eq(alerts.id, alertId),
        eq(alerts.agentId, current.alert.agentId),
      ),
    )
    .returning();

  const data = UpdateFleetAlertResponse.parse({
    ...updated,
    agentName: current.agentName,
    detectedAt: updated!.detectedAt.toISOString(),
  });
  res.json(data);
});

router.get("/fleet/decisions", requireAuth, requireOrg, async (req, res) => {
  const rows = await db
    .select({
      id: verdicts.id,
      agentId: verdicts.agentId,
      agentName: agents.name,
      agentRole: agents.role,
      platform: agents.platform,
      verdict: verdicts.verdict,
      confidence: verdicts.confidence,
      executionWindow: verdicts.executionWindow,
      decision: verdicts.decision,
      decidedBy: verdicts.decidedBy,
      decidedAt: verdicts.decidedAt,
      createdAt: verdicts.createdAt,
    })
    .from(verdicts)
    .innerJoin(agents, eq(verdicts.agentId, agents.id))
    .where(ofOrg(agents, req.orgId!))
    .orderBy(desc(verdicts.createdAt));

  const data = ListFleetDecisionsResponse.parse(
    rows.map((r) => ({
      ...r,
      decidedBy: r.decidedBy ?? null,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
  );

  res.json(data);
});

router.get("/fleet/governance", requireAuth, requireOrg, async (req, res) => {
  const allAgents = await db.select().from(agents).where(ofOrg(agents, req.orgId!));
  const agentIds = allAgents.map((agent) => agent.id);
  const allOwners = agentIds.length > 0
    ? await db
        .select()
        .from(agentOwners)
        .where(byAgentsOf(agentOwners.agentId, agentIds)!)
    : [];
  const allEvaluations = agentIds.length > 0
    ? await db
        .select()
        .from(evaluations)
        .where(byAgentsOf(evaluations.agentId, agentIds)!)
        .orderBy(desc(evaluations.evaluatedAt))
    : [];

  const ownersByAgent = new Map(allOwners.map((o) => [o.agentId, o]));

  const latestByAgent = new Map<string, typeof allEvaluations[number]>();
  for (const e of allEvaluations) {
    if (!latestByAgent.has(e.agentId)) latestByAgent.set(e.agentId, e);
  }

  const governanceScore = (agentId: string): number => {
    const e = latestByAgent.get(agentId);
    if (!e) return 0;
    const layer = (e.layers as KpiLayer[]).find((l) => l.key === "governance");
    return layer ? layer.score : 0;
  };

  let governanceSum = 0;
  let compliantAgents = 0;
  let agentsInReview = 0;
  let fullyOwnedAgents = 0;

  for (const a of allAgents) {
    const score = governanceScore(a.id);
    governanceSum += score;
    if (score >= 70) compliantAgents += 1;
    if (a.status === "observation" || a.status === "retiring") {
      agentsInReview += 1;
    }
    const o = ownersByAgent.get(a.id);
    if (o && o.businessOwner && o.technicalOwner && o.governanceSponsor) {
      fullyOwnedAgents += 1;
    }
  }

  const allAlerts = agentIds.length > 0
    ? await db.select().from(alerts).where(byAgentsOf(alerts.agentId, agentIds)!)
    : [];
  const openAlerts = allAlerts.filter((a) => a.status === "active").length;

  const groups = new Map<string, ReturnType<typeof buildGovRef>[]>();
  function buildGovRef(a: typeof allAgents[number]) {
    const o = ownersByAgent.get(a.id);
    return {
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.status,
      healthScore: a.healthScore,
      governanceScore: governanceScore(a.id),
      technicalOwner: o?.technicalOwner || "—",
      governanceSponsor: o?.governanceSponsor || "—",
    };
  }
  for (const a of allAgents) {
    const o = ownersByAgent.get(a.id);
    const owner = o?.businessOwner || "Sem dono de negócio";
    const list = groups.get(owner) ?? [];
    list.push(buildGovRef(a));
    groups.set(owner, list);
  }

  const responsibilityChain = [...groups.entries()]
    .map(([businessOwner, agentsList]) => ({
      businessOwner,
      agentCount: agentsList.length,
      agents: agentsList.sort((x, y) => y.healthScore - x.healthScore),
    }))
    .sort((a, b) => b.agentCount - a.agentCount);

  const decided = await db
    .select({
      id: verdicts.id,
      agentId: verdicts.agentId,
      agentName: agents.name,
      agentRole: agents.role,
      platform: agents.platform,
      verdict: verdicts.verdict,
      confidence: verdicts.confidence,
      executionWindow: verdicts.executionWindow,
      decision: verdicts.decision,
      decidedBy: verdicts.decidedBy,
      decidedAt: verdicts.decidedAt,
      createdAt: verdicts.createdAt,
    })
    .from(verdicts)
    .innerJoin(agents, eq(verdicts.agentId, agents.id))
    .where(ofOrg(agents, req.orgId!))
    .orderBy(desc(verdicts.createdAt));

  const auditTrail = decided
    .filter((r) => r.decision !== "pending")
    .slice(0, 12)
    .map((r) => ({
      ...r,
      decidedBy: r.decidedBy ?? null,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

  const data = GetFleetGovernanceResponse.parse({
    summary: {
      totalAgents: allAgents.length,
      compliantAgents,
      avgGovernanceScore: allAgents.length
        ? round1(governanceSum / allAgents.length)
        : 0,
      agentsInReview,
      openAlerts,
      fullyOwnedAgents,
    },
    responsibilityChain,
    auditTrail,
  });

  res.json(data);
});

router.get("/fleet/benchmarks", requireAuth, requireOrg, async (req, res) => {
  const allAgents = await db.select().from(agents).where(ofOrg(agents, req.orgId!));
  const agentIds = allAgents.map((agent) => agent.id);
  const allEvaluations = agentIds.length > 0
    ? await db
        .select()
        .from(evaluations)
        .where(byAgentsOf(evaluations.agentId, agentIds)!)
        .orderBy(desc(evaluations.evaluatedAt))
    : [];

  const latestByAgent = new Map<string, typeof allEvaluations[number]>();
  for (const e of allEvaluations) {
    if (!latestByAgent.has(e.agentId)) latestByAgent.set(e.agentId, e);
  }

  const accuracyOf = (agentId: string): number => {
    const e = latestByAgent.get(agentId);
    if (!e) return 0;
    const layer = (e.layers as KpiLayer[]).find((l) => l.key === "efficacy");
    return layer ? layer.score : 0;
  };

  const byRoi = [...allAgents]
    .map((a) => {
      const netValue = a.monthlyValue - a.monthlyCost;
      const roiPercent =
        a.monthlyCost > 0 ? round1((netValue / a.monthlyCost) * 100) : 0;
      return {
        id: a.id,
        name: a.name,
        platform: a.platform,
        role: a.role,
        roiPercent,
        netValue,
        monthlyValue: a.monthlyValue,
        monthlyCost: a.monthlyCost,
      };
    })
    .sort((a, b) => b.roiPercent - a.roiPercent);

  const byAccuracy = [...allAgents]
    .map((a) => ({
      id: a.id,
      name: a.name,
      platform: a.platform,
      role: a.role,
      accuracy: accuracyOf(a.id),
      healthScore: a.healthScore,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  const fleetAvgRoi = byRoi.length
    ? round1(byRoi.reduce((s, a) => s + a.roiPercent, 0) / byRoi.length)
    : 0;
  const fleetAvgAccuracy = byAccuracy.length
    ? round1(byAccuracy.reduce((s, a) => s + a.accuracy, 0) / byAccuracy.length)
    : 0;

  const data = GetFleetBenchmarksResponse.parse({
    byRoi,
    byAccuracy,
    fleetAvgRoi,
    fleetAvgAccuracy,
  });

  res.json(data);
});

export default router;
