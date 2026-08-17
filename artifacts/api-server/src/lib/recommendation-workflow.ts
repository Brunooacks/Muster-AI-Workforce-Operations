export type RecommendationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executing"
  | "blocked"
  | "completed";

export type ActionStatus =
  | "proposed"
  | "ready"
  | "in-progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type Decision = "approved" | "rejected";

export type RejectionDisposition = "revise" | "close" | "escalate";

export type ActorType = "muster" | "agent" | "human";

export type ExecutionMode = "autonomous" | "supervised" | "human-only";

export type ControlScope =
  | "muster-internal"
  | "external-agent"
  | "human-decision";

export interface Recommendation {
  id: string;
  status: RecommendationStatus;
  slaMinutes: number;
  decision?: Decision | null;
  decidedBy?: string | null;
  reason?: string | null;
  rejectionDisposition?: RejectionDisposition | null;
  decidedAt?: Date | null;
  nextReviewAt?: Date | null;
  completedAt?: Date | null;
  updatedAt?: Date | null;
}

export interface RecommendationAction {
  id: string;
  status: ActionStatus;
  actorType: ActorType;
  executionMode: ExecutionMode;
  controlScope: ControlScope;
  capability: string;
  result?: unknown;
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  updatedAt?: Date | null;
}

export interface DecideRecommendationInput {
  recommendation: Recommendation;
  actions: RecommendationAction[];
  decision: Decision;
  decidedBy: string;
  reason: string;
  rejectionDisposition?: RejectionDisposition;
  now: Date;
}

export interface RecommendationWorkflowResult {
  recommendation: Recommendation;
  actions: RecommendationAction[];
  nextReviewAt: Date | null;
}

export interface TransitionRecommendationActionInput {
  recommendation: Recommendation;
  actions: RecommendationAction[];
  actionId: string;
  status: ActionStatus;
  result?: unknown;
  now: Date;
}

export type SlaStatus =
  | "on-track"
  | "due-soon"
  | "overdue"
  | "completed"
  | "cancelled";

const actionTransitions: Record<ActionStatus, ReadonlySet<ActionStatus>> = {
  proposed: new Set(["ready", "cancelled"]),
  ready: new Set(["in-progress", "blocked", "completed", "cancelled"]),
  "in-progress": new Set(["blocked", "completed", "cancelled"]),
  blocked: new Set(["ready", "in-progress", "completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${field} must be a valid Date`);
  }
}

function assertDecisionMetadata(decidedBy: string, reason: string): void {
  if (decidedBy.trim().length === 0) {
    throw new Error("decidedBy is required");
  }
  if (reason.trim().length === 0) {
    throw new Error("reason is required");
  }
}

function reviewDate(now: Date, slaMinutes: number): Date {
  if (!Number.isFinite(slaMinutes) || slaMinutes < 0) {
    throw new Error("recommendation.slaMinutes must be non-negative");
  }
  return new Date(now.getTime() + slaMinutes * 60_000);
}

function isAutomaticReevaluation(action: RecommendationAction): boolean {
  return (
    action.status === "proposed" &&
    action.controlScope === "muster-internal" &&
    action.executionMode === "autonomous" &&
    action.capability === "schedule-reevaluation"
  );
}

function statusTimestamps(
  action: RecommendationAction,
  status: ActionStatus,
  now: Date,
): Pick<
  RecommendationAction,
  "startedAt" | "completedAt" | "cancelledAt" | "updatedAt"
> {
  return {
    startedAt:
      status === "in-progress" && !action.startedAt ? now : action.startedAt,
    completedAt: status === "completed" ? now : action.completedAt,
    cancelledAt: status === "cancelled" ? now : action.cancelledAt,
    updatedAt: now,
  };
}

function recommendationStatus(actions: RecommendationAction[]): RecommendationStatus {
  if (actions.length > 0 && actions.every((action) => action.status === "completed")) {
    return "completed";
  }
  if (actions.some((action) => action.status === "blocked")) {
    return "blocked";
  }
  if (
    actions.some(
      (action) =>
        action.status === "in-progress" || action.status === "completed",
    )
  ) {
    return "executing";
  }
  return "approved";
}

export function decideRecommendation({
  recommendation,
  actions,
  decision,
  decidedBy,
  reason,
  rejectionDisposition,
  now,
}: DecideRecommendationInput): RecommendationWorkflowResult {
  if (recommendation.status !== "pending") {
    throw new Error("only pending recommendations can be decided");
  }
  assertValidDate(now, "now");
  assertDecisionMetadata(decidedBy, reason);

  if (decision === "rejected") {
    if (!rejectionDisposition) {
      throw new Error("rejectionDisposition is required for rejection");
    }

    return {
      recommendation: {
        ...recommendation,
        status: "rejected",
        decision,
        decidedBy,
        reason,
        rejectionDisposition,
        decidedAt: now,
        nextReviewAt: null,
        updatedAt: now,
      },
      actions: actions.map((action) => ({
        ...action,
        status: "cancelled",
        ...statusTimestamps(action, "cancelled", now),
      })),
      nextReviewAt: null,
    };
  }

  if (rejectionDisposition) {
    throw new Error("rejectionDisposition is only valid for rejection");
  }

  const hasAutomaticReevaluation = actions.some(isAutomaticReevaluation);
  const nextReviewAt = hasAutomaticReevaluation
    ? reviewDate(now, recommendation.slaMinutes)
    : null;
  const approvedActions = actions.map((action): RecommendationAction => {
    if (isAutomaticReevaluation(action)) {
      return {
        ...action,
        status: "completed",
        result: {
          scheduled: true,
          nextReviewAt: nextReviewAt?.toISOString(),
        },
        ...statusTimestamps(action, "completed", now),
      };
    }

    if (action.status !== "proposed") return { ...action };
    return {
      ...action,
      status: "ready",
      updatedAt: now,
    };
  });

  return {
    recommendation: {
      ...recommendation,
      status: "approved",
      decision,
      decidedBy,
      reason,
      rejectionDisposition: null,
      decidedAt: now,
      nextReviewAt,
      updatedAt: now,
    },
    actions: approvedActions,
    nextReviewAt,
  };
}

export function transitionRecommendationAction({
  recommendation,
  actions,
  actionId,
  status,
  result,
  now,
}: TransitionRecommendationActionInput): RecommendationWorkflowResult {
  assertValidDate(now, "now");
  if (
    recommendation.status === "pending" ||
    recommendation.status === "rejected" ||
    recommendation.status === "completed"
  ) {
    throw new Error(
      `actions cannot transition while recommendation is ${recommendation.status}`,
    );
  }

  const actionIndex = actions.findIndex((action) => action.id === actionId);
  if (actionIndex < 0) {
    throw new Error(`action ${actionId} was not found`);
  }

  const action = actions[actionIndex]!;
  if (action.status === status) {
    throw new Error(`action is already ${status}`);
  }
  if (!actionTransitions[action.status].has(status)) {
    throw new Error(`invalid action transition: ${action.status} -> ${status}`);
  }

  const nextActions = actions.map((candidate, index) => {
    if (index !== actionIndex) return { ...candidate };
    return {
      ...candidate,
      status,
      ...(result !== undefined ? { result } : {}),
      ...statusTimestamps(candidate, status, now),
    };
  });
  const statusAfterTransition = recommendationStatus(nextActions);

  return {
    recommendation: {
      ...recommendation,
      status: statusAfterTransition,
      completedAt: statusAfterTransition === "completed" ? now : null,
      updatedAt: now,
    },
    actions: nextActions,
    nextReviewAt: recommendation.nextReviewAt ?? null,
  };
}

export function slaStatus(
  dueAt: Date | string | number | null | undefined,
  status: RecommendationStatus | ActionStatus,
  now: Date,
): SlaStatus {
  assertValidDate(now, "now");
  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "rejected") return "cancelled";
  if (dueAt === null || dueAt === undefined) return "on-track";

  const dueDate = dueAt instanceof Date ? dueAt : new Date(dueAt);
  assertValidDate(dueDate, "dueAt");
  const remainingMs = dueDate.getTime() - now.getTime();
  if (remainingMs <= 0) return "overdue";
  if (remainingMs <= 60 * 60_000) return "due-soon";
  return "on-track";
}
