import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { agentGovernanceAssessments, agents, db } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";

const router: IRouter = Router();

const statusRank: Record<string, number> = {
  critical: 0,
  attention: 1,
  insufficient_data: 2,
  healthy: 3,
  not_assessed: 4,
} as const;

router.get(
  "/governance/realtime",
  requireAuth,
  requireOrg,
  async (req, res) => {
    const rows = await db
      .select({
        agentId: agents.id,
        agentName: agents.name,
        platform: agents.platform,
        version: agents.version,
        agentStatus: agents.status,
        healthScore: agents.healthScore,
        governanceStatus: agentGovernanceAssessments.status,
        directionScore: agentGovernanceAssessments.directionScore,
        protectionScore: agentGovernanceAssessments.protectionScore,
        proofScore: agentGovernanceAssessments.proofScore,
        contextHealthScore: agentGovernanceAssessments.contextHealthScore,
        hallucinationStatus: agentGovernanceAssessments.hallucinationStatus,
        groundedOutputRate: agentGovernanceAssessments.groundedOutputRate,
        hallucinationFlags: agentGovernanceAssessments.hallucinationFlags,
        auditedOutputs: agentGovernanceAssessments.auditedOutputs,
        regressionStatus: agentGovernanceAssessments.regressionStatus,
        regressionAttributable: agentGovernanceAssessments.regressionAttributable,
        inputDrift: agentGovernanceAssessments.inputDrift,
        baselineReleaseId: agentGovernanceAssessments.baselineReleaseId,
        currentReleaseId: agentGovernanceAssessments.currentReleaseId,
        signals: agentGovernanceAssessments.signals,
        recommendations: agentGovernanceAssessments.recommendations,
        evidenceCount: agentGovernanceAssessments.evidenceCount,
        sourceEventCount: agentGovernanceAssessments.sourceEventCount,
        assessedAt: agentGovernanceAssessments.assessedAt,
      })
      .from(agents)
      .leftJoin(
        agentGovernanceAssessments,
        eq(agentGovernanceAssessments.agentId, agents.id),
      )
      .where(eq(agents.orgId, req.orgId!))
      .orderBy(desc(agentGovernanceAssessments.assessedAt), asc(agents.name));

    const items = rows
      .map((row) => ({
        agentId: row.agentId,
        agentName: row.agentName,
        platform: row.platform,
        version: row.version,
        agentStatus: row.agentStatus,
        healthScore: row.healthScore,
        governanceStatus: row.governanceStatus ?? "not_assessed",
        directionScore: row.directionScore,
        protectionScore: row.protectionScore,
        proofScore: row.proofScore,
        contextHealthScore: row.contextHealthScore,
        hallucinationStatus: row.hallucinationStatus ?? "not_measured",
        groundedOutputRate: row.groundedOutputRate,
        hallucinationFlags: row.hallucinationFlags ?? 0,
        auditedOutputs: row.auditedOutputs ?? 0,
        regressionStatus: row.regressionStatus ?? "insufficient_data",
        regressionAttributable: row.regressionAttributable ?? false,
        inputDrift: row.inputDrift,
        baselineReleaseId: row.baselineReleaseId,
        currentReleaseId: row.currentReleaseId,
        signals: row.signals ?? [],
        recommendations: row.recommendations ?? [
          "Enviar telemetria instrumentada para iniciar a supervisão contínua.",
        ],
        evidenceCount: row.evidenceCount ?? 0,
        sourceEventCount: row.sourceEventCount ?? 0,
        assessedAt: row.assessedAt?.toISOString() ?? null,
      }))
      .sort(
        (left, right) =>
          statusRank[left.governanceStatus] - statusRank[right.governanceStatus] ||
          left.agentName.localeCompare(right.agentName, "pt-BR"),
      );

    const assessed = items.filter((item) => item.assessedAt !== null);
    const latestAssessment = assessed
      .map((item) => item.assessedAt)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null;

    res.json({
      summary: {
        totalAgents: items.length,
        assessedAgents: assessed.length,
        critical: items.filter((item) => item.governanceStatus === "critical").length,
        attention: items.filter((item) => item.governanceStatus === "attention").length,
        insufficientData: items.filter(
          (item) =>
            item.governanceStatus === "insufficient_data" ||
            item.governanceStatus === "not_assessed",
        ).length,
        hallucinationRisk: items.filter(
          (item) =>
            item.hallucinationStatus === "critical" ||
            item.hallucinationStatus === "warning",
        ).length,
        regressions: items.filter(
          (item) =>
            item.regressionStatus === "regression" ||
            item.regressionStatus === "warning",
        ).length,
        latestAssessment,
      },
      freshness: {
        serverTime: new Date().toISOString(),
        pollingRecommendedMs: 5_000,
        projectionTargetSeconds: 10,
      },
      items,
    });
  },
);

export default router;
