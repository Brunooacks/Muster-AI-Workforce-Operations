import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { metricEvidence } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { loadMetricEvidence } from "../lib/evidence";
import type { MetricEvidenceCandidate, MetricEvidence } from "../lib/evidence";

const router: IRouter = Router();

function optionalReference(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} deve ser uma string não vazia ou null`);
  }
  return value.trim();
}

function parseLimit(value: unknown): number {
  if (value === undefined) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("limit deve ser um inteiro entre 1 e 100");
  }
  return parsed;
}

function parseEvidenceBody(body: unknown): {
  evidence: MetricEvidence;
  agentId?: string | null;
  teamId?: string | null;
  purposeId?: string | null;
} {
  if (body === null || typeof body !== "object") {
    throw new Error("Body de evidência deve ser um objeto");
  }
  const input = body as Record<string, unknown>;
  const candidate: MetricEvidenceCandidate = {
    metricKey: typeof input.metricKey === "string" ? input.metricKey : undefined,
    key: typeof input.key === "string" ? input.key : undefined,
    sourceSignal: typeof input.sourceSignal === "string" ? input.sourceSignal : undefined,
    label: typeof input.label === "string" ? input.label : "",
    value: typeof input.value === "number" ? input.value : Number.NaN,
    unit: typeof input.unit === "string" ? input.unit : "",
    capturedAt:
      typeof input.capturedAt === "string" || input.capturedAt instanceof Date
        ? input.capturedAt
        : input.capturedAt === null
          ? null
          : undefined,
    evidenceKind: typeof input.kind === "string" ? input.kind : undefined,
    source: input.source as MetricEvidenceCandidate["source"],
    lineage: input.lineage as MetricEvidenceCandidate["lineage"],
    confidence: typeof input.confidence === "number" ? input.confidence : undefined,
    sampleSize: typeof input.sampleSize === "number" ? input.sampleSize : undefined,
  };

  return {
    evidence: loadMetricEvidence(candidate),
    agentId: optionalReference(input.agentId, "agentId"),
    teamId: optionalReference(input.teamId, "teamId"),
    purposeId: optionalReference(input.purposeId, "purposeId"),
  };
}

function toMetricEvidence(row: typeof metricEvidence.$inferSelect): MetricEvidence {
  return {
    id: row.id,
    metricKey: row.metricKey,
    label: row.label,
    agentId: row.agentId,
    teamId: row.teamId,
    purposeId: row.purposeId,
    value: row.value,
    unit: row.unit,
    capturedAt: row.capturedAt?.toISOString() ?? null,
    kind: row.kind as MetricEvidence["kind"],
    source: row.source as unknown as MetricEvidence["source"],
    lineage: row.lineage as unknown as MetricEvidence["lineage"],
    confidence: row.confidence,
    ...(row.sampleSize === null ? {} : { sampleSize: row.sampleSize }),
    qualityFlags: row.qualityFlags as MetricEvidence["qualityFlags"],
  };
}

router.get("/evidence", requireAuth, requireOrg, async (req, res) => {
  const filters = [
    typeof req.query.metricKey === "string"
      ? eq(metricEvidence.metricKey, req.query.metricKey)
      : undefined,
    typeof req.query.agentId === "string"
      ? eq(metricEvidence.agentId, req.query.agentId)
      : undefined,
    typeof req.query.teamId === "string"
      ? eq(metricEvidence.teamId, req.query.teamId)
      : undefined,
    typeof req.query.purposeId === "string"
      ? eq(metricEvidence.purposeId, req.query.purposeId)
      : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);
  let rows;
  try {
    rows = await db
      .select()
      .from(metricEvidence)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(metricEvidence.capturedAt), desc(metricEvidence.createdAt))
      .limit(parseLimit(req.query.limit));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("limit ")) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }

  res.json(rows.map(toMetricEvidence));
});

router.post("/evidence", requireAuth, requireOrg, async (req, res) => {
  let parsed: ReturnType<typeof parseEvidenceBody>;
  try {
    parsed = parseEvidenceBody(req.body);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Payload de evidência inválido",
    });
    return;
  }
  const { evidence, agentId, teamId, purposeId } = parsed;
  const [created] = await db
    .insert(metricEvidence)
    .values({
      metricKey: evidence.metricKey,
      label: evidence.label,
      agentId,
      teamId,
      purposeId,
      value: evidence.value,
      unit: evidence.unit,
      kind: evidence.kind,
      source: evidence.source as unknown as Record<string, unknown>,
      lineage: evidence.lineage as unknown as Record<string, unknown>[],
      confidence: evidence.confidence,
      sampleSize: evidence.sampleSize ?? null,
      qualityFlags: evidence.qualityFlags,
      capturedAt: evidence.capturedAt ? new Date(evidence.capturedAt) : null,
    })
    .returning();

  res.status(201).json({
    ...toMetricEvidence(created!),
  });
});

export default router;
