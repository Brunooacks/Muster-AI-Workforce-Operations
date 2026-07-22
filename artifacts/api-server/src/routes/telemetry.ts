import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, agents, agentEvents, evaluations, verdicts } from "@workspace/db";
import type { KpiLayer } from "@workspace/db";
import {
  IngestAgentEventBody,
  GetAgentTelemetryResponse,
  ReevaluateAgentResponse,
  PreAssessAgentSourceBody,
  PreAssessAgentSourceResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { summarizeEvents, layersFromTelemetry, type AgentEventRow } from "../lib/telemetry";
import { decideVerdict } from "../lib/decision-rules";
import { scoreEvaluation, LAYER_ORDER, layerLabel } from "../lib/discovery";
import { metricsFromLayers } from "../lib/reevaluate";
import { fetchAgentSourceFromUrl, FetchSourceError } from "../lib/fetch-source";
import { preAssess } from "../lib/pre-assessment";

const router: IRouter = Router();

const WINDOW_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

async function loadEvents(agentId: string, windowDays: number): Promise<AgentEventRow[]> {
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
router.post("/agents/:agentId/events", requireAuth, async (req, res) => {
  const agentId = req.params.agentId as string;
  const body = IngestAgentEventBody.parse(req.body);

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, agentId))
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

// ── Telemetry summary ───────────────────────────────────────────────────────
router.get("/agents/:agentId/telemetry/:window", requireAuth, async (req, res) => {
  const agentId = req.params.agentId as string;
  const windowDays = WINDOW_DAYS[req.params.window as string] ?? 30;
  const events = await loadEvents(agentId, windowDays);
  const summary = summarizeEvents(events, windowDays);
  res.json(GetAgentTelemetryResponse.parse(summary));
});

// ── Reevaluate: telemetry-first, seeded fallback ────────────────────────────
// The real core of R6: when the agent has telemetry, the 5-layer evaluation is
// computed from actual executions and the verdict comes from the explicit,
// auditable decision rules. Seeded scoring remains only as demo fallback.
router.post("/agents/:agentId/reevaluate", requireAuth, async (req, res) => {
  const agentId = req.params.agentId as string;
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const windowDays = 30;
  const events = await loadEvents(agentId, windowDays);
  const summary = summarizeEvents(events, windowDays);
  const realLayers = layersFromTelemetry(summary);
  const realLayerKeys = Object.keys(realLayers);

  // Base: latest stored evaluation (seeded or previous), for layers without data.
  const [latest] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.agentId, agentId))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  const externalId = agent.externalId ?? agent.id;
  const seededMetrics = latest ? metricsFromLayers(latest.layers as KpiLayer[]) : [];
  const seeded = scoreEvaluation(externalId, seededMetrics);

  const layers: KpiLayer[] = LAYER_ORDER.map((key) => {
    const real = realLayers[key];
    const fallback = seeded.layers.find((l) => l.key === key);
    if (real) {
      return {
        key,
        label: layerLabel(key),
        score: real.score,
        severity:
          real.score < 45 ? "critical" : real.score < 60 ? "high" : real.score < 75 ? "medium" : "stable",
        metrics: real.metrics,
      };
    }
    return fallback ?? { key, label: layerLabel(key), score: 50, severity: "medium", metrics: [] };
  });

  const healthScore = Math.round(layers.reduce((s, l) => s + l.score, 0) / layers.length);
  const dataSource =
    realLayerKeys.length === 0 ? "seeded" : realLayerKeys.length >= 4 ? "telemetry" : "mixed";

  const decision = decideVerdict({
    healthScore,
    layerScores: Object.fromEntries(layers.map((l) => [l.key, l.score])),
    dataSource,
    totalExecutions: summary.totalExecutions,
    windowDays,
    trendDelta: null,
  });

  const changed =
    agent.healthScore !== healthScore || agent.currentVerdict !== decision.verdict;

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
          healthScore < 45 ? "critical" : healthScore < 60 ? "high" : healthScore < 75 ? "medium" : "stable",
        currentVerdict: decision.verdict,
        verdictConfidence: decision.confidence,
        lastEvaluatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
    // Keep the open committee verdict aligned.
    await tx
      .update(verdicts)
      .set({ verdict: decision.verdict, confidence: decision.confidence, rationale: decision.rationale })
      .where(and(eq(verdicts.agentId, agentId), eq(verdicts.decision, "pending")));
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
router.post("/discovery/pre-assess", requireAuth, async (req, res) => {
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
    res.status(502).json({ error: "Não foi possível pré-avaliar o repositório." });
  }
});

export default router;
