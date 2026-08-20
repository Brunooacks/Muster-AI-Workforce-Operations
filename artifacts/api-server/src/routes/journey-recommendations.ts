import { Router, type IRouter, type Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  agents,
  db,
  journeyEvents,
  journeyRecommendationActions,
  journeyRecommendations,
  journeys,
  journeySteps,
} from "@workspace/db";
import {
  CreateJourneyRecommendationInput,
  JourneyIdParams,
  JourneyRecommendation,
  JourneyRecommendationAction,
  JourneyRecommendationActionParams,
  JourneyRecommendationDecisionInput,
  JourneyRecommendationParams,
  ListJourneyRecommendationsResponse,
  UpdateJourneyRecommendationActionInput,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { ofOrg } from "../lib/tenant-scope";
import { requireMixedTeamManager } from "../middlewares/mixedTeamRole";
import { summarizeJourneyMonitoring } from "../lib/journey-monitoring";
import { generateJourneyRecommendation } from "../lib/journey-recommendation-generator";
import {
  decideRecommendation,
  slaStatus,
  transitionRecommendationAction,
  type Recommendation as WorkflowRecommendation,
  type RecommendationAction as WorkflowAction,
} from "../lib/recommendation-workflow";

const router: IRouter = Router();

type RecommendationInput = ReturnType<typeof CreateJourneyRecommendationInput.parse>;
type RecommendationRow = typeof journeyRecommendations.$inferSelect;
type RecommendationActionRow = typeof journeyRecommendationActions.$inferSelect;

class RecommendationRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function serializeResult(result: unknown): string | null {
  if (result === undefined || result === null) return null;
  return typeof result === "string" ? result : JSON.stringify(result);
}

function toWorkflowRecommendation(row: RecommendationRow): WorkflowRecommendation {
  return {
    id: row.id,
    status: row.status,
    slaMinutes: row.reviewSlaMinutes,
    decidedBy: row.decidedBy,
    reason: row.decisionReason,
    rejectionDisposition: row.rejectionDisposition,
    decidedAt: row.decidedAt,
    nextReviewAt: row.nextReviewAt,
    updatedAt: row.updatedAt,
  };
}

function toWorkflowAction(row: RecommendationActionRow): WorkflowAction {
  return {
    id: row.id,
    status: row.status,
    actorType: row.actorType,
    executionMode: row.executionMode,
    controlScope: row.controlScope,
    capability: row.capability,
    result: row.result,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
  };
}

function toRecommendationAction(
  row: RecommendationActionRow,
  agentName: string | null,
  now: Date,
) {
  return JourneyRecommendationAction.parse({
    id: row.id,
    recommendationId: row.recommendationId,
    sequence: row.sequence,
    actorType: row.actorType,
    agentId: row.agentId,
    title: row.title,
    instructions: row.instructions,
    capability: row.capability,
    executionMode: row.executionMode,
    controlScope: row.controlScope,
    status: row.status,
    owner: row.owner,
    slaMinutes: row.slaMinutes,
    agentName,
    dueAt: row.dueAt?.toISOString() ?? null,
    result: row.result,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    slaStatus: slaStatus(row.dueAt, row.status, now),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toRecommendation(
  row: RecommendationRow,
  actions: RecommendationActionRow[],
  agentNames: Map<string, string>,
  now: Date,
) {
  const reviewStatus =
    row.status === "pending"
      ? slaStatus(row.reviewDueAt, "ready", now)
      : row.status === "rejected"
        ? "cancelled"
        : "completed";

  return JourneyRecommendation.parse({
    id: row.id,
    journeyId: row.journeyId,
    runId: row.runId,
    stepId: row.stepId,
    agentId: row.agentId,
    title: row.title,
    rationale: row.rationale,
    expectedImpact: row.expectedImpact,
    riskLevel: row.riskLevel,
    status: row.status,
    source: row.source,
    reviewSlaMinutes: row.reviewSlaMinutes,
    reviewDueAt: row.reviewDueAt.toISOString(),
    reviewSlaStatus: reviewStatus,
    decisionReason: row.decisionReason,
    rejectionDisposition: row.rejectionDisposition,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
    actions: actions.map((action) =>
      toRecommendationAction(
        action,
        action.agentId ? agentNames.get(action.agentId) ?? null : null,
        now,
      ),
    ),
    autonomySummary: {
      muster: actions.filter((action) => action.actorType === "muster").length,
      agent: actions.filter((action) => action.actorType === "agent").length,
      human: actions.filter((action) => action.actorType === "human").length,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function loadRecommendations(
  journeyId: string,
  orgId: string,
  recommendationId?: string,
) {
  const rows = await db
    .select()
    .from(journeyRecommendations)
    .where(
      recommendationId
        ? and(
            eq(journeyRecommendations.journeyId, journeyId),
            eq(journeyRecommendations.id, recommendationId),
          )
        : eq(journeyRecommendations.journeyId, journeyId),
    )
    .orderBy(desc(journeyRecommendations.createdAt));

  if (rows.length === 0) return [];

  const actions = await db
    .select()
    .from(journeyRecommendationActions)
    .where(
      inArray(
        journeyRecommendationActions.recommendationId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(journeyRecommendationActions.sequence));
  const agentIds = Array.from(
    new Set(actions.flatMap((action) => (action.agentId ? [action.agentId] : []))),
  );
  const agentRows = agentIds.length
    ? await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(and(inArray(agents.id, agentIds), ofOrg(agents, orgId)))
    : [];
  const agentNames = new Map(agentRows.map((agent) => [agent.id, agent.name]));
  const now = new Date();

  return rows.map((row) =>
    toRecommendation(
      row,
      actions.filter((action) => action.recommendationId === row.id),
      agentNames,
      now,
    ),
  );
}

async function validateRecommendationReferences(
  journeyId: string,
  input: RecommendationInput,
  orgId: string,
) {
  const [journey] = await db
    .select({ id: journeys.id })
    .from(journeys)
    .where(and(eq(journeys.id, journeyId), ofOrg(journeys, orgId)));
  if (!journey) {
    throw new RecommendationRequestError("Journey not found", 404);
  }

  const steps = await db
    .select({ id: journeySteps.id, agentId: journeySteps.agentId })
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, journeyId));
  const stepIds = new Set(steps.map((step) => step.id));
  const participantIds = new Set(
    steps.flatMap((step) => (step.agentId ? [step.agentId] : [])),
  );
  const sequences = input.actions.map((action) => action.sequence);

  if (new Set(sequences).size !== sequences.length) {
    throw new RecommendationRequestError("Action sequences must be unique", 400);
  }
  if (input.stepId && !stepIds.has(input.stepId)) {
    throw new RecommendationRequestError(
      "Recommendation step does not belong to the journey",
      409,
    );
  }
  for (const agentId of [
    input.agentId,
    ...input.actions.map((action) => action.agentId),
  ]) {
    if (agentId && !participantIds.has(agentId)) {
      throw new RecommendationRequestError(
        "Recommendation agent does not participate in the journey",
        409,
      );
    }
  }
}

async function createRecommendation(
  journeyId: string,
  input: RecommendationInput,
  orgId: string,
) {
  await validateRecommendationReferences(journeyId, input, orgId);
  const now = new Date();
  const reviewDueAt = new Date(now.getTime() + input.reviewSlaMinutes * 60_000);

  const recommendationId = await db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(journeyRecommendations)
      .values({
        journeyId,
        runId: input.runId ?? null,
        stepId: input.stepId ?? null,
        agentId: input.agentId ?? null,
        title: input.title,
        rationale: input.rationale,
        expectedImpact: input.expectedImpact,
        riskLevel: input.riskLevel,
        source: input.source,
        reviewSlaMinutes: input.reviewSlaMinutes,
        reviewDueAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: journeyRecommendations.id });

    await transaction.insert(journeyRecommendationActions).values(
      input.actions.map((action) => ({
        recommendationId: created!.id,
        sequence: action.sequence,
        actorType: action.actorType,
        agentId: action.agentId ?? null,
        title: action.title,
        instructions: action.instructions,
        capability: action.capability,
        executionMode: action.executionMode,
        controlScope: action.controlScope,
        owner: action.owner,
        slaMinutes: action.slaMinutes,
        status: "proposed" as const,
        createdAt: now,
        updatedAt: now,
      })),
    );
    return created!.id;
  });

  return (await loadRecommendations(journeyId, orgId, recommendationId))[0]!;
}

function sendRequestError(res: Response, error: unknown) {
  if (error instanceof RecommendationRequestError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

router.get(
  "/journeys/:journeyId/recommendations",
  requireAuth, requireOrg,
  async (req, res) => {
    const { journeyId } = JourneyIdParams.parse(req.params);
    const [journey] = await db
      .select({ id: journeys.id })
      .from(journeys)
      .where(and(eq(journeys.id, journeyId), ofOrg(journeys, req.orgId!)));
    if (!journey) {
      res.status(404).json({ error: "Journey not found" });
      return;
    }
    res.json(ListJourneyRecommendationsResponse.parse(await loadRecommendations(journeyId, req.orgId!)));
  },
);

router.post(
  "/journeys/:journeyId/recommendations",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId } = JourneyIdParams.parse(req.params);
    const body = CreateJourneyRecommendationInput.parse(req.body);
    try {
      res.status(201).json(await createRecommendation(journeyId, body, req.orgId!));
    } catch (error) {
      if (!sendRequestError(res, error)) throw error;
    }
  },
);

router.post(
  "/journeys/:journeyId/recommendations/generate",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId } = JourneyIdParams.parse(req.params);
    const [existing] = await db
      .select({ id: journeyRecommendations.id })
      .from(journeyRecommendations)
      .where(
        and(
          eq(journeyRecommendations.journeyId, journeyId),
          eq(journeyRecommendations.status, "pending"),
          eq(journeyRecommendations.source, "system"),
        ),
      )
      .orderBy(desc(journeyRecommendations.createdAt))
      .limit(1);
    if (existing) {
      res.status(200).json((await loadRecommendations(journeyId, req.orgId!, existing.id))[0]);
      return;
    }

    const [journey] = await db
      .select({ id: journeys.id })
      .from(journeys)
      .where(and(eq(journeys.id, journeyId), ofOrg(journeys, req.orgId!)));
    if (!journey) {
      res.status(404).json({ error: "Journey not found" });
      return;
    }
    const steps = await db
      .select()
      .from(journeySteps)
      .where(eq(journeySteps.journeyId, journeyId))
      .orderBy(asc(journeySteps.sequence));
    const events = await db
      .select()
      .from(journeyEvents)
      .where(eq(journeyEvents.journeyId, journeyId))
      .orderBy(asc(journeyEvents.ts));
    const agentIds = Array.from(
      new Set(steps.flatMap((step) => (step.agentId ? [step.agentId] : []))),
    );
    const agentRows = agentIds.length
      ? await db
          .select({ id: agents.id, name: agents.name })
          .from(agents)
          .where(and(inArray(agents.id, agentIds), ofOrg(agents, req.orgId!)))
      : [];
    const agentNames = new Map(agentRows.map((agent) => [agent.id, agent.name]));
    const monitoring = summarizeJourneyMonitoring({
      journeyId,
      steps: steps.map((step) => ({
        id: step.id,
        name: step.name,
        agentId: step.agentId,
        sequence: step.sequence,
      })),
      events: events
        .filter(
          (event) =>
            event.metadata?.type !== "recommendation-decision" &&
            event.metadata?.type !== "recommendation-action-transition",
        )
        .map((event) => ({
          ...event,
          success: event.success === null ? null : event.success === 1,
        })),
    });
    const generated = generateJourneyRecommendation(
      monitoring,
      steps.map((step) => ({
        id: step.id,
        name: step.name,
        agentId: step.agentId,
        agentName: step.agentId ? agentNames.get(step.agentId) ?? null : null,
      })),
    );

    try {
      res.status(201).json(
        await createRecommendation(
          journeyId,
          CreateJourneyRecommendationInput.parse(generated),
          req.orgId!,
        ),
      );
    } catch (error) {
      if (!sendRequestError(res, error)) throw error;
    }
  },
);

router.post(
  "/journeys/:journeyId/recommendations/:recommendationId/decision",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId, recommendationId } = JourneyRecommendationParams.parse(req.params);
    const body = JourneyRecommendationDecisionInput.parse(req.body);
    const [recommendation] = await db
      .select()
      .from(journeyRecommendations)
      .where(
        and(
          eq(journeyRecommendations.id, recommendationId),
          eq(journeyRecommendations.journeyId, journeyId),
        ),
      );
    if (!recommendation) {
      res.status(404).json({ error: "Recommendation not found" });
      return;
    }
    const actions = await db
      .select()
      .from(journeyRecommendationActions)
      .where(eq(journeyRecommendationActions.recommendationId, recommendationId))
      .orderBy(asc(journeyRecommendationActions.sequence));
    const now = new Date();

    let workflow;
    try {
      workflow = decideRecommendation({
        recommendation: toWorkflowRecommendation(recommendation),
        actions: actions.map(toWorkflowAction),
        decision: body.decision,
        decidedBy: body.decidedBy,
        reason: body.reason,
        rejectionDisposition: body.rejectionDisposition,
        now,
      });
    } catch (error) {
      res.status(409).json({
        error: error instanceof Error ? error.message : "Invalid recommendation decision",
      });
      return;
    }

    await db.transaction(async (transaction) => {
      await transaction
        .update(journeyRecommendations)
        .set({
          status: workflow.recommendation.status,
          decisionReason: workflow.recommendation.reason ?? null,
          rejectionDisposition: workflow.recommendation.rejectionDisposition ?? null,
          decidedBy: workflow.recommendation.decidedBy ?? null,
          decidedAt: workflow.recommendation.decidedAt ?? null,
          nextReviewAt: workflow.nextReviewAt,
          updatedAt: now,
        })
        .where(eq(journeyRecommendations.id, recommendationId));

      for (const action of workflow.actions) {
        const original = actions.find((candidate) => candidate.id === action.id)!;
        await transaction
          .update(journeyRecommendationActions)
          .set({
            status: action.status,
            dueAt:
              action.status === "cancelled"
                ? null
                : new Date(now.getTime() + original.slaMinutes * 60_000),
            result: serializeResult(action.result),
            startedAt: action.startedAt ?? null,
            completedAt: action.completedAt ?? null,
            updatedAt: now,
          })
          .where(eq(journeyRecommendationActions.id, action.id));
      }

      await transaction.insert(journeyEvents).values({
        journeyId,
        runId: recommendation.runId ?? `recommendation:${recommendationId}`,
        stepId: recommendation.stepId,
        agentId: recommendation.agentId,
        kind: "decision",
        ts: now,
        success: body.decision === "approved" ? 1 : 0,
        metadata: {
          type: "recommendation-decision",
          recommendationId,
          decision: body.decision,
          rejectionDisposition: body.rejectionDisposition ?? null,
          decidedBy: body.decidedBy,
          reason: body.reason,
        },
      });
    });

    res.json((await loadRecommendations(journeyId, req.orgId!, recommendationId))[0]);
  },
);

router.patch(
  "/journeys/:journeyId/recommendations/:recommendationId/actions/:actionId",
  requireAuth, requireOrg,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId, recommendationId, actionId } =
      JourneyRecommendationActionParams.parse(req.params);
    const body = UpdateJourneyRecommendationActionInput.parse(req.body);
    if (
      (body.status === "blocked" || body.status === "completed") &&
      !body.result?.trim()
    ) {
      res.status(400).json({ error: "Blocked and completed actions require a result" });
      return;
    }

    const [recommendation] = await db
      .select()
      .from(journeyRecommendations)
      .where(
        and(
          eq(journeyRecommendations.id, recommendationId),
          eq(journeyRecommendations.journeyId, journeyId),
        ),
      );
    if (!recommendation) {
      res.status(404).json({ error: "Recommendation not found" });
      return;
    }
    const actions = await db
      .select()
      .from(journeyRecommendationActions)
      .where(eq(journeyRecommendationActions.recommendationId, recommendationId))
      .orderBy(asc(journeyRecommendationActions.sequence));
    if (!actions.some((action) => action.id === actionId)) {
      res.status(404).json({ error: "Recommendation action not found" });
      return;
    }
    const now = new Date();

    let workflow;
    try {
      workflow = transitionRecommendationAction({
        recommendation: toWorkflowRecommendation(recommendation),
        actions: actions.map(toWorkflowAction),
        actionId,
        status: body.status,
        result: body.result,
        now,
      });
    } catch (error) {
      res.status(409).json({
        error: error instanceof Error ? error.message : "Invalid action transition",
      });
      return;
    }

    await db.transaction(async (transaction) => {
      await transaction
        .update(journeyRecommendations)
        .set({ status: workflow.recommendation.status, updatedAt: now })
        .where(eq(journeyRecommendations.id, recommendationId));

      for (const action of workflow.actions) {
        await transaction
          .update(journeyRecommendationActions)
          .set({
            status: action.status,
            result: serializeResult(action.result),
            startedAt: action.startedAt ?? null,
            completedAt: action.completedAt ?? null,
            updatedAt: action.updatedAt ?? now,
          })
          .where(eq(journeyRecommendationActions.id, action.id));
      }

      const transitioned = workflow.actions.find((action) => action.id === actionId)!;
      const transitionedRow = actions.find((action) => action.id === actionId)!;
      await transaction.insert(journeyEvents).values({
        journeyId,
        runId: recommendation.runId ?? `recommendation:${recommendationId}`,
        stepId: recommendation.stepId,
        agentId: transitioned.actorType === "agent" ? transitionedRow.agentId : null,
        kind: "decision",
        ts: now,
        success: body.status === "completed" ? 1 : body.status === "blocked" ? 0 : null,
        metadata: {
          type: "recommendation-action-transition",
          recommendationId,
          actionId,
          actorType: transitioned.actorType,
          capability: transitioned.capability,
          status: body.status,
          result: body.result ?? null,
        },
      });
    });

    res.json((await loadRecommendations(journeyId, req.orgId!, recommendationId))[0]);
  },
);

export default router;
