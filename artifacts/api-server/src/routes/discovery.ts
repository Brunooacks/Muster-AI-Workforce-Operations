import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, agentDrafts, discoveryRuns } from "@workspace/db";
import {
  StartDiscoveryRunBody,
  GetDiscoveryRunParams,
  GetDiscoveryRunResponse,
  ListAgentDraftsQueryParams,
  ListAgentDraftsResponse,
  UpdateAgentDraftParams,
  UpdateAgentDraftBody,
  UpdateAgentDraftResponse,
  ApproveAgentDraftParams,
  RejectAgentDraftParams,
  RejectAgentDraftBody,
  RejectAgentDraftResponse,
  BulkApproveAgentDraftsBody,
  BulkApproveAgentDraftsResponse,
  BulkRejectAgentDraftsBody,
  BulkRejectAgentDraftsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildAgentDetail, toAgentDraftRecord } from "../lib/serializers";
import { admitAgentTx, AlreadyAdmittedError } from "../lib/admission";
import { PLATFORM_CATALOG } from "../lib/discovery";

const router: IRouter = Router();

type DiscoveryRunRow = typeof discoveryRuns.$inferSelect;

async function runCounts(runId: string) {
  const reviewRows = await db
    .select({
      status: agentDrafts.reviewStatus,
      n: sql<number>`count(*)::int`,
    })
    .from(agentDrafts)
    .where(eq(agentDrafts.runId, runId))
    .groupBy(agentDrafts.reviewStatus);
  const enrichRows = await db
    .select({
      status: agentDrafts.enrichmentStatus,
      n: sql<number>`count(*)::int`,
    })
    .from(agentDrafts)
    .where(eq(agentDrafts.runId, runId))
    .groupBy(agentDrafts.enrichmentStatus);

  const review = new Map(reviewRows.map((r) => [r.status, r.n]));
  const enrich = new Map(enrichRows.map((r) => [r.status, r.n]));
  const total = reviewRows.reduce((s, r) => s + r.n, 0);

  return {
    total,
    pendingReview: review.get("pending") ?? 0,
    approved: review.get("approved") ?? 0,
    rejected: review.get("rejected") ?? 0,
    enrichmentPending: enrich.get("pending") ?? 0,
    enrichmentRules: enrich.get("rules") ?? 0,
    enriching: enrich.get("enriching") ?? 0,
    enriched: enrich.get("enriched") ?? 0,
    enrichmentFailed: enrich.get("failed") ?? 0,
  };
}

function toDiscoveryRun(
  r: DiscoveryRunRow,
  counts: Awaited<ReturnType<typeof runCounts>>,
) {
  return {
    id: r.id,
    source: r.source,
    sourceRef: r.sourceRef ?? null,
    status: r.status,
    totalDiscovered: r.totalDiscovered,
    draftsCreated: r.draftsCreated,
    note: r.note,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    counts,
  };
}

type ApproveOutcome =
  | { status: "ok"; agentId: string }
  | { status: "notFound" }
  | { status: "conflict"; reason: "alreadyReviewed" | "alreadyAdmitted" };

// Atomically promote a single staged draft into the real fleet. Locks the draft
// row, enforces the pending → approved transition, runs admission and links the
// draft to the created agent — all in one transaction so a failure leaves both
// the fleet and the draft untouched. Each draft is its own transaction so one
// failure never poisons a bulk run.
async function approveDraft(draftId: string): Promise<ApproveOutcome> {
  try {
    const agentId = await db.transaction(async (tx) => {
      const [draft] = await tx
        .select()
        .from(agentDrafts)
        .where(eq(agentDrafts.id, draftId))
        .for("update");
      if (!draft) throw new DraftNotFoundError();
      if (draft.reviewStatus !== "pending") throw new DraftNotPendingError();

      const id = await admitAgentTx(tx, {
        name: draft.name,
        role: draft.role,
        platform: draft.platform,
        bio:
          draft.bio ||
          `Promovido a partir de um rascunho de descoberta (${draft.source}).`,
        tagline: draft.tagline,
        shouldDo: draft.shouldDo,
        shouldNotDo: draft.shouldNotDo,
        autonomyLevel: draft.autonomyLevel,
        autonomyNotes: draft.autonomyNotes ?? undefined,
        limits: draft.limits,
        baseline: draft.businessCase.baseline,
        targetPayback: draft.businessCase.targetPayback,
        businessCaseDescription: draft.businessCase.description,
        proposedMetrics: draft.proposedMetrics,
        externalId: draft.externalId ?? undefined,
        initialEvaluationRationale:
          "Avaliação inicial proposta pela descoberta em massa; confirmar com dados reais.",
        initialVerdictRationale:
          "Agente promovido a partir de rascunho; veredito preliminar em observação.",
      });

      await tx
        .update(agentDrafts)
        .set({
          reviewStatus: "approved",
          promotedAgentId: id,
          updatedAt: new Date(),
        })
        .where(eq(agentDrafts.id, draftId));

      return id;
    });
    return { status: "ok", agentId };
  } catch (err) {
    if (err instanceof DraftNotFoundError) return { status: "notFound" };
    if (err instanceof DraftNotPendingError)
      return { status: "conflict", reason: "alreadyReviewed" };
    if (err instanceof AlreadyAdmittedError)
      return { status: "conflict", reason: "alreadyAdmitted" };
    throw err;
  }
}

class DraftNotFoundError extends Error {}
class DraftNotPendingError extends Error {}

router.post("/discovery/runs", requireAuth, async (req, res) => {
  const body = StartDiscoveryRunBody.parse(req.body);

  const [run] = await db
    .insert(discoveryRuns)
    .values({
      source: body.source,
      sourceRef: body.sourceRef,
      note: body.note ?? "",
      status: "running",
    })
    .returning();
  if (!run) throw new Error("Failed to create discovery run");

  // Minimal staging: for connector sources whose sourceRef matches the platform
  // catalog, stage a bare draft per discovered agent. The rich rule-based and
  // AI enrichment runs in separate workers (sibling tasks) and updates these.
  let staged = 0;
  const catalog = body.sourceRef
    ? PLATFORM_CATALOG.find((p) => p.platform === body.sourceRef)
    : undefined;
  if (catalog && catalog.discovered.length > 0) {
    await db.insert(agentDrafts).values(
      catalog.discovered.map((d) => ({
        runId: run.id,
        source: body.source,
        externalId: d.externalId,
        name: d.name,
        role: d.role,
        platform: catalog.platform,
        summary: `Descoberto via ${catalog.name}; aguardando enriquecimento.`,
        enrichmentStatus: "pending" as const,
        reviewStatus: "pending" as const,
      })),
    );
    staged = catalog.discovered.length;
  }

  const [updated] = await db
    .update(discoveryRuns)
    .set({
      status: "completed",
      totalDiscovered: staged,
      draftsCreated: staged,
      completedAt: new Date(),
    })
    .where(eq(discoveryRuns.id, run.id))
    .returning();

  const counts = await runCounts(run.id);
  res.status(201).json(toDiscoveryRun(updated!, counts));
});

router.get("/discovery/runs/:runId", requireAuth, async (req, res) => {
  const { runId } = GetDiscoveryRunParams.parse(req.params);
  const [run] = await db
    .select()
    .from(discoveryRuns)
    .where(eq(discoveryRuns.id, runId));
  if (!run) {
    res.status(404).json({ error: "Discovery run not found" });
    return;
  }
  const counts = await runCounts(runId);
  const data = GetDiscoveryRunResponse.parse(toDiscoveryRun(run, counts));
  res.json(data);
});

router.get("/discovery/drafts", requireAuth, async (req, res) => {
  const q = ListAgentDraftsQueryParams.parse(req.query);

  const conditions = [];
  if (q.runId) conditions.push(eq(agentDrafts.runId, q.runId));
  if (q.reviewStatus)
    conditions.push(eq(agentDrafts.reviewStatus, q.reviewStatus));
  if (q.enrichmentStatus)
    conditions.push(eq(agentDrafts.enrichmentStatus, q.enrichmentStatus));
  if (q.platform) conditions.push(eq(agentDrafts.platform, q.platform));
  if (q.minConfidence !== undefined)
    conditions.push(gte(agentDrafts.confidence, q.minConfidence));

  const rows = await db
    .select()
    .from(agentDrafts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(agentDrafts.confidence), desc(agentDrafts.createdAt));

  const search = q.search?.toLowerCase();
  const filtered = search
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          r.role.toLowerCase().includes(search) ||
          r.platform.toLowerCase().includes(search),
      )
    : rows;

  const data = ListAgentDraftsResponse.parse(filtered.map(toAgentDraftRecord));
  res.json(data);
});

router.patch("/discovery/drafts/:draftId", requireAuth, async (req, res) => {
  const { draftId } = UpdateAgentDraftParams.parse(req.params);
  const body = UpdateAgentDraftBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(agentDrafts)
    .where(eq(agentDrafts.id, draftId));
  if (!existing) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  if (existing.reviewStatus !== "pending") {
    res
      .status(409)
      .json({ error: "Só rascunhos pendentes podem ser editados." });
    return;
  }

  const [updated] = await db
    .update(agentDrafts)
    .set({
      name: body.name ?? existing.name,
      role: body.role ?? existing.role,
      platform: body.platform ?? existing.platform,
      tagline: body.tagline ?? existing.tagline,
      bio: body.bio ?? existing.bio,
      shouldDo: body.shouldDo ?? existing.shouldDo,
      shouldNotDo: body.shouldNotDo ?? existing.shouldNotDo,
      autonomyLevel: body.autonomyLevel ?? existing.autonomyLevel,
      autonomyNotes: body.autonomyNotes ?? existing.autonomyNotes,
      limits: body.limits ?? existing.limits,
      businessCase: body.businessCase ?? existing.businessCase,
      proposedMetrics: body.proposedMetrics ?? existing.proposedMetrics,
      summary: body.summary ?? existing.summary,
      confidence: body.confidence ?? existing.confidence,
      updatedAt: new Date(),
    })
    .where(
      and(eq(agentDrafts.id, draftId), eq(agentDrafts.reviewStatus, "pending")),
    )
    .returning();
  if (!updated) {
    res
      .status(409)
      .json({ error: "Só rascunhos pendentes podem ser editados." });
    return;
  }

  const data = UpdateAgentDraftResponse.parse(toAgentDraftRecord(updated));
  res.json(data);
});

router.post(
  "/discovery/drafts/bulk-approve",
  requireAuth,
  async (req, res) => {
    const body = BulkApproveAgentDraftsBody.parse(req.body);

    const agentIds: string[] = [];
    const draftIds: string[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const id of body.draftIds) {
      let outcome: ApproveOutcome;
      try {
        outcome = await approveDraft(id);
      } catch (err) {
        req.log.warn({ err, draftId: id }, "Bulk approve failed for draft");
        failed++;
        continue;
      }
      if (outcome.status === "ok") {
        agentIds.push(outcome.agentId);
        draftIds.push(id);
        succeeded++;
      } else {
        failed++;
      }
    }

    const data = BulkApproveAgentDraftsResponse.parse({
      requested: body.draftIds.length,
      succeeded,
      failed,
      agentIds,
      draftIds,
    });
    res.json(data);
  },
);

router.post("/discovery/drafts/bulk-reject", requireAuth, async (req, res) => {
  const body = BulkRejectAgentDraftsBody.parse(req.body);

  const draftIds: string[] = [];
  let succeeded = 0;

  if (body.draftIds.length > 0) {
    const updated = await db
      .update(agentDrafts)
      .set({
        reviewStatus: "rejected",
        reviewNote: body.reason ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(agentDrafts.id, body.draftIds),
          eq(agentDrafts.reviewStatus, "pending"),
        ),
      )
      .returning({ id: agentDrafts.id });
    succeeded = updated.length;
    draftIds.push(...updated.map((u) => u.id));
  }

  const data = BulkRejectAgentDraftsResponse.parse({
    requested: body.draftIds.length,
    succeeded,
    failed: body.draftIds.length - succeeded,
    agentIds: [],
    draftIds,
  });
  res.json(data);
});

router.post(
  "/discovery/drafts/:draftId/approve",
  requireAuth,
  async (req, res) => {
    const { draftId } = ApproveAgentDraftParams.parse(req.params);
    const outcome = await approveDraft(draftId);
    if (outcome.status === "notFound") {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    if (outcome.status === "conflict") {
      res.status(409).json({
        error:
          outcome.reason === "alreadyAdmitted"
            ? "Agente já admitido na frota."
            : "Só rascunhos pendentes podem ser aprovados.",
      });
      return;
    }
    const detail = await buildAgentDetail(outcome.agentId);
    res.status(201).json(detail);
  },
);

router.post(
  "/discovery/drafts/:draftId/reject",
  requireAuth,
  async (req, res) => {
    const { draftId } = RejectAgentDraftParams.parse(req.params);
    const body = RejectAgentDraftBody.parse(req.body);

    const [existing] = await db
      .select()
      .from(agentDrafts)
      .where(eq(agentDrafts.id, draftId));
    if (!existing) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    if (existing.reviewStatus !== "pending") {
      res
        .status(409)
        .json({ error: "Só rascunhos pendentes podem ser rejeitados." });
      return;
    }

    const [updated] = await db
      .update(agentDrafts)
      .set({
        reviewStatus: "rejected",
        reviewNote: body.reason ?? existing.reviewNote,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentDrafts.id, draftId),
          eq(agentDrafts.reviewStatus, "pending"),
        ),
      )
      .returning();
    if (!updated) {
      res
        .status(409)
        .json({ error: "Só rascunhos pendentes podem ser rejeitados." });
      return;
    }

    const data = RejectAgentDraftResponse.parse(toAgentDraftRecord(updated));
    res.json(data);
  },
);

export default router;
