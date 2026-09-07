import { and, desc, eq, or } from "drizzle-orm";
import {
  agents,
  db,
  professionalPlanDecisions,
  type ProfessionalPlanActionStatus,
  type ProfessionalPlanDecisionType,
} from "@workspace/db";
import {
  buildProfessionalPlanWorkflow,
  transitionProfessionalPlanAction,
} from "./professional-plan-policy";

export class ProfessionalPlanDecisionNotFoundError extends Error {}
export class ProfessionalPlanActionNotFoundError extends Error {}
export class ProfessionalPlanActionTransitionError extends Error {}

export type RecordProfessionalPlanDecisionInput = {
  orgId: string;
  userId: string;
  professionalRef: string;
  professionalName: string;
  recommendation: string;
  decision: ProfessionalPlanDecisionType;
  reason: string;
  owner: string;
  now?: Date;
};

export function toProfessionalPlanDecision(
  row: typeof professionalPlanDecisions.$inferSelect,
) {
  return {
    id: row.id,
    agentId: row.agentId ?? null,
    professionalRef: row.professionalRef,
    professionalName: row.professionalName,
    recommendation: row.recommendation,
    decision: row.decision,
    reason: row.reason,
    owner: row.owner,
    decidedBy: row.decidedBy,
    actions: row.actions,
    nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
    decidedAt: row.decidedAt.toISOString(),
  };
}

export async function listProfessionalPlanDecisions(input: {
  orgId: string;
  professionalRef: string;
}) {
  return db
    .select()
    .from(professionalPlanDecisions)
    .where(
      and(
        eq(professionalPlanDecisions.orgId, input.orgId),
        eq(professionalPlanDecisions.professionalRef, input.professionalRef),
      ),
    )
    .orderBy(desc(professionalPlanDecisions.decidedAt));
}

export async function recordProfessionalPlanDecision(
  input: RecordProfessionalPlanDecisionInput,
) {
  const now = input.now ?? new Date();
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(
      and(
        eq(agents.orgId, input.orgId),
        or(
          eq(agents.id, input.professionalRef),
          eq(agents.slug, input.professionalRef),
        ),
      ),
    )
    .limit(1);
  const workflow = buildProfessionalPlanWorkflow({
    decision: input.decision,
    professionalName: input.professionalName,
    owner: input.owner,
    now,
  });
  const [row] = await db
    .insert(professionalPlanDecisions)
    .values({
      orgId: input.orgId,
      agentId: agent?.id ?? null,
      professionalRef: input.professionalRef,
      professionalName: input.professionalName,
      recommendation: input.recommendation,
      decision: input.decision,
      reason: input.reason,
      owner: input.owner,
      decidedBy: input.userId,
      actions: workflow.actions,
      nextReviewAt: workflow.nextReviewAt,
      decidedAt: now,
    })
    .returning();
  return row!;
}

export async function updateProfessionalPlanAction(input: {
  orgId: string;
  userId: string;
  professionalRef: string;
  decisionId: string;
  sequence: number;
  status: ProfessionalPlanActionStatus;
  evidence?: string;
  now?: Date;
}) {
  const [decision] = await db
    .select()
    .from(professionalPlanDecisions)
    .where(
      and(
        eq(professionalPlanDecisions.id, input.decisionId),
        eq(professionalPlanDecisions.orgId, input.orgId),
        eq(professionalPlanDecisions.professionalRef, input.professionalRef),
      ),
    )
    .limit(1);

  if (!decision) throw new ProfessionalPlanDecisionNotFoundError();

  const actionIndex = decision.actions.findIndex(
    (action) => action.sequence === input.sequence,
  );
  if (actionIndex < 0) throw new ProfessionalPlanActionNotFoundError();

  if (input.status === "in_progress") {
    const unfinishedPreviousAction = decision.actions.find(
      (action) =>
        action.sequence < input.sequence && action.status !== "completed",
    );
    if (unfinishedPreviousAction) {
      throw new ProfessionalPlanActionTransitionError(
        `Conclua primeiro: ${unfinishedPreviousAction.title}.`,
      );
    }
  }

  let updatedAction;
  try {
    updatedAction = transitionProfessionalPlanAction({
      action: decision.actions[actionIndex]!,
      status: input.status,
      evidence: input.evidence,
      updatedBy: input.userId,
      now: input.now ?? new Date(),
    });
  } catch (error) {
    throw new ProfessionalPlanActionTransitionError(
      error instanceof Error ? error.message : "Transição de ação inválida.",
    );
  }

  const actions = decision.actions.map((action, index) => {
    if (index === actionIndex) return updatedAction;
    if (
      input.status === "cancelled" &&
      action.sequence > input.sequence &&
      !["completed", "cancelled"].includes(action.status)
    ) {
      return {
        ...action,
        status: "cancelled" as const,
        evidence: `Dependência anterior cancelada: ${updatedAction.title}.`,
        updatedBy: input.userId,
      };
    }
    return action;
  });
  const [updatedDecision] = await db
    .update(professionalPlanDecisions)
    .set({ actions })
    .where(
      and(
        eq(professionalPlanDecisions.id, input.decisionId),
        eq(professionalPlanDecisions.orgId, input.orgId),
      ),
    )
    .returning();

  return updatedDecision!;
}
