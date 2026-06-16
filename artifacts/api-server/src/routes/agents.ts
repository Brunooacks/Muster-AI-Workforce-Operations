import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  agents,
  agentIdentities,
  agentOwners,
  evaluations,
  verdicts,
  metricPoints,
} from "@workspace/db";
import {
  ListAgentsQueryParams,
  ListAgentsResponse,
  CreateAgentBody,
  GetAgentParams,
  UpdateAgentParams,
  UpdateAgentBody,
  DeleteAgentParams,
  UpdateAgentIdentityParams,
  UpdateAgentIdentityBody,
  ListAgentEvaluationsParams,
  ListAgentEvaluationsResponse,
  GetAgentMetricsParams,
  GetAgentMetricsResponse,
  ListAgentVerdictsParams,
  ListAgentVerdictsResponse,
  DecideVerdictParams,
  DecideVerdictBody,
  DecideVerdictResponse,
  AnalyzeAgentSourceBody,
  AnalyzeAgentSourceResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import {
  buildAgentDetail,
  toAgentSummary,
  toEvaluation,
  toVerdict,
} from "../lib/serializers";
import {
  buildProposedMetrics,
  proposedMetricsFromDraft,
  scoreEvaluation,
  LAYER_ORDER,
} from "../lib/discovery";
import { analyzeAgentSource } from "../lib/analyze";

const router: IRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.get("/agents", requireAuth, async (req, res) => {
  const query = ListAgentsQueryParams.parse(req.query);
  const rows = await db.select().from(agents).orderBy(desc(agents.healthScore));

  const search = query.search?.toLowerCase();
  const filtered = rows.filter(
    (a) =>
      (!query.platform || a.platform === query.platform) &&
      (!query.status || a.status === query.status) &&
      (!query.verdict || a.currentVerdict === query.verdict) &&
      (!query.severity || a.severity === query.severity) &&
      (!search ||
        a.name.toLowerCase().includes(search) ||
        a.role.toLowerCase().includes(search) ||
        a.platform.toLowerCase().includes(search)),
  );

  const data = ListAgentsResponse.parse(filtered.map(toAgentSummary));
  res.json(data);
});

router.post("/agents", requireAuth, async (req, res) => {
  const body = CreateAgentBody.parse(req.body);

  const externalId = `manual_${slugify(body.name)}_${Date.now()}`;
  const signals = [
    "resolution_rate",
    "handle_time",
    "adoption_rate",
    "policy_violations",
    "value_generated",
  ];
  const proposed =
    body.proposedMetrics && body.proposedMetrics.length > 0
      ? proposedMetricsFromDraft(externalId, body.proposedMetrics)
      : buildProposedMetrics(externalId, signals);
  const scored = scoreEvaluation(externalId, proposed);

  let slug = slugify(body.name);
  const [clash] = await db.select().from(agents).where(eq(agents.slug, slug));
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  const now = Date.now();
  const agentId = await db.transaction(async (tx) => {
    const [agent] = await tx
      .insert(agents)
      .values({
        externalId,
        name: body.name,
        slug,
        role: body.role,
        platform: body.platform,
        version: body.version ?? "1.0.0",
        status: "observation",
        bio: body.bio,
        tagline: body.tagline ?? "",
        currentVerdict: "observation",
        verdictConfidence: scored.verdictConfidence,
        severity: scored.severity,
        healthScore: scored.healthScore,
        activeAlerts: 0,
        monthlyValue: 0,
        monthlyCost: 0,
      })
      .returning();
    if (!agent) throw new Error("Failed to create agent");

    await tx.insert(agentIdentities).values({
      agentId: agent.id,
      bio: body.bio,
      shouldDo: body.shouldDo ?? [],
      shouldNotDo: body.shouldNotDo ?? [],
      autonomyLevel: body.autonomyLevel ?? "escalates",
      autonomyNotes: body.autonomyNotes,
      limits: body.limits ?? [],
      businessCase: {
        baseline: body.baseline ?? "",
        targetPayback: body.targetPayback ?? "",
        actualPayback: "—",
        description: body.businessCaseDescription ?? "",
      },
      version: 1,
    });

    await tx.insert(agentOwners).values({
      agentId: agent.id,
      businessOwner: body.businessOwner ?? "",
      technicalOwner: body.technicalOwner ?? "",
      governanceSponsor: body.governanceSponsor ?? "",
    });

    await tx.insert(evaluations).values({
      agentId: agent.id,
      window: "30d",
      layers: scored.layers,
      verdict: "observation",
      verdictConfidence: scored.verdictConfidence,
      rationale:
        "Avaliação inicial gerada na admissão; manter em observação até consolidar dados reais.",
    });

    await tx.insert(verdicts).values({
      agentId: agent.id,
      verdict: "observation",
      confidence: scored.verdictConfidence,
      executionWindow: "60 dias",
      suggestedSponsor: body.governanceSponsor ?? "Comitê",
      nextActions: [
        {
          action: "Coletar 30 dias de métricas reais via conector",
          owner: "Dono técnico",
          due: "30 dias",
        },
      ],
      rationale:
        "Agente recém-admitido; aguardando dados suficientes para um veredito conclusivo.",
      decision: "pending",
    });

    await tx.insert(metricPoints).values(
      Array.from({ length: 14 }, (_, idx) => {
        const i = 13 - idx;
        const score = (k: number) =>
          Math.max(
            5,
            Math.min(99, Math.round(scored.layers[k]!.score - i / 2)),
          );
        return {
          agentId: agent.id,
          timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
          efficacy: score(0),
          efficiency: score(1),
          adoption: score(2),
          governance: score(3),
          value: score(4),
        };
      }),
    );

    return agent.id;
  });

  const detail = await buildAgentDetail(agentId);
  res.status(201).json(detail);
});

router.post("/discovery/analyze", requireAuth, async (req, res) => {
  const body = AnalyzeAgentSourceBody.parse(req.body);

  try {
    const draft = await analyzeAgentSource({
      content: body.content,
      platform: body.platform,
      nameHint: body.nameHint,
    });
    const data = AnalyzeAgentSourceResponse.parse(draft);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze agent source");
    res
      .status(502)
      .json({ error: "Não foi possível analisar o material do agente." });
  }
});

router.get("/agents/:agentId", requireAuth, async (req, res) => {
  const { agentId } = GetAgentParams.parse(req.params);
  const detail = await buildAgentDetail(agentId);
  if (!detail) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(detail);
});

router.patch("/agents/:agentId", requireAuth, async (req, res) => {
  const { agentId } = UpdateAgentParams.parse(req.params);
  const body = UpdateAgentBody.parse(req.body);

  const [existing] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!existing) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  await db
    .update(agents)
    .set({
      name: body.name ?? existing.name,
      role: body.role ?? existing.role,
      version: body.version ?? existing.version,
      status: body.status ?? existing.status,
      bio: body.bio ?? existing.bio,
    })
    .where(eq(agents.id, agentId));

  const detail = await buildAgentDetail(agentId);
  res.json(detail);
});

router.delete("/agents/:agentId", requireAuth, async (req, res) => {
  const { agentId } = DeleteAgentParams.parse(req.params);
  await db.delete(agents).where(eq(agents.id, agentId));
  res.status(204).end();
});

router.patch("/agents/:agentId/identity", requireAuth, async (req, res) => {
  const { agentId } = UpdateAgentIdentityParams.parse(req.params);
  const body = UpdateAgentIdentityBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, agentId));
  if (!existing) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  await db
    .update(agentIdentities)
    .set({
      bio: body.bio ?? existing.bio,
      shouldDo: body.shouldDo ?? existing.shouldDo,
      shouldNotDo: body.shouldNotDo ?? existing.shouldNotDo,
      autonomyLevel: body.autonomyLevel ?? existing.autonomyLevel,
      autonomyNotes: body.autonomyNotes ?? existing.autonomyNotes,
      limits: body.limits ?? existing.limits,
      version: existing.version + 1,
    })
    .where(eq(agentIdentities.agentId, agentId));

  if (body.bio) {
    await db.update(agents).set({ bio: body.bio }).where(eq(agents.id, agentId));
  }

  if (
    body.businessOwner !== undefined ||
    body.technicalOwner !== undefined ||
    body.governanceSponsor !== undefined
  ) {
    const [owners] = await db
      .select()
      .from(agentOwners)
      .where(eq(agentOwners.agentId, agentId));
    await db
      .update(agentOwners)
      .set({
        businessOwner: body.businessOwner ?? owners?.businessOwner ?? "",
        technicalOwner: body.technicalOwner ?? owners?.technicalOwner ?? "",
        governanceSponsor:
          body.governanceSponsor ?? owners?.governanceSponsor ?? "",
      })
      .where(eq(agentOwners.agentId, agentId));
  }

  const detail = await buildAgentDetail(agentId);
  res.json(detail);
});

router.get("/agents/:agentId/evaluations", requireAuth, async (req, res) => {
  const { agentId } = ListAgentEvaluationsParams.parse(req.params);
  const rows = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.agentId, agentId))
    .orderBy(desc(evaluations.evaluatedAt));
  const data = ListAgentEvaluationsResponse.parse(rows.map(toEvaluation));
  res.json(data);
});

router.get(
  "/agents/:agentId/metrics/:window",
  requireAuth,
  async (req, res) => {
    const { agentId, window } = GetAgentMetricsParams.parse(req.params);

    const limit = window === "1h" || window === "24h" ? 24 : window === "7d" ? 7 : 30;

    const rows = await db
      .select()
      .from(metricPoints)
      .where(eq(metricPoints.agentId, agentId))
      .orderBy(desc(metricPoints.timestamp))
      .limit(limit);

    const data = GetAgentMetricsResponse.parse(
      rows
        .reverse()
        .map((p) => ({
          timestamp: p.timestamp.toISOString(),
          efficacy: p.efficacy,
          efficiency: p.efficiency,
          adoption: p.adoption,
          governance: p.governance,
          value: p.value,
        })),
    );
    res.json(data);
  },
);

router.get("/agents/:agentId/verdicts", requireAuth, async (req, res) => {
  const { agentId } = ListAgentVerdictsParams.parse(req.params);
  const rows = await db
    .select()
    .from(verdicts)
    .where(eq(verdicts.agentId, agentId))
    .orderBy(desc(verdicts.createdAt));
  const data = ListAgentVerdictsResponse.parse(rows.map(toVerdict));
  res.json(data);
});

router.post(
  "/agents/:agentId/verdict/decision",
  requireAuth,
  async (req, res) => {
    const { agentId } = DecideVerdictParams.parse(req.params);
    const body = DecideVerdictBody.parse(req.body);

    const [current] = await db
      .select()
      .from(verdicts)
      .where(and(eq(verdicts.agentId, agentId), eq(verdicts.decision, "pending")))
      .orderBy(desc(verdicts.createdAt))
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "No pending verdict for this agent" });
      return;
    }

    const [updated] = await db
      .update(verdicts)
      .set({
        decision: body.decision,
        decidedBy: body.decidedBy ?? req.userId ?? "Comitê",
        decidedAt: new Date(),
        rationale: body.reason ?? current.rationale,
      })
      .where(eq(verdicts.id, current.id))
      .returning();

    if (body.decision === "approved" && updated) {
      const statusByVerdict = {
        promote: "active",
        mentor: "active",
        observation: "observation",
        retire: "retiring",
      } as const;
      await db
        .update(agents)
        .set({ status: statusByVerdict[updated.verdict] })
        .where(eq(agents.id, agentId));
    }

    const data = DecideVerdictResponse.parse(toVerdict(updated!));
    res.json(data);
  },
);

void LAYER_ORDER;

export default router;
