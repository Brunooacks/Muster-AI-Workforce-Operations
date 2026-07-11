import { and, desc, eq } from "drizzle-orm";
import {
  db,
  agents,
  evaluations,
  verdicts,
  type KpiLayer,
  type Severity,
  type VerdictType,
} from "@workspace/db";
import { logger } from "./logger";
import { scoreEvaluation, type ProposedMetric } from "./discovery";

// Rebuild the ProposedMetric inputs that `scoreEvaluation` expects from a
// stored evaluation's layers. The measured value/unit/target are the source of
// truth for goal attainment, so reconstructing from them lets us re-run the
// current scoring logic without inventing new numbers.
export function metricsFromLayers(layers: KpiLayer[]): ProposedMetric[] {
  const metrics: ProposedMetric[] = [];
  for (const layer of layers) {
    for (const m of layer.metrics) {
      metrics.push({
        layer: layer.key,
        label: m.label,
        sourceSignal: m.label,
        value: m.value,
        unit: m.unit,
        confidence: 0,
        ...(m.target ? { target: m.target } : {}),
        ...(m.rationale ? { rationale: m.rationale } : {}),
      });
    }
  }
  return metrics;
}

export interface ReevaluateResult {
  agentId: string;
  changed: boolean;
  healthScore: number;
  severity: Severity;
  verdict: VerdictType;
}

// Re-run the deterministic `scoreEvaluation` for a single already-admitted
// agent using its latest evaluation's metrics, then persist the refreshed layer
// scores, health score, severity and verdict so the agent reflects on/off-target
// attainment. Returns null when the agent or a scorable evaluation is missing.
//
// The recompute is deterministic (seeded by `externalId`) and reads only stored
// metric values/targets, so it is idempotent: agents already scored with the
// current logic produce identical results and are skipped unless `force` is set.
export async function recomputeAgentScores(
  agentId: string,
  opts: { force?: boolean; touchEvaluatedAt?: boolean } = {},
): Promise<ReevaluateResult | null> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return null;

  const [latest] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.agentId, agentId))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  if (!latest) return null;

  const metrics = metricsFromLayers(latest.layers as KpiLayer[]);
  if (metrics.length === 0) {
    // No stored metrics to score against; leave the agent untouched.
    return {
      agentId,
      changed: false,
      healthScore: agent.healthScore,
      severity: agent.severity,
      verdict: agent.currentVerdict,
    };
  }

  const externalId = agent.externalId ?? agent.id;
  const scored = scoreEvaluation(externalId, metrics);

  const unchanged =
    Math.round(agent.healthScore) === scored.healthScore &&
    agent.severity === scored.severity &&
    agent.currentVerdict === scored.verdict;

  if (unchanged && !opts.force) {
    return {
      agentId,
      changed: false,
      healthScore: scored.healthScore,
      severity: scored.severity,
      verdict: scored.verdict,
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(evaluations)
      .set({
        layers: scored.layers,
        verdict: scored.verdict,
        verdictConfidence: scored.verdictConfidence,
        ...(opts.touchEvaluatedAt ? { evaluatedAt: new Date() } : {}),
      })
      .where(eq(evaluations.id, latest.id));

    await tx
      .update(agents)
      .set({
        healthScore: scored.healthScore,
        severity: scored.severity,
        currentVerdict: scored.verdict,
        verdictConfidence: scored.verdictConfidence,
        ...(opts.touchEvaluatedAt ? { lastEvaluatedAt: new Date() } : {}),
      })
      .where(eq(agents.id, agentId));

    // Keep the open committee verdict aligned with the refreshed score so the
    // governance inbox and the agent summary agree.
    const [pending] = await tx
      .select()
      .from(verdicts)
      .where(
        and(eq(verdicts.agentId, agentId), eq(verdicts.decision, "pending")),
      )
      .orderBy(desc(verdicts.createdAt))
      .limit(1);
    if (pending) {
      await tx
        .update(verdicts)
        .set({ verdict: scored.verdict, confidence: scored.verdictConfidence })
        .where(eq(verdicts.id, pending.id));
    }
  });

  return {
    agentId,
    changed: true,
    healthScore: scored.healthScore,
    severity: scored.severity,
    verdict: scored.verdict,
  };
}

// One-time, idempotent backfill that re-scores every already-admitted agent so
// the whole fleet reflects the current goal-attainment scoring. Runs on boot;
// agents already consistent with the current logic are detected and skipped, so
// repeated boots are no-ops.
export async function backfillAgentScores(): Promise<void> {
  const rows = await db.select({ id: agents.id }).from(agents);
  let changed = 0;
  for (const row of rows) {
    try {
      const result = await recomputeAgentScores(row.id);
      if (result?.changed) changed += 1;
    } catch (err) {
      logger.error({ err, agentId: row.id }, "Failed to re-evaluate agent");
    }
  }
  if (changed > 0) {
    logger.info(
      { changed, total: rows.length },
      "Backfilled agent scores to goal-attainment scoring",
    );
  }
}
