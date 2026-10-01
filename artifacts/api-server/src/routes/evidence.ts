import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, agents, teams, purposes } from "@workspace/db";
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

type EvidenceReferences = Pick<
  ReturnType<typeof parseEvidenceBody>,
  "agentId" | "teamId" | "purposeId"
>;

/**
 * Confirma todas as referências opcionais dentro da mesma fronteira tenant.
 * A FK garante que o id existe; esta checagem adicional garante que ele é da
 * organização da requisição, algo que uma FK simples não consegue expressar.
 */
export async function invalidEvidenceReferences(
  orgId: string,
  references: EvidenceReferences,
): Promise<string[]> {
  const checks: Array<Promise<string | null>> = [];
  if (references.agentId) {
    checks.push(
      db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.id, references.agentId), eq(agents.orgId, orgId)))
        .limit(1)
        .then((rows) => (rows.length === 0 ? "agentId" : null)),
    );
  }
  if (references.teamId) {
    checks.push(
      db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, references.teamId), eq(teams.orgId, orgId)))
        .limit(1)
        .then((rows) => (rows.length === 0 ? "teamId" : null)),
    );
  }
  if (references.purposeId) {
    checks.push(
      db
        .select({ id: purposes.id })
        .from(purposes)
        .where(and(eq(purposes.id, references.purposeId), eq(purposes.orgId, orgId)))
        .limit(1)
        .then((rows) => (rows.length === 0 ? "purposeId" : null)),
    );
  }

  return (await Promise.all(checks)).filter(
    (field): field is string => field !== null,
  );
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
      .where(and(eq(metricEvidence.orgId, req.orgId!), ...filters))
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
  const invalidReferences = await invalidEvidenceReferences(req.orgId!, {
    agentId,
    teamId,
    purposeId,
  });
  if (invalidReferences.length > 0) {
    res.status(400).json({
      error: "Referência não encontrada nesta organização.",
      fields: invalidReferences,
    });
    return;
  }
  const [created] = await db
    .insert(metricEvidence)
    .values({
      orgId: req.orgId!,
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
