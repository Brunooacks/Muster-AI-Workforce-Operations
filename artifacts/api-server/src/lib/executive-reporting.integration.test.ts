import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  executiveReportSnapshots,
  insightRecords,
  organizations,
} from "@workspace/db/schema";

const runIntegration = process.env.RUN_TENANT_DB_TESTS === "true";

type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;

const suffix = randomUUID().slice(0, 8);
const orgA = `org_report_a_${suffix}`;
const orgB = `org_report_b_${suffix}`;

const quality = {
  score: 84,
  dataCoverage: 90,
  evaluationConfidence: 75,
  decisionReady: true,
  limitations: [],
};

describe.skipIf(!runIntegration)("executive reporting PostgreSQL", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    await workspaceDb.db.insert(organizations).values([
      { id: orgA, name: "Reporting A", slug: `reporting-a-${suffix}` },
      { id: orgB, name: "Reporting B", slug: `reporting-b-${suffix}` },
    ]);
  });

  afterAll(async () => {
    if (!workspaceDb) return;
    await workspaceDb.db
      .delete(organizations)
      .where(inArray(organizations.id, [orgA, orgB]));
  });

  it("versions snapshots and links auditable insights", async () => {
    const [first] = await workspaceDb.db
      .insert(executiveReportSnapshots)
      .values({
        orgId: orgA,
        period: "2026-08",
        version: 1,
        templateId: "board-brief",
        title: "Board Brief",
        executiveSummary: "Primeira versão factual.",
        quality,
      })
      .returning();
    await workspaceDb.db.insert(insightRecords).values({
      orgId: orgA,
      reportId: first!.id,
      period: "2026-08",
      category: "quality",
      title: "Cobertura suficiente",
      narrative: "A cobertura permite uma decisão com ressalvas conhecidas.",
      recommendation: "Revisar a amostra antes da publicação.",
      confidence: 84,
      evidenceRefs: ["quality:dataCoverage"],
      generationMethod: "rules",
    });
    await workspaceDb.db
      .update(executiveReportSnapshots)
      .set({ status: "superseded" })
      .where(eq(executiveReportSnapshots.id, first!.id));
    const [second] = await workspaceDb.db
      .insert(executiveReportSnapshots)
      .values({
        orgId: orgA,
        period: "2026-08",
        version: 2,
        templateId: "risk-governance",
        title: "Risk & Governance",
        executiveSummary: "Segunda versão factual.",
        quality,
      })
      .returning();

    const versions = await workspaceDb.db
      .select({ version: executiveReportSnapshots.version, status: executiveReportSnapshots.status })
      .from(executiveReportSnapshots)
      .where(and(
        eq(executiveReportSnapshots.orgId, orgA),
        eq(executiveReportSnapshots.period, "2026-08"),
      ))
      .orderBy(desc(executiveReportSnapshots.version));
    const linkedInsights = await workspaceDb.db
      .select({ reportId: insightRecords.reportId, evidenceRefs: insightRecords.evidenceRefs })
      .from(insightRecords)
      .where(eq(insightRecords.orgId, orgA));

    expect(versions).toEqual([
      { version: 2, status: "draft" },
      { version: 1, status: "superseded" },
    ]);
    expect(linkedInsights).toEqual([
      { reportId: first!.id, evidenceRefs: ["quality:dataCoverage"] },
    ]);
    expect(second!.templateId).toBe("risk-governance");
  });

  it("keeps report and insight queries tenant-scoped", async () => {
    await workspaceDb.db.insert(executiveReportSnapshots).values({
      orgId: orgB,
      period: "2026-08",
      version: 1,
      title: "Outro tenant",
      executiveSummary: "Não deve aparecer para A.",
      quality,
    });

    const visibleToA = await workspaceDb.db
      .select({ orgId: executiveReportSnapshots.orgId })
      .from(executiveReportSnapshots)
      .where(eq(executiveReportSnapshots.orgId, orgA));
    const visibleInsightsToB = await workspaceDb.db
      .select({ orgId: insightRecords.orgId })
      .from(insightRecords)
      .where(eq(insightRecords.orgId, orgB));

    expect(visibleToA).toHaveLength(2);
    expect(visibleToA.every((row) => row.orgId === orgA)).toBe(true);
    expect(visibleInsightsToB).toEqual([]);
  });
});
