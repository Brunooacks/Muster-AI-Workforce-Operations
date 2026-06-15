import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, agents, alerts } from "@workspace/db";
import {
  GetFleetSummaryResponse,
  ListFleetAlertsQueryParams,
  ListFleetAlertsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/fleet/summary", requireAuth, async (_req, res) => {
  const allAgents = await db.select().from(agents);
  const allAlerts = await db.select().from(alerts);

  const byVerdict = { promote: 0, mentor: 0, retire: 0, observation: 0 };
  const bySeverity = { critical: 0, high: 0, medium: 0, stable: 0 };
  const platformCounts = new Map<string, number>();
  let healthSum = 0;
  let valueSum = 0;
  let costSum = 0;

  for (const a of allAgents) {
    byVerdict[a.currentVerdict] += 1;
    bySeverity[a.severity] += 1;
    platformCounts.set(a.platform, (platformCounts.get(a.platform) ?? 0) + 1);
    healthSum += a.healthScore;
    valueSum += a.monthlyValue;
    costSum += a.monthlyCost;
  }

  const activeAlerts = allAlerts.filter((a) => a.status === "active").length;

  const data = GetFleetSummaryResponse.parse({
    totalAgents: allAgents.length,
    byVerdict,
    bySeverity,
    byPlatform: [...platformCounts.entries()].map(([platform, count]) => ({
      platform,
      count,
    })),
    avgHealthScore: allAgents.length
      ? Math.round(healthSum / allAgents.length)
      : 0,
    activeAlerts,
    estimatedMonthlyValue: valueSum,
    estimatedMonthlyCost: costSum,
    connectedPlatforms: platformCounts.size,
  });

  res.json(data);
});

router.get("/fleet/alerts", requireAuth, async (req, res) => {
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
    })
    .from(alerts)
    .innerJoin(agents, eq(alerts.agentId, agents.id))
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

export default router;
