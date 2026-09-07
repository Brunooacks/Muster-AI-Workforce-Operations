import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import {
  agentEvents,
  agents,
  alerts,
  db,
  evaluations,
  executiveReportSnapshots,
  insightRecords,
  metricPoints,
  type ExecutiveMetricComparison,
  type ExecutiveReportQuality,
  type ExecutiveReportSection,
} from "@workspace/db";
import {
  GenerateExecutiveReportBody,
  GetExecutiveReportParams,
  GetExecutiveReportResponse,
  ListExecutiveReportsQueryParams,
  ListExecutiveReportsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import { byAgentsOf, ofOrg } from "../lib/tenant-scope";
import {
  buildExecutiveMonthlyReport,
  executivePeriodBounds,
  type ExecutiveMonthlyReport,
} from "../lib/executive-reporting";
import { enrichExecutiveNarrative } from "../lib/executive-narrative";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type ReportRow = typeof executiveReportSnapshots.$inferSelect;
type InsightRow = typeof insightRecords.$inferSelect;

function serializeReport(row: ReportRow, reportInsights: InsightRow[]) {
  const bounds = executivePeriodBounds(row.period);
  return GetExecutiveReportResponse.parse({
    id: row.id,
    period: row.period,
    previousPeriod: bounds.previousPeriod,
    version: row.version,
    status: row.status,
    title: row.title,
    executiveSummary: row.executiveSummary,
    generatedAt: row.generatedAt,
    sourceWatermark: row.sourceWatermark,
    narrativeSource: row.narrativeSource,
    narrativeModel: row.narrativeModel,
    promptVersion: row.promptVersion,
    templateId: row.templateId,
    metrics: row.metrics,
    layerComparison: row.layerComparison,
    portfolio: row.portfolio,
    quality: row.quality,
    sections: row.sections,
    insights: reportInsights.map((insight) => ({
      id: insight.id,
      category: insight.category,
      title: insight.title,
      narrative: insight.narrative,
      recommendation: insight.recommendation,
      severity: insight.severity,
      confidence: insight.confidence,
      evidenceRefs: insight.evidenceRefs,
    })),
  });
}

async function collectReportFacts(orgId: string, period: string) {
  const allAgents = await db.select().from(agents).where(ofOrg(agents, orgId));
  const agentIds = allAgents.map((agent) => agent.id);
  if (agentIds.length === 0) {
    return { agents: allAgents, events: [], points: [], evaluations: [], alerts: [] };
  }
  const bounds = executivePeriodBounds(period);
  const agentScope = byAgentsOf(agentEvents.agentId, agentIds)!;
  const pointScope = byAgentsOf(metricPoints.agentId, agentIds)!;
  const evaluationScope = byAgentsOf(evaluations.agentId, agentIds)!;
  const alertScope = byAgentsOf(alerts.agentId, agentIds)!;
  const [eventsRows, pointRows, evaluationRows, alertRows] = await Promise.all([
    db.select().from(agentEvents).where(and(
      agentScope,
      gte(agentEvents.ts, bounds.previousStart),
      lt(agentEvents.ts, bounds.end),
    )),
    db.select().from(metricPoints).where(and(
      pointScope,
      gte(metricPoints.timestamp, bounds.previousStart),
      lt(metricPoints.timestamp, bounds.end),
    )),
    db.select().from(evaluations).where(and(
      evaluationScope,
      gte(evaluations.evaluatedAt, bounds.previousStart),
      lt(evaluations.evaluatedAt, bounds.end),
    )),
    db.select().from(alerts).where(and(alertScope, lt(alerts.detectedAt, bounds.end))),
  ]);
  return {
    agents: allAgents,
    events: eventsRows,
    points: pointRows,
    evaluations: evaluationRows,
    alerts: alertRows,
  };
}

async function buildTenantReport(orgId: string, period?: string): Promise<ExecutiveMonthlyReport> {
  const bounds = executivePeriodBounds(period);
  const facts = await collectReportFacts(orgId, bounds.period);
  return buildExecutiveMonthlyReport({
    period: bounds.period,
    agents: facts.agents,
    events: facts.events,
    points: facts.points,
    evaluations: facts.evaluations,
    alerts: facts.alerts,
  });
}

router.get("/executive-reports/monthly", requireAuth, requireOrg, async (req, res) => {
  const query = ListExecutiveReportsQueryParams.parse(req.query);
  const rows = await db
    .selectDistinctOn([executiveReportSnapshots.period])
    .from(executiveReportSnapshots)
    .where(eq(executiveReportSnapshots.orgId, req.orgId!))
    .orderBy(desc(executiveReportSnapshots.period), desc(executiveReportSnapshots.version))
    .limit(query.limit);
  res.json(ListExecutiveReportsResponse.parse({
    reports: rows.map((row) => ({
      id: row.id,
      period: row.period,
      version: row.version,
      status: row.status,
      title: row.title,
      executiveSummary: row.executiveSummary,
      generatedAt: row.generatedAt,
      narrativeSource: row.narrativeSource,
      qualityScore: row.quality.score,
      decisionReady: row.quality.decisionReady,
    })),
  }));
});

router.post(
  "/executive-reports/monthly/generate",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res, next) => {
    try {
      const body = GenerateExecutiveReportBody.parse(req.body ?? {});
      let report = await buildTenantReport(req.orgId!, body.period);
      if (body.narrativeMode === "ai-assisted") {
        try {
          report = await enrichExecutiveNarrative(report, body.templateId);
        } catch (error) {
          logger.warn({ error, orgId: req.orgId, period: report.period }, "AI executive narrative fell back to deterministic copy");
        }
      }

      const result = await db.transaction(async (transaction) => {
        const [previous] = await transaction
          .select({ version: executiveReportSnapshots.version })
          .from(executiveReportSnapshots)
          .where(and(
            eq(executiveReportSnapshots.orgId, req.orgId!),
            eq(executiveReportSnapshots.period, report.period),
          ))
          .orderBy(desc(executiveReportSnapshots.version))
          .limit(1);
        const version = (previous?.version ?? 0) + 1;
        await transaction
          .update(executiveReportSnapshots)
          .set({ status: "superseded" })
          .where(and(
            eq(executiveReportSnapshots.orgId, req.orgId!),
            eq(executiveReportSnapshots.period, report.period),
          ));
        const [created] = await transaction
          .insert(executiveReportSnapshots)
          .values({
            orgId: req.orgId!,
            period: report.period,
            version,
            status: "draft",
            templateId: body.templateId,
            title: report.title,
            executiveSummary: report.executiveSummary,
            metrics: report.metrics as Record<string, ExecutiveMetricComparison>,
            layerComparison: report.layerComparison,
            portfolio: report.portfolio,
            sections: report.sections as ExecutiveReportSection[],
            quality: report.quality as ExecutiveReportQuality,
            narrativeSource: report.narrativeSource,
            narrativeModel: report.narrativeModel,
            promptVersion: report.promptVersion,
            sourceWatermark: report.sourceWatermark ? new Date(report.sourceWatermark) : null,
            generatedBy: req.userId,
            generatedAt: new Date(report.generatedAt),
          })
          .returning();
        if (!created) throw new Error("Falha ao persistir relatório executivo.");
        const createdInsights = report.insights.length
          ? await transaction
              .insert(insightRecords)
              .values(report.insights.map((insight) => ({
                orgId: req.orgId!,
                reportId: created.id,
                period: report.period,
                category: insight.category,
                title: insight.title,
                narrative: insight.narrative,
                recommendation: insight.recommendation,
                severity: insight.severity,
                confidence: insight.confidence,
                evidenceRefs: insight.evidenceRefs,
                generationMethod: "rules" as const,
              })))
              .returning()
          : [];
        return { created, createdInsights };
      });
      res.status(201).json(serializeReport(result.created, result.createdInsights));
    } catch (error) {
      next(error);
    }
  },
);

router.get("/executive-reports/monthly/:period", requireAuth, requireOrg, async (req, res) => {
  const { period } = GetExecutiveReportParams.parse(req.params);
  const [row] = await db
    .select()
    .from(executiveReportSnapshots)
    .where(and(
      eq(executiveReportSnapshots.orgId, req.orgId!),
      eq(executiveReportSnapshots.period, period),
    ))
    .orderBy(desc(executiveReportSnapshots.version))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Relatório mensal ainda não gerado." });
    return;
  }
  const reportInsights = await db
    .select()
    .from(insightRecords)
    .where(eq(insightRecords.reportId, row.id))
    .orderBy(desc(insightRecords.generatedAt));
  res.json(serializeReport(row, reportInsights));
});

export default router;
