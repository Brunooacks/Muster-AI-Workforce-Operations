import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import {
  agentGovernanceAssessments,
  db,
  agents,
  agentIdentities,
  agentOwners,
  agentEvents,
  alerts,
  evaluations,
  eventOutbox,
  metricEvidence,
  verdicts,
  type KpiLayer,
} from "@workspace/db";
import { decideVerdict } from "./decision-rules";
import { scoreEvaluation, LAYER_ORDER, layerLabel } from "./discovery";
import { hasDeclaredBaseline } from "./evaluation-metrics";
import {
  noEvidenceEvaluation,
  seededEvaluationsAllowed,
} from "./evaluation-policy";
import { metricsFromLayers } from "./reevaluate";
import {
  layersFromTelemetry,
  proposedMetricsFromTelemetry,
  summarizeEvents,
  type AgentEventRow,
} from "./telemetry";
import { telemetryAlertPlan } from "./telemetry-alert-policy";
import {
  declaredMetricContractsFromBusinessCase,
  projectTelemetryToDeclaredContracts,
} from "./metric-contract-projection";
import { assessContinuousGovernance } from "./continuous-governance";

export const AGENT_TELEMETRY_EVENT_TYPE = "agent.telemetry.recorded";
export const AGENT_EVALUATION_PROJECTED_EVENT_TYPE =
  "agent.evaluation.projected";

export interface AgentTelemetryReevaluationResult {
  agentId: string;
  changed: boolean;
  healthScore: number;
  verdict: string;
  dataSource: "seeded" | "none" | "telemetry" | "mixed";
  rationale: string;
  rulesFired: string[];
  governance: {
    status: string;
    regressionStatus: string;
    hallucinationStatus: string;
  };
}

export async function loadAgentEvents(
  agentId: string,
  windowDays: number,
): Promise<AgentEventRow[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const rows = await db
    .select()
    .from(agentEvents)
    .where(and(eq(agentEvents.agentId, agentId), gte(agentEvents.ts, since)));
  return rows.map((row) => ({
    id: row.id,
    agentId: row.agentId,
    ts: row.ts,
    kind: row.kind,
    durationMs: row.durationMs,
    costCents: row.costCents,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    success: row.success === null ? null : row.success === 1,
    metadata: row.metadata ?? null,
  }));
}

export async function reevaluateAgentFromTelemetry(input: {
  agentId: string;
  orgId: string;
  projectionCauseEventId?: string;
}): Promise<AgentTelemetryReevaluationResult | null> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.orgId, input.orgId)))
    .limit(1);
  if (!agent) return null;

  const [identity] = await db
    .select({ businessCase: agentIdentities.businessCase })
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, input.agentId))
    .limit(1);
  const [owners] = await db
    .select({ businessOwner: agentOwners.businessOwner })
    .from(agentOwners)
    .where(eq(agentOwners.agentId, input.agentId))
    .limit(1);

  const windowDays = 30;
  const events = await loadAgentEvents(input.agentId, windowDays);
  const summary = summarizeEvents(events, windowDays);
  const rawRealLayers = layersFromTelemetry(summary);
  const baselineAvailable = hasDeclaredBaseline(identity?.businessCase);
  const declaredMetricContracts = declaredMetricContractsFromBusinessCase(
    identity?.businessCase,
  );
  const telemetryMetrics = projectTelemetryToDeclaredContracts(
    declaredMetricContracts,
    proposedMetricsFromTelemetry(summary),
  ).map(
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
  const [evidenceSummary] = await db
    .select({ count: count() })
    .from(metricEvidence)
    .where(
      and(
        eq(metricEvidence.orgId, input.orgId),
        eq(metricEvidence.agentId, input.agentId),
      ),
    );

  const [latest] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.agentId, input.agentId))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);
  const allowSeeded = seededEvaluationsAllowed();
  const externalId = agent.externalId ?? agent.id;
  const fallback = allowSeeded && declaredMetricContracts.length === 0
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
    layers.reduce((sum, layer) => sum + layer.score, 0) / layers.length,
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
    layerScores: Object.fromEntries(
      layers.map((layer) => [layer.key, layer.score]),
    ),
    dataSource,
    totalExecutions: summary.totalExecutions,
    windowDays,
    trendDelta: null,
    insufficientEvidence:
      realLayerKeys.length > 0
        ? telemetryEvaluation.evidence.insufficientEvidence
        : 0,
    notComparable:
      realLayerKeys.length > 0
        ? telemetryEvaluation.evidence.notComparable
        : 0,
  });

  const changed =
    agent.healthScore !== healthScore ||
    agent.currentVerdict !== decision.verdict;
  const evaluatedAt = new Date();
  const alertPlan = telemetryAlertPlan({
    verdict: decision.verdict,
    healthScore,
    rationale: decision.rationale,
    evaluatedAt,
  });
  const governanceAssessment = assessContinuousGovernance({
    events,
    summary,
    agentVersion: agent.version,
    hasPurpose: Boolean(identity?.businessCase?.description?.trim()),
    hasOwner: Boolean(owners?.businessOwner?.trim()),
    hasMetricContracts: declaredMetricContracts.length > 0,
    evidenceCount:
      Number(evidenceSummary?.count ?? 0) +
      telemetryMetrics.filter((metric) => Boolean(metric.evidence)).length,
  });

  await db.transaction(async (transaction) => {
    if (latest) {
      await transaction
        .update(evaluations)
        .set({
          layers,
          verdict: decision.verdict,
          verdictConfidence: decision.confidence,
          evaluatedAt,
        })
        .where(eq(evaluations.id, latest.id));
    }
    await transaction
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
        monthlyVolume: summary.totalExecutions,
        monthlyCost: summary.totalCostCents / 100,
        lastEvaluatedAt: evaluatedAt,
      })
      .where(
        and(eq(agents.id, input.agentId), eq(agents.orgId, input.orgId)),
      );
    await transaction
      .update(verdicts)
      .set({
        verdict: decision.verdict,
        confidence: decision.confidence,
        rationale: decision.rationale,
      })
      .where(
        and(
          eq(verdicts.agentId, input.agentId),
          eq(verdicts.decision, "pending"),
        ),
      );

    const [currentTelemetryAlert] = await transaction
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.agentId, input.agentId),
          eq(alerts.patternType, "telemetry-performance"),
          eq(alerts.status, "active"),
        ),
      )
      .limit(1);
    if (alertPlan && currentTelemetryAlert) {
      await transaction
        .update(alerts)
        .set({
          ...alertPlan,
          assignedTo: owners?.businessOwner || null,
          detectedAt: evaluatedAt,
        })
        .where(eq(alerts.id, currentTelemetryAlert.id));
    } else if (alertPlan) {
      await transaction.insert(alerts).values({
        agentId: input.agentId,
        ...alertPlan,
        assignedTo: owners?.businessOwner || null,
        status: "active",
      });
    } else if (currentTelemetryAlert) {
      await transaction
        .update(alerts)
        .set({ status: "resolved", resolvedAt: evaluatedAt })
        .where(eq(alerts.id, currentTelemetryAlert.id));
    }

    await transaction
      .insert(agentGovernanceAssessments)
      .values({
        agentId: input.agentId,
        orgId: input.orgId,
        status: governanceAssessment.status,
        directionScore: governanceAssessment.directionScore,
        protectionScore: governanceAssessment.protectionScore,
        proofScore: governanceAssessment.proofScore,
        contextHealthScore: governanceAssessment.contextHealthScore,
        hallucinationStatus: governanceAssessment.hallucinationStatus,
        groundedOutputRate: governanceAssessment.groundedOutputRate,
        hallucinationFlags: governanceAssessment.hallucinationFlags,
        auditedOutputs: governanceAssessment.auditedOutputs,
        regressionStatus: governanceAssessment.regression.status,
        regressionAttributable: governanceAssessment.regression.attributable,
        inputDrift: governanceAssessment.regression.inputDrift,
        baselineReleaseId: governanceAssessment.regression.baselineReleaseId,
        currentReleaseId: governanceAssessment.regression.currentReleaseId,
        signals: governanceAssessment.regression.signals.map((signal) => ({
          ...signal,
        })),
        recommendations: governanceAssessment.recommendations,
        evidenceCount:
          Number(evidenceSummary?.count ?? 0) +
          telemetryMetrics.filter((metric) => Boolean(metric.evidence)).length,
        sourceEventCount: governanceAssessment.sourceEventCount,
        assessedAt: evaluatedAt,
      })
      .onConflictDoUpdate({
        target: agentGovernanceAssessments.agentId,
        set: {
          orgId: input.orgId,
          status: governanceAssessment.status,
          directionScore: governanceAssessment.directionScore,
          protectionScore: governanceAssessment.protectionScore,
          proofScore: governanceAssessment.proofScore,
          contextHealthScore: governanceAssessment.contextHealthScore,
          hallucinationStatus: governanceAssessment.hallucinationStatus,
          groundedOutputRate: governanceAssessment.groundedOutputRate,
          hallucinationFlags: governanceAssessment.hallucinationFlags,
          auditedOutputs: governanceAssessment.auditedOutputs,
          regressionStatus: governanceAssessment.regression.status,
          regressionAttributable: governanceAssessment.regression.attributable,
          inputDrift: governanceAssessment.regression.inputDrift,
          baselineReleaseId: governanceAssessment.regression.baselineReleaseId,
          currentReleaseId: governanceAssessment.regression.currentReleaseId,
          signals: governanceAssessment.regression.signals.map((signal) => ({
            ...signal,
          })),
          recommendations: governanceAssessment.recommendations,
          evidenceCount:
            Number(evidenceSummary?.count ?? 0) +
            telemetryMetrics.filter((metric) => Boolean(metric.evidence)).length,
          sourceEventCount: governanceAssessment.sourceEventCount,
          assessedAt: evaluatedAt,
        },
      });

    const [currentGovernanceAlert] = await transaction
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.agentId, input.agentId),
          eq(alerts.patternType, "continuous-governance"),
          eq(alerts.status, "active"),
        ),
      )
      .limit(1);
    if (governanceAssessment.status !== "healthy") {
      const governanceAlert = {
        pattern:
          governanceAssessment.status === "critical"
            ? "Governança contínua exige contenção"
            : governanceAssessment.status === "attention"
              ? "Governança contínua requer atenção"
              : "Evidência insuficiente para governança contínua",
        patternType: "continuous-governance",
        severity:
          governanceAssessment.status === "critical"
            ? ("critical" as const)
            : governanceAssessment.status === "attention"
              ? ("high" as const)
              : ("medium" as const),
        hypothesis: [
          `Regressão: ${governanceAssessment.regression.status}`,
          `Fundamentação: ${governanceAssessment.hallucinationStatus}`,
          `Contexto: ${governanceAssessment.contextHealthScore ?? "não medido"}`,
        ].join(" · "),
        recommendation:
          governanceAssessment.recommendations[0] ??
          "Revisar evidências e política de autonomia do agente.",
        assignedTo: owners?.businessOwner || null,
        detectedAt: evaluatedAt,
      };
      if (currentGovernanceAlert) {
        await transaction
          .update(alerts)
          .set(governanceAlert)
          .where(eq(alerts.id, currentGovernanceAlert.id));
      } else {
        await transaction.insert(alerts).values({
          agentId: input.agentId,
          ...governanceAlert,
          status: "active",
        });
      }
    } else if (currentGovernanceAlert) {
      await transaction
        .update(alerts)
        .set({ status: "resolved", resolvedAt: evaluatedAt })
        .where(eq(alerts.id, currentGovernanceAlert.id));
    }

    const activeAlertRows = await transaction
      .select({ id: alerts.id })
      .from(alerts)
      .where(and(eq(alerts.agentId, input.agentId), eq(alerts.status, "active")));
    await transaction
      .update(agents)
      .set({ activeAlerts: activeAlertRows.length })
      .where(
        and(eq(agents.id, input.agentId), eq(agents.orgId, input.orgId)),
      );

    for (const metric of telemetryMetrics) {
      if (!metric.evidence) continue;
      const capturedAt = metric.evidence.capturedAt
        ? new Date(metric.evidence.capturedAt)
        : null;
      const existing = await transaction
        .select({ id: metricEvidence.id })
        .from(metricEvidence)
        .where(
          and(
            eq(metricEvidence.orgId, input.orgId),
            eq(metricEvidence.agentId, input.agentId),
            eq(metricEvidence.metricKey, metric.evidence.metricKey),
            capturedAt
              ? eq(metricEvidence.capturedAt, capturedAt)
              : isNull(metricEvidence.capturedAt),
          ),
        )
        .limit(1);
      if (existing.length > 0) continue;

      await transaction.insert(metricEvidence).values({
        orgId: input.orgId,
        metricKey: metric.evidence.metricKey,
        label: metric.evidence.label,
        agentId: input.agentId,
        value: metric.evidence.value,
        unit: metric.evidence.unit,
        kind: metric.evidence.kind,
        source: metric.evidence.source as unknown as Record<string, unknown>,
        lineage:
          metric.evidence.lineage as unknown as Record<string, unknown>[],
        confidence: metric.evidence.confidence,
        sampleSize: metric.evidence.sampleSize ?? null,
        qualityFlags: metric.evidence.qualityFlags as string[],
        capturedAt,
      } as typeof metricEvidence.$inferInsert);
    }

    if (input.projectionCauseEventId) {
      await transaction.insert(eventOutbox).values({
        orgId: input.orgId,
        aggregateType: "agent",
        aggregateId: input.agentId,
        eventType: AGENT_EVALUATION_PROJECTED_EVENT_TYPE,
        priority: "normal",
        status: "completed",
        processedAt: evaluatedAt,
        payload: {
          agentId: input.agentId,
          causeEventId: input.projectionCauseEventId,
          changed,
          healthScore,
          verdict: decision.verdict,
          dataSource,
          rationale: decision.rationale,
          rulesFired: decision.rulesFired,
          governance: {
            status: governanceAssessment.status,
            directionScore: governanceAssessment.directionScore,
            protectionScore: governanceAssessment.protectionScore,
            proofScore: governanceAssessment.proofScore,
            contextHealthScore: governanceAssessment.contextHealthScore,
            hallucinationStatus: governanceAssessment.hallucinationStatus,
            groundedOutputRate: governanceAssessment.groundedOutputRate,
            regressionStatus: governanceAssessment.regression.status,
            regressionAttributable:
              governanceAssessment.regression.attributable,
            inputDrift: governanceAssessment.regression.inputDrift,
          },
          evaluatedAt: evaluatedAt.toISOString(),
        },
      });
    }
  });

  return {
    agentId: input.agentId,
    changed,
    healthScore,
    verdict: decision.verdict,
    dataSource,
    rationale: decision.rationale,
    rulesFired: decision.rulesFired,
    governance: {
      status: governanceAssessment.status,
      regressionStatus: governanceAssessment.regression.status,
      hallucinationStatus: governanceAssessment.hallucinationStatus,
    },
  };
}
