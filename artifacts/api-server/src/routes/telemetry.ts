import { Router, type IRouter } from "express";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  db,
  agents,
  agentIdentities,
  agentEvents,
  evaluations,
  metricEvidence,
  verdicts,
} from "@workspace/db";
import type { KpiLayer } from "@workspace/db";
import {
  IngestAgentEventBody,
  GetAgentTelemetryResponse,
  ReevaluateAgentResponse,
  PreAssessAgentSourceBody,
  PreAssessAgentSourceResponse,
  ReportAgentHeartbeatBody,
  ReadAgentSupervisionResponse,
  IngestExternalAgentEnvelopeBody,
} from "@workspace/api-zod";
import type { ExternalAgentEnvelope } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { ofOrg } from "../lib/tenant-scope";
import { requireAgentCredential } from "../middlewares/requireAgentCredential";
import {
  summarizeEvents,
  layersFromTelemetry,
  proposedMetricsFromTelemetry,
  type AgentEventRow,
} from "../lib/telemetry";
import { decideVerdict } from "../lib/decision-rules";
import { scoreEvaluation, LAYER_ORDER, layerLabel } from "../lib/discovery";
import { metricsFromLayers } from "../lib/reevaluate";
import { hasDeclaredBaseline } from "../lib/evaluation-metrics";
import {
  noEvidenceEvaluation,
  seededEvaluationsAllowed,
} from "../lib/evaluation-policy";
import { fetchAgentSourceFromUrl, FetchSourceError } from "../lib/fetch-source";
import { preAssess } from "../lib/pre-assessment";
import { supervisionFromHeartbeat } from "../lib/supervision";
import { normalizeExternalObservation } from "../lib/connectors/ingestion";
import { MUSTER_AGENT_INGESTION_CONTRACT_VERSION } from "../lib/connectors/types";

const router: IRouter = Router();

const WINDOW_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

async function loadEvents(
  agentId: string,
  windowDays: number,
): Promise<AgentEventRow[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const rows = await db
    .select()
    .from(agentEvents)
    .where(and(eq(agentEvents.agentId, agentId), gte(agentEvents.ts, since)));
  return rows.map((r) => ({
    id: r.id,
    agentId: r.agentId,
    ts: r.ts,
    kind: r.kind,
    durationMs: r.durationMs,
    costCents: r.costCents,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    success: r.success === null ? null : r.success === 1,
    metadata: r.metadata ?? null,
  }));
}

// ── Ingest: agents report execution events here (fire-and-forget SDK) ──────
router.post("/agents/:agentId/events", requireAgentCredential, async (req, res) => {
  const agentId = req.params.agentId as string;
  const body = IngestAgentEventBody.parse(req.body);

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  // Optional occurrence time: agents that batch/replay events report the real
  // execution time; invalid dates are rejected instead of silently becoming now.
  let ts: Date | undefined;
  if (body.ts !== undefined) {
    ts = new Date(body.ts);
    if (Number.isNaN(ts.getTime())) {
      res.status(400).json({ error: "Campo ts inválido — use ISO 8601." });
      return;
    }
  }

  await db.insert(agentEvents).values({
    agentId,
    ...(ts ? { ts } : {}),
    kind: (body.kind ?? "execution") as AgentEventRow["kind"],
    durationMs: body.durationMs != null ? Math.round(body.durationMs) : null,
    costCents: body.costCents != null ? Math.round(body.costCents) : null,
    tokensIn: body.tokensIn != null ? Math.round(body.tokensIn) : null,
    tokensOut: body.tokensOut != null ? Math.round(body.tokensOut) : null,
    success: body.success === undefined ? null : body.success ? 1 : 0,
    metadata: (body.metadata as Record<string, unknown> | undefined) ?? null,
  });

  res.status(202).json({ accepted: true });
});

router.post("/agents/:agentId/heartbeat", requireAgentCredential, async (req, res) => {
  const agentId = req.params.agentId as string;
  const body = ReportAgentHeartbeatBody.parse(req.body ?? {});
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const observedAt = new Date();
  await db.insert(agentEvents).values({
    agentId,
    ts: observedAt,
    kind: "heartbeat",
    success: body.status === "stopped" ? 0 : 1,
    metadata: {
      ...(body.metadata ?? {}),
      ...(body.runtime ? { runtime: body.runtime } : {}),
      ...(body.version ? { version: body.version } : {}),
      ...(body.intervalSeconds != null
        ? { intervalSeconds: body.intervalSeconds }
        : {}),
      ...(body.status ? { status: body.status } : {}),
    },
  });

  res.status(202).json({ accepted: true, observedAt });
});

router.post("/integrations/agent-events", requireAuth, requireOrg, async (req, res) => {
  const body = IngestExternalAgentEnvelopeBody.parse(req.body) as ExternalAgentEnvelope;
  if (body.contractVersion !== MUSTER_AGENT_INGESTION_CONTRACT_VERSION) {
    res.status(400).json({ error: "Versão de contrato não suportada." });
    return;
  }

  const [agent] = await db
    .select({ id: agents.id, externalId: agents.externalId })
    .from(agents)
    .where(and(eq(agents.externalId, body.agent.externalId), ofOrg(agents, req.orgId!)))
    .limit(1);

  if (!agent) {
    res.status(202).json({
        accepted: true,
        mapped: false,
        agentExternalId: body.agent.externalId,
        agentId: null,
        eventsAccepted: 0,
        observationsAccepted: 0,
        nextAction: "Descobrir/importar o agente antes de materializar telemetria e evidências.",
      });
    return;
  }

  const source = {
    platform: body.source.platform,
    ...(body.source.connectorId ? { connectorId: body.source.connectorId } : {}),
    ...(body.source.tenant ? { tenant: body.source.tenant } : {}),
    ...(body.source.reference ? { reference: body.source.reference } : {}),
  };
  const dedupeKey = body.eventId
    ? `${body.source.platform}:${body.eventId}`
    : undefined;
  if (dedupeKey && (body.execution || body.feedback)) {
    const [duplicate] = await db
      .select({ id: agentEvents.id })
      .from(agentEvents)
      .where(sql`${agentEvents.metadata}->>'dedupeKey' = ${dedupeKey}`)
      .limit(1);
    if (duplicate) {
      res.status(202).json({
        accepted: true,
        mapped: true,
        agentExternalId: body.agent.externalId,
        agentId: agent.id,
        eventsAccepted: 0,
        observationsAccepted: 0,
        nextAction: "Envelope já processado; nenhuma duplicidade foi criada.",
      });
      return;
    }
  }

  let eventsAccepted = 0;
  if (body.execution) {
    const execution = body.execution;
    const kind =
      execution.status === "error"
        ? "error"
        : execution.status === "escalated"
          ? "escalation"
          : "execution";
    const startedAt = execution.startedAt ? new Date(execution.startedAt) : null;
    await db.insert(agentEvents).values({
      agentId: agent.id,
      ...(startedAt && !Number.isNaN(startedAt.getTime()) ? { ts: startedAt } : {}),
      kind,
      durationMs: execution.durationMs != null ? Math.round(execution.durationMs) : null,
      costCents: execution.costCents != null ? Math.round(execution.costCents) : null,
      tokensIn: execution.tokensIn != null ? Math.round(execution.tokensIn) : null,
      tokensOut: execution.tokensOut != null ? Math.round(execution.tokensOut) : null,
      success:
        execution.status === "running" ? null : execution.status === "success" ? 1 : 0,
      metadata: {
        ...(execution.metadata ?? {}),
        source,
        ...(dedupeKey ? { dedupeKey } : {}),
        ...(execution.id ? { externalExecutionId: execution.id } : {}),
      },
    });
    eventsAccepted += 1;
  }

  if (body.feedback) {
    await db.insert(agentEvents).values({
      agentId: agent.id,
      kind: "feedback",
      success: body.feedback.kind === "negative" ? 0 : 1,
      metadata: { ...body.feedback, source, ...(dedupeKey ? { dedupeKey } : {}) },
    });
    eventsAccepted += 1;
  }

  for (const input of body.observations ?? []) {
    const observation = normalizeExternalObservation(input, source);
    await db.insert(metricEvidence).values({
      metricKey: observation.metricKey,
      label: observation.label,
      agentId: agent.id,
      value: observation.value,
      unit: observation.unit,
      kind: observation.kind,
      source: { type: "connector", ...observation.source },
      lineage: observation.lineage,
      confidence: observation.confidence,
      sampleSize: observation.sampleSize ?? null,
      qualityFlags: [],
      capturedAt: new Date(observation.capturedAt),
    });
  }

  const accepted = {
    accepted: true,
    mapped: true,
    agentExternalId: body.agent.externalId,
    agentId: agent.id,
    eventsAccepted,
    observationsAccepted: body.observations?.length ?? 0,
    nextAction: `Reavaliar o agente em POST /api/agents/${agent.id}/reevaluate para atualizar métricas e decisão.`,
  };
  res.status(202).json(accepted);
});

router.get("/agents/:agentId/supervision", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const [heartbeat] = await db
    .select({ ts: agentEvents.ts, metadata: agentEvents.metadata })
    .from(agentEvents)
    .where(and(eq(agentEvents.agentId, agentId), eq(agentEvents.kind, "heartbeat")))
    .orderBy(desc(agentEvents.ts))
    .limit(1);
  const metadata = (heartbeat?.metadata ?? {}) as Record<string, unknown>;
  const result = supervisionFromHeartbeat(new Date(), heartbeat ? {
    capturedAt: heartbeat.ts,
    intervalSeconds: typeof metadata.intervalSeconds === "number" ? metadata.intervalSeconds : undefined,
    runtime: typeof metadata.runtime === "string" ? metadata.runtime : undefined,
    version: typeof metadata.version === "string" ? metadata.version : undefined,
    reportedStatus: typeof metadata.status === "string" ? metadata.status : undefined,
  } : null);
  res.json(ReadAgentSupervisionResponse.parse({ agentId, ...result }));
});

// ── Telemetry summary ───────────────────────────────────────────────────────
router.get(
  "/agents/:agentId/telemetry/:window",
  requireAuth, requireOrg,
  async (req, res) => {
    const agentId = req.params.agentId as string;
    const windowDays = WINDOW_DAYS[req.params.window as string] ?? 30;
    const events = await loadEvents(agentId, windowDays);
    const summary = summarizeEvents(events, windowDays);
    res.json(GetAgentTelemetryResponse.parse(summary));
  },
);

// ── Reevaluate: telemetry-first, seeded fallback ────────────────────────────
// The real core of R6: when the agent has telemetry, the 5-layer evaluation is
// computed from actual executions and the verdict comes from the explicit,
// auditable decision rules. Seeded scoring remains only as demo fallback.
router.post("/agents/:agentId/reevaluate", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), ofOrg(agents, req.orgId!)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const [identity] = await db
    .select({ businessCase: agentIdentities.businessCase })
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, agentId))
    .limit(1);

  const windowDays = 30;
  const events = await loadEvents(agentId, windowDays);
  const summary = summarizeEvents(events, windowDays);
  const rawRealLayers = layersFromTelemetry(summary);
  const baselineAvailable = hasDeclaredBaseline(identity?.businessCase);
  const telemetryMetrics = proposedMetricsFromTelemetry(summary).map(
    (metric) => ({ ...metric, baselineAvailable }),
  );
  const telemetryEvaluation = scoreEvaluation(
    agent.externalId ?? agent.id,
    telemetryMetrics,
  );
  const realLayers = Object.fromEntries(
    Object.entries(rawRealLayers).map(([key, rawLayer]) => {
      const evaluatedLayer = telemetryEvaluation.layers.find(
        (layer) => layer.key === key,
      );
      return [
        key,
        rawLayer && evaluatedLayer
          ? { ...rawLayer, metrics: evaluatedLayer.metrics }
          : rawLayer,
      ];
    }),
  ) as ReturnType<typeof layersFromTelemetry>;
  const realLayerKeys = Object.keys(realLayers);

  // Base: latest stored evaluation (seeded or previous), for layers without data.
  const [latest] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.agentId, agentId))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  const allowSeeded = seededEvaluationsAllowed();
  const externalId = agent.externalId ?? agent.id;
  const fallback = allowSeeded
    ? scoreEvaluation(
        externalId,
        latest ? metricsFromLayers(latest.layers as KpiLayer[]) : [],
      )
    : noEvidenceEvaluation();

  const layers: KpiLayer[] = LAYER_ORDER.map((key) => {
    const real = realLayers[key];
    const fallbackLayer = fallback.layers.find((layer) => layer.key === key);
    if (real) {
      return {
        key,
        label: layerLabel(key),
        score: real.score,
        severity:
          real.score < 45
            ? "critical"
            : real.score < 60
              ? "high"
              : real.score < 75
                ? "medium"
                : "stable",
        metrics: real.metrics,
      };
    }
    return (
      fallbackLayer ?? {
        key,
        label: layerLabel(key),
        score: 50,
        severity: "medium",
        metrics: [],
      }
    );
  });

  const healthScore = Math.round(
    layers.reduce((s, l) => s + l.score, 0) / layers.length,
  );
  const dataSource =
    realLayerKeys.length === 0
      ? allowSeeded
        ? "seeded"
        : "none"
      : realLayerKeys.length >= 4
        ? "telemetry"
        : "mixed";

  const decision = decideVerdict({
    healthScore,
    layerScores: Object.fromEntries(layers.map((l) => [l.key, l.score])),
    dataSource,
    totalExecutions: summary.totalExecutions,
    windowDays,
    trendDelta: null,
    insufficientEvidence:
      realLayerKeys.length > 0
        ? telemetryEvaluation.evidence.insufficientEvidence
        : 0,
    notComparable:
      realLayerKeys.length > 0 ? telemetryEvaluation.evidence.notComparable : 0,
  });

  const changed =
    agent.healthScore !== healthScore ||
    agent.currentVerdict !== decision.verdict;

  await db.transaction(async (tx) => {
    if (latest) {
      await tx
        .update(evaluations)
        .set({
          layers,
          verdict: decision.verdict,
          verdictConfidence: decision.confidence,
          evaluatedAt: new Date(),
        })
        .where(eq(evaluations.id, latest.id));
    }
    await tx
      .update(agents)
      .set({
        healthScore,
        severity:
          healthScore < 45
            ? "critical"
            : healthScore < 60
              ? "high"
              : healthScore < 75
                ? "medium"
                : "stable",
        currentVerdict: decision.verdict,
        verdictConfidence: decision.confidence,
        lastEvaluatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
    // Keep the open committee verdict aligned.
    await tx
      .update(verdicts)
      .set({
        verdict: decision.verdict,
        confidence: decision.confidence,
        rationale: decision.rationale,
      })
      .where(
        and(eq(verdicts.agentId, agentId), eq(verdicts.decision, "pending")),
      );

    for (const metric of telemetryMetrics) {
      if (!metric.evidence) continue;
      const capturedAt = metric.evidence.capturedAt
        ? new Date(metric.evidence.capturedAt)
        : null;
      const existing = await tx
        .select({ id: metricEvidence.id })
        .from(metricEvidence)
        .where(
          and(
            eq(metricEvidence.agentId, agentId),
            eq(metricEvidence.metricKey, metric.evidence.metricKey),
            capturedAt
              ? eq(metricEvidence.capturedAt, capturedAt)
              : isNull(metricEvidence.capturedAt),
          ),
        )
        .limit(1);
      if (existing.length > 0) continue;

      await tx.insert(metricEvidence).values({
        metricKey: metric.evidence.metricKey,
        label: metric.evidence.label,
        agentId,
        value: metric.evidence.value,
        unit: metric.evidence.unit,
        kind: metric.evidence.kind,
        source: metric.evidence.source as unknown as Record<string, unknown>,
        lineage: metric.evidence.lineage as unknown as Record<string, unknown>[],
        confidence: metric.evidence.confidence,
        sampleSize: metric.evidence.sampleSize ?? null,
        qualityFlags: metric.evidence.qualityFlags as string[],
        capturedAt,
      } as typeof metricEvidence.$inferInsert);
    }
  });

  res.json(
    ReevaluateAgentResponse.parse({
      agentId,
      changed,
      healthScore,
      verdict: decision.verdict,
      dataSource,
      rationale: decision.rationale,
      rulesFired: decision.rulesFired,
    }),
  );
});

// ── Pre-assessment (R4): repo → carteira draft, no AI key needed ────────────
router.post("/discovery/pre-assess", requireAuth, requireOrg, async (req, res) => {
  const body = PreAssessAgentSourceBody.parse(req.body);
  try {
    const fetched = await fetchAgentSourceFromUrl(body.url);
    const result = preAssess(fetched.content, body.nameHint);
    res.json(
      PreAssessAgentSourceResponse.parse({
        draft: result.draft,
        fieldConfidence: result.fieldConfidence,
        platform: result.platform,
        signals: result.signals,
      }),
    );
  } catch (err) {
    if (err instanceof FetchSourceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Pre-assessment failed");
    res
      .status(502)
      .json({ error: "Não foi possível pré-avaliar o repositório." });
  }
});

export default router;
