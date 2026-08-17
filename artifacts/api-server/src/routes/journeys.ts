import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  agents,
  db,
  journeyEvents,
  journeyHandoffs,
  journeys,
  journeySteps,
  purposes,
  teamAgentAssignments,
  teams,
} from "@workspace/db";
import {
  CreateJourneyInput,
  Journey,
  JourneyDetail,
  JourneyEvent,
  JourneyEventInput,
  JourneyHandoff,
  JourneyHandoffInput,
  JourneyHandoffParams,
  JourneyIdParams,
  JourneyMonitoring,
  JourneyStep,
  JourneyStepInput,
  JourneyStepParams,
  ListJourneysResponse,
  UpdateJourneyInput,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireMixedTeamManager } from "../middlewares/mixedTeamRole";
import { slugifyTeamName } from "../lib/mixed-team";
import { summarizeJourneyMonitoring } from "../lib/journey-monitoring";

const router: IRouter = Router();

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function toJourney(
  row: typeof journeys.$inferSelect,
  stepCount: number,
  handoffCount: number,
  agentCount: number,
) {
  return Journey.parse({
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    entryCriterion: row.entryCriterion,
    successCriterion: row.successCriterion,
    status: row.status,
    slaMinutes: row.slaMinutes,
    owner: row.owner,
    stepCount,
    handoffCount,
    agentCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toStep(
  row: typeof journeySteps.$inferSelect,
  agent?: typeof agents.$inferSelect | null,
) {
  return JourneyStep.parse({
    id: row.id,
    journeyId: row.journeyId,
    stepKey: row.stepKey,
    name: row.name,
    sequence: row.sequence,
    stepType: row.stepType,
    agentId: row.agentId,
    responsibility: row.responsibility,
    decisionMode: row.decisionMode,
    expectedDurationMs: row.expectedDurationMs,
    required: row.required === 1,
    guardrails: row.guardrails,
    agent: agent
      ? {
          id: agent.id,
          name: agent.name,
          platform: agent.platform,
          role: agent.role,
          status: agent.status,
          healthScore: agent.healthScore,
          currentVerdict: agent.currentVerdict,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toHandoff(row: typeof journeyHandoffs.$inferSelect) {
  return JourneyHandoff.parse({
    id: row.id,
    journeyId: row.journeyId,
    fromStepId: row.fromStepId,
    toStepId: row.toStepId,
    condition: row.condition,
    protocol: row.protocol,
    requiredContext: row.requiredContext,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toEvent(row: typeof journeyEvents.$inferSelect) {
  return JourneyEvent.parse({
    id: row.id,
    journeyId: row.journeyId,
    externalEventId: row.externalEventId ?? undefined,
    runId: row.runId,
    stepId: row.stepId,
    agentId: row.agentId,
    kind: row.kind,
    fromStepId: row.fromStepId,
    toStepId: row.toStepId,
    ts: row.ts.toISOString(),
    durationMs: row.durationMs,
    costCents: row.costCents,
    success: row.success === null ? null : row.success === 1,
    metadata: row.metadata,
  });
}

async function loadJourneyDetail(journeyId: string) {
  const [journey] = await db
    .select()
    .from(journeys)
    .where(eq(journeys.id, journeyId));
  if (!journey) return null;

  const [team] = await db.select().from(teams).where(eq(teams.id, journey.teamId));
  if (!team) return null;
  const [purpose] = await db
    .select()
    .from(purposes)
    .where(eq(purposes.id, team.purposeId));
  if (!purpose) return null;

  const steps = await db
    .select()
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, journeyId))
    .orderBy(asc(journeySteps.sequence));
  const handoffs = await db
    .select()
    .from(journeyHandoffs)
    .where(eq(journeyHandoffs.journeyId, journeyId))
    .orderBy(asc(journeyHandoffs.createdAt));
  const allAgents = await db.select().from(agents);
  const agentsById = new Map(allAgents.map((agent) => [agent.id, agent]));
  const agentCount = new Set(steps.flatMap((step) => (step.agentId ? [step.agentId] : []))).size;

  return JourneyDetail.parse({
    ...toJourney(journey, steps.length, handoffs.length, agentCount),
    team: { id: team.id, name: team.name, slug: team.slug },
    purpose: { id: purpose.id, name: purpose.name, outcome: purpose.outcome },
    steps: steps.map((step) =>
      toStep(step, step.agentId ? agentsById.get(step.agentId) : null),
    ),
    handoffs: handoffs.map(toHandoff),
  });
}

async function journeyExists(journeyId: string) {
  const [journey] = await db
    .select({ id: journeys.id, teamId: journeys.teamId })
    .from(journeys)
    .where(eq(journeys.id, journeyId));
  return journey ?? null;
}

router.get("/journeys", requireAuth, async (_req, res) => {
  const rows = await db.select().from(journeys).orderBy(desc(journeys.updatedAt));
  const steps = await db.select().from(journeySteps);
  const handoffs = await db.select().from(journeyHandoffs);

  const response = rows.map((journey) => {
    const journeyStepRows = steps.filter((step) => step.journeyId === journey.id);
    return toJourney(
      journey,
      journeyStepRows.length,
      handoffs.filter((handoff) => handoff.journeyId === journey.id).length,
      new Set(journeyStepRows.flatMap((step) => (step.agentId ? [step.agentId] : []))).size,
    );
  });
  res.json(ListJourneysResponse.parse(response));
});

router.post(
  "/journeys",
  requireAuth,
  requireMixedTeamManager,
  async (req, res) => {
    const body = CreateJourneyInput.parse(req.body);
    const [team] = await db.select().from(teams).where(eq(teams.id, body.teamId));
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    const slug =
      body.slug ?? (slugifyTeamName(body.name) || `journey-${Date.now()}`);
    try {
      const [created] = await db
        .insert(journeys)
        .values({ ...body, slug })
        .returning();
      res.status(201).json(toJourney(created!, 0, 0, 0));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Journey slug already exists" });
        return;
      }
      throw error;
    }
  },
);

router.get("/journeys/:journeyId", requireAuth, async (req, res) => {
  const { journeyId } = JourneyIdParams.parse(req.params);
  const journey = await loadJourneyDetail(journeyId);
  if (!journey) {
    res.status(404).json({ error: "Journey not found" });
    return;
  }
  res.json(journey);
});

router.patch(
  "/journeys/:journeyId",
  requireAuth,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId } = JourneyIdParams.parse(req.params);
    const body = UpdateJourneyInput.parse(req.body);
    const [updated] = await db
      .update(journeys)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(journeys.id, journeyId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Journey not found" });
      return;
    }
    const detail = await loadJourneyDetail(journeyId);
    res.json(detail);
  },
);

router.delete(
  "/journeys/:journeyId",
  requireAuth,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId } = JourneyIdParams.parse(req.params);
    const deleted = await db
      .delete(journeys)
      .where(eq(journeys.id, journeyId))
      .returning({ id: journeys.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Journey not found" });
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/journeys/:journeyId/steps",
  requireAuth,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId } = JourneyIdParams.parse(req.params);
    const body = JourneyStepInput.parse(req.body);
    const journey = await journeyExists(journeyId);
    if (!journey) {
      res.status(404).json({ error: "Journey not found" });
      return;
    }

    let assignedAgent: typeof agents.$inferSelect | null = null;
    if (body.agentId) {
      const [assignment] = await db
        .select()
        .from(teamAgentAssignments)
        .where(
          and(
            eq(teamAgentAssignments.teamId, journey.teamId),
            eq(teamAgentAssignments.agentId, body.agentId),
            eq(teamAgentAssignments.status, "active"),
          ),
        );
      if (!assignment) {
        res.status(409).json({
          error: "Agent must have an active assignment in the journey team",
        });
        return;
      }
      const [agent] = await db.select().from(agents).where(eq(agents.id, body.agentId));
      assignedAgent = agent ?? null;
    }

    try {
      const [created] = await db
        .insert(journeySteps)
        .values({
          ...body,
          journeyId,
          agentId: body.agentId ?? null,
          required: body.required ? 1 : 0,
        })
        .returning();
      await db.update(journeys).set({ updatedAt: new Date() }).where(eq(journeys.id, journeyId));
      res.status(201).json(toStep(created!, assignedAgent));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Step key already exists in this journey" });
        return;
      }
      throw error;
    }
  },
);

router.delete(
  "/journeys/:journeyId/steps/:stepId",
  requireAuth,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId, stepId } = JourneyStepParams.parse(req.params);
    const deleted = await db
      .delete(journeySteps)
      .where(and(eq(journeySteps.id, stepId), eq(journeySteps.journeyId, journeyId)))
      .returning({ id: journeySteps.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Journey step not found" });
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/journeys/:journeyId/handoffs",
  requireAuth,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId } = JourneyIdParams.parse(req.params);
    const body = JourneyHandoffInput.parse(req.body);
    if (body.fromStepId === body.toStepId) {
      res.status(400).json({ error: "A handoff must connect two different steps" });
      return;
    }
    const connectedSteps = await db
      .select({ id: journeySteps.id })
      .from(journeySteps)
      .where(eq(journeySteps.journeyId, journeyId));
    const ids = new Set(connectedSteps.map((step) => step.id));
    if (!ids.has(body.fromStepId) || !ids.has(body.toStepId)) {
      res.status(409).json({ error: "Both handoff steps must belong to the journey" });
      return;
    }

    try {
      const [created] = await db
        .insert(journeyHandoffs)
        .values({ ...body, journeyId })
        .returning();
      await db.update(journeys).set({ updatedAt: new Date() }).where(eq(journeys.id, journeyId));
      res.status(201).json(toHandoff(created!));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Handoff already exists" });
        return;
      }
      throw error;
    }
  },
);

router.delete(
  "/journeys/:journeyId/handoffs/:handoffId",
  requireAuth,
  requireMixedTeamManager,
  async (req, res) => {
    const { journeyId, handoffId } = JourneyHandoffParams.parse(req.params);
    const deleted = await db
      .delete(journeyHandoffs)
      .where(
        and(
          eq(journeyHandoffs.id, handoffId),
          eq(journeyHandoffs.journeyId, journeyId),
        ),
      )
      .returning({ id: journeyHandoffs.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Journey handoff not found" });
      return;
    }
    res.status(204).end();
  },
);

router.post("/journeys/:journeyId/events", requireAuth, async (req, res) => {
  const { journeyId } = JourneyIdParams.parse(req.params);
  const body = JourneyEventInput.parse(req.body);
  if (!(await journeyExists(journeyId))) {
    res.status(404).json({ error: "Journey not found" });
    return;
  }

  if (body.externalEventId) {
    const [existing] = await db
      .select()
      .from(journeyEvents)
      .where(
        and(
          eq(journeyEvents.journeyId, journeyId),
          eq(journeyEvents.externalEventId, body.externalEventId),
        ),
      );
    if (existing) {
      res.status(200).json(toEvent(existing));
      return;
    }
  }

  const steps = await db
    .select({ id: journeySteps.id, agentId: journeySteps.agentId })
    .from(journeySteps)
    .where(eq(journeySteps.journeyId, journeyId));
  const stepIds = new Set(steps.map((step) => step.id));
  for (const reference of [body.stepId, body.fromStepId, body.toStepId]) {
    if (reference && !stepIds.has(reference)) {
      res.status(409).json({ error: "Referenced step does not belong to the journey" });
      return;
    }
  }
  if (body.stepId && body.agentId) {
    const referencedStep = steps.find((step) => step.id === body.stepId);
    if (referencedStep?.agentId && referencedStep.agentId !== body.agentId) {
      res.status(409).json({ error: "Event agent does not own the referenced step" });
      return;
    }
  }
  if (body.agentId) {
    const participantIds = new Set(
      steps.flatMap((step) => (step.agentId ? [step.agentId] : [])),
    );
    if (!participantIds.has(body.agentId)) {
      res.status(409).json({ error: "Event agent does not participate in the journey" });
      return;
    }
  }

  try {
    const [created] = await db
      .insert(journeyEvents)
      .values({
        ...body,
        journeyId,
        stepId: body.stepId ?? null,
        agentId: body.agentId ?? null,
        fromStepId: body.fromStepId ?? null,
        toStepId: body.toStepId ?? null,
        ts: body.ts ? new Date(body.ts) : new Date(),
        durationMs: body.durationMs ?? null,
        costCents: body.costCents ?? null,
        success: body.success == null ? null : body.success ? 1 : 0,
        metadata: body.metadata ?? null,
      })
      .returning();
    res.status(202).json(toEvent(created!));
  } catch (error) {
    if (isUniqueViolation(error) && body.externalEventId) {
      const [existing] = await db
        .select()
        .from(journeyEvents)
        .where(
          and(
            eq(journeyEvents.journeyId, journeyId),
            eq(journeyEvents.externalEventId, body.externalEventId),
          ),
        );
      if (existing) {
        res.status(200).json(toEvent(existing));
        return;
      }
    }
    throw error;
  }
});

router.get("/journeys/:journeyId/monitoring", requireAuth, async (req, res) => {
  const { journeyId } = JourneyIdParams.parse(req.params);
  const detail = await loadJourneyDetail(journeyId);
  if (!detail) {
    res.status(404).json({ error: "Journey not found" });
    return;
  }
  const events = await db
    .select()
    .from(journeyEvents)
    .where(eq(journeyEvents.journeyId, journeyId))
    .orderBy(asc(journeyEvents.ts));

  const monitoring = summarizeJourneyMonitoring({
    journeyId,
    steps: detail.steps.map((step) => ({
      id: step.id,
      name: step.name,
      agentId: step.agentId ?? null,
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
  const detailStepsById = new Map(detail.steps.map((step) => [step.id, step]));

  res.json(JourneyMonitoring.parse({
    ...monitoring,
    steps: monitoring.steps.map((step) => ({
      ...step,
      stepId: step.id,
      stepName: step.name,
      agentName: detailStepsById.get(step.id)?.agent?.name ?? null,
    })),
    recentRuns: monitoring.recentRuns.map((run) => ({
      ...run,
      completedAt: run.endedAt,
      totalCostCents: run.costCents,
    })),
  }));
});

export default router;
