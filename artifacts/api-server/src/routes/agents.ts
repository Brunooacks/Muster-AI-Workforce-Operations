import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  agents,
  areas,
  agentIdentities,
  agentOwners,
  evaluations,
  verdicts,
  metricPoints,
  type KpiMetric,
  type KpiLayer,
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
  FetchAgentSourceBody,
  FetchAgentSourceResponse,
  GetGitHubStatusResponse,
  UpdateEvaluationMetricParams,
  UpdateEvaluationMetricBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { ofOrg } from "../lib/tenant-scope";
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
import {
  analyzeAgentSource,
  MAX_CONTENT_LENGTH,
  RateLimitError,
} from "../lib/analyze";
import { fetchAgentSourceFromUrl, FetchSourceError } from "../lib/fetch-source";
import { getGitHubStatus } from "../lib/github-auth";
import {
  admitAgent,
  AlreadyAdmittedError,
  InvalidAdmissionCatalogMetricError,
  InvalidAdmissionConnectorError,
  MissingConnectorExternalIdError,
} from "../lib/admission";

const router: IRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.get("/agents", requireAuth, requireOrg, async (req, res) => {
  const query = ListAgentsQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(agents)
    .where(ofOrg(agents, req.orgId!))
    .orderBy(desc(agents.healthScore));

  const search = query.search?.toLowerCase();
  const filtered = rows.filter(
    (a) =>
      // "none" filtra os que ainda não têm área: é a fila de atribuição, e
      // precisa ser alcançável por filtro como qualquer outro recorte.
      (!query.area || (query.area === "none" ? a.areaId === null : a.areaId === query.area)) &&
      (!query.platform || a.platform === query.platform) &&
      (!query.status || a.status === query.status) &&
      (!query.verdict || a.currentVerdict === query.verdict) &&
      (!query.severity || a.severity === query.severity) &&
      (!search ||
        a.name.toLowerCase().includes(search) ||
        a.role.toLowerCase().includes(search) ||
        a.platform.toLowerCase().includes(search)),
  );

  // Roll up each agent's latest-evaluation metrics so the fleet view can count
  // how many are off-target (reusing the client-side metricTargetStatus logic).
  const evalRows = await db
    .select()
    .from(evaluations)
    .orderBy(desc(evaluations.evaluatedAt));
  const latestMetricsByAgent = new Map<string, KpiMetric[]>();
  for (const e of evalRows) {
    if (latestMetricsByAgent.has(e.agentId)) continue;
    const layers = (e.layers as KpiLayer[]) ?? [];
    latestMetricsByAgent.set(
      e.agentId,
      layers.flatMap((layer) => layer.metrics),
    );
  }

  // Nomes das áreas em uma consulta só, e não uma por agente.
  const areaRows = await db
    .select({ id: areas.id, name: areas.name })
    .from(areas)
    .where(ofOrg(areas, req.orgId!));
  const areaNames = new Map(areaRows.map((a) => [a.id, a.name]));
  const ownerRows = filtered.length > 0
    ? await db
        .select()
        .from(agentOwners)
        .where(inArray(agentOwners.agentId, filtered.map((agent) => agent.id)))
    : [];
  const ownersByAgent = new Map(ownerRows.map((owner) => [owner.agentId, owner]));

  const data = ListAgentsResponse.parse(
    filtered.map((a) =>
      toAgentSummary(
        a,
        latestMetricsByAgent.get(a.id) ?? [],
        a.areaId ? (areaNames.get(a.areaId) ?? null) : null,
        ownersByAgent.get(a.id) ?? null,
      ),
    ),
  );
  res.json(data);
});

router.post("/agents", requireAuth, requireOrg, async (req, res) => {
  const body = CreateAgentBody.parse(req.body);

  let agentId: string;
  try {
    agentId = await admitAgent({
      orgId: req.orgId!,
      externalId: body.externalId,
      connectorId: body.connectorId,
      areaId: body.areaId ?? null,
      name: body.name,
      role: body.role,
      platform: body.platform,
      bio: body.bio,
      version: body.version,
      tagline: body.tagline,
      shouldDo: body.shouldDo,
      shouldNotDo: body.shouldNotDo,
      autonomyLevel: body.autonomyLevel,
      autonomyNotes: body.autonomyNotes,
      limits: body.limits,
      businessOwner: body.businessOwner,
      technicalOwner: body.technicalOwner,
      governanceSponsor: body.governanceSponsor,
      baseline: body.baseline,
      targetPayback: body.targetPayback,
      businessCaseDescription: body.businessCaseDescription,
      proposedMetrics: body.proposedMetrics,
    });
  } catch (err) {
    if (err instanceof AlreadyAdmittedError) {
      res.status(409).json({ error: "Agente já admitido na frota." });
      return;
    }
    if (err instanceof InvalidAdmissionConnectorError) {
      res.status(400).json({ error: "O conector selecionado não pertence à organização ativa." });
      return;
    }
    if (err instanceof MissingConnectorExternalIdError) {
      res.status(400).json({ error: "Informe o ID externo emitido pelo runtime do agente." });
      return;
    }
    if (err instanceof InvalidAdmissionCatalogMetricError) {
      res.status(400).json({ error: "A métrica selecionada não pertence ao catálogo da organização ativa." });
      return;
    }
    throw err;
  }

  const detail = await buildAgentDetail(agentId, req.orgId!);
  res.status(201).json(detail);
});

router.post("/discovery/analyze", requireAuth, requireOrg, async (req, res) => {
  const body = AnalyzeAgentSourceBody.parse(req.body);

  if (body.content.length > MAX_CONTENT_LENGTH) {
    res.status(413).json({
      error: `Conteúdo muito grande. Reduza para até ${MAX_CONTENT_LENGTH.toLocaleString("pt-BR")} caracteres.`,
      code: "content_too_large",
    });
    return;
  }

  try {
    const draft = await analyzeAgentSource({
      content: body.content,
      platform: body.platform,
      nameHint: body.nameHint,
    });
    const data = AnalyzeAgentSourceResponse.parse(draft);
    res.json(data);
  } catch (err) {
    if (err instanceof RateLimitError) {
      req.log.warn({ err }, "AI rate limit reached during agent analysis");
      res.status(429).json({
        error: "Limite de uso da IA atingido. Aguarde alguns instantes e tente novamente.",
        code: "rate_limited",
      });
      return;
    }
    req.log.error({ err }, "Failed to analyze agent source");
    res
      .status(502)
      .json({ error: "Não foi possível analisar o material do agente." });
  }
});

router.post("/discovery/fetch", requireAuth, requireOrg, async (req, res) => {
  const body = FetchAgentSourceBody.parse(req.body);

  try {
    const result = await fetchAgentSourceFromUrl(body.url);
    const data = FetchAgentSourceResponse.parse(result);
    res.json(data);
  } catch (err) {
    if (err instanceof FetchSourceError) {
      req.log.warn({ err: err.message }, "Source fetch rejected");
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to fetch agent source");
    res
      .status(502)
      .json({ error: "Não foi possível importar o material do endereço." });
  }
});

router.get("/discovery/github-status", requireAuth, requireOrg, async (_req, res) => {
  const status = await getGitHubStatus();
  const data = GetGitHubStatusResponse.parse(status);
  res.json(data);
});

router.get("/agents/:agentId", requireAuth, requireOrg, async (req, res) => {
  const { agentId } = GetAgentParams.parse(req.params);
  const detail = await buildAgentDetail(agentId, req.orgId!);
  if (!detail) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(detail);
});

router.patch("/agents/:agentId", requireAuth, requireOrg, async (req, res) => {
  const { agentId } = UpdateAgentParams.parse(req.params);
  const body = UpdateAgentBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)));
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
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)));

  const detail = await buildAgentDetail(agentId, req.orgId!);
  res.json(detail);
});

router.delete("/agents/:agentId", requireAuth, requireOrg, async (req, res) => {
  const { agentId } = DeleteAgentParams.parse(req.params);
  // O escopo no DELETE não é redundante: sem ele, conhecer o id de um agente de
  // outra organização bastava para apagá-lo. `returning` distingue "não existe"
  // de "não é seu" sem contar ao chamador qual dos dois é.
  const apagados = await db
    .delete(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .returning({ id: agents.id });
  if (apagados.length === 0) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.status(204).end();
});

router.patch("/agents/:agentId/identity", requireAuth, requireOrg, async (req, res) => {
  const { agentId } = UpdateAgentIdentityParams.parse(req.params);
  const body = UpdateAgentIdentityBody.parse(req.body);

  // A identidade é tabela-filha: quem a protege é o dono. Sem esta checagem,
  // conhecer o id bastava para reescrever a carteira de trabalho de um agente
  // de outra organização — e a alteração ficaria registrada como legítima.
  const [dono] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)));
  if (!dono) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

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
    await db
      .update(agents)
      .set({ bio: body.bio })
      .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)));
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

  const detail = await buildAgentDetail(agentId, req.orgId!);
  res.json(detail);
});

router.get("/agents/:agentId/evaluations", requireAuth, requireOrg, async (req, res) => {
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
  requireAuth, requireOrg,
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

router.get("/agents/:agentId/verdicts", requireAuth, requireOrg, async (req, res) => {
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
  requireAuth, requireOrg,
  async (req, res) => {
    const { agentId } = DecideVerdictParams.parse(req.params);
    const body = DecideVerdictBody.parse(req.body);

    // Decidir um veredito é a ação de maior consequência da plataforma: aprova
    // ou aposenta um agente e muda o status dele. Sem esta checagem, `verdicts`
    // era consultada só por agentId — bastava conhecer o id para decidir sobre
    // o agente de outra organização, e a decisão ficaria registrada como legítima.
    const [dono] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)));
    if (!dono) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(verdicts)
        .where(and(eq(verdicts.agentId, agentId), eq(verdicts.decision, "pending")))
        .orderBy(desc(verdicts.createdAt))
        .limit(1);

      if (!current) return null;

      const [updatedVerdict] = await tx
        .update(verdicts)
        .set({
          decision: body.decision,
          decidedBy: req.userId ?? "Comitê",
          decidedAt: new Date(),
          rationale: body.reason ?? current.rationale,
        })
        .where(eq(verdicts.id, current.id))
        .returning();

      if (body.decision === "approved" && updatedVerdict) {
        const statusByVerdict = {
          promote: "active",
          mentor: "active",
          observation: "observation",
          retire: "retiring",
        } as const;
        await tx
          .update(agents)
          .set({ status: statusByVerdict[updatedVerdict.verdict] })
          .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)));
      }

      return updatedVerdict;
    });

    if (!updated) {
      res.status(404).json({ error: "No pending verdict for this agent" });
      return;
    }

    const data = DecideVerdictResponse.parse(toVerdict(updated));
    res.json(data);
  },
);

router.patch(
  "/agents/:agentId/evaluation/metric",
  requireAuth, requireOrg,
  async (req, res) => {
    const { agentId } = UpdateEvaluationMetricParams.parse(req.params);
    const body = UpdateEvaluationMetricBody.parse(req.body);

    const [latest] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.agentId, agentId))
      .orderBy(desc(evaluations.evaluatedAt))
      .limit(1);

    if (!latest) {
      res.status(404).json({ error: "No evaluation for this agent" });
      return;
    }

    const layers = (latest.layers as KpiLayer[]).map((l) => ({
      ...l,
      metrics: l.metrics.map((m) => ({ ...m })),
    }));
    const layer = layers.find((l) => l.key === body.layerKey);
    const metric = layer?.metrics.find((m) => m.label === body.metricLabel);

    if (!layer || !metric) {
      res.status(404).json({ error: "Metric not found in latest evaluation" });
      return;
    }

    if (body.target !== undefined) {
      metric.target = body.target ?? undefined;
    }
    if (body.rationale !== undefined) {
      metric.rationale = body.rationale ?? undefined;
    }

    await db
      .update(evaluations)
      .set({ layers })
      .where(eq(evaluations.id, latest.id));

    const detail = await buildAgentDetail(agentId, req.orgId!);
    res.json(detail);
  },
);

void LAYER_ORDER;

export default router;
