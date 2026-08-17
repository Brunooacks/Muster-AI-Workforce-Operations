import { describe, expect, it } from "vitest";
import {
  decideRecommendation,
  slaStatus,
  transitionRecommendationAction,
  type Recommendation,
  type RecommendationAction,
} from "./recommendation-workflow";

const now = new Date("2026-08-14T15:00:00.000Z");

function recommendation(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    id: "recommendation-1",
    status: "pending",
    slaMinutes: 120,
    ...overrides,
  };
}

function action(
  overrides: Partial<RecommendationAction> = {},
): RecommendationAction {
  return {
    id: "action-1",
    status: "proposed",
    actorType: "agent",
    executionMode: "supervised",
    controlScope: "external-agent",
    capability: "resolve-ticket",
    ...overrides,
  };
}

describe("decideRecommendation", () => {
  it("approves a pending recommendation and readies proposed actions", () => {
    const inputRecommendation = recommendation();
    const inputActions = [action(), action({ id: "action-2", actorType: "human" })];

    const result = decideRecommendation({
      recommendation: inputRecommendation,
      actions: inputActions,
      decision: "approved",
      decidedBy: "supervisor-1",
      reason: "Risco controlado",
      now,
    });

    expect(result.recommendation).toMatchObject({
      status: "approved",
      decision: "approved",
      decidedBy: "supervisor-1",
      reason: "Risco controlado",
      decidedAt: now,
      nextReviewAt: null,
    });
    expect(result.actions.map(({ status }) => status)).toEqual(["ready", "ready"]);
    expect(result.nextReviewAt).toBeNull();
    expect(inputRecommendation.status).toBe("pending");
    expect(inputActions[0]?.status).toBe("proposed");
  });

  it("automatically schedules an internal autonomous reevaluation", () => {
    const result = decideRecommendation({
      recommendation: recommendation({ slaMinutes: 90 }),
      actions: [
        action({
          actorType: "muster",
          executionMode: "autonomous",
          controlScope: "muster-internal",
          capability: "schedule-reevaluation",
        }),
        action({ id: "action-2" }),
      ],
      decision: "approved",
      decidedBy: "human-1",
      reason: "Executar e revisar",
      now,
    });

    const nextReviewAt = new Date("2026-08-14T16:30:00.000Z");
    expect(result.nextReviewAt).toEqual(nextReviewAt);
    expect(result.recommendation.nextReviewAt).toEqual(nextReviewAt);
    expect(result.actions[0]).toMatchObject({
      status: "completed",
      completedAt: now,
      result: {
        scheduled: true,
        nextReviewAt: nextReviewAt.toISOString(),
      },
    });
    expect(result.actions[1]?.status).toBe("ready");
  });

  it("does not auto-complete a reevaluation without all control attributes", () => {
    const result = decideRecommendation({
      recommendation: recommendation(),
      actions: [
        action({
          actorType: "muster",
          executionMode: "supervised",
          controlScope: "muster-internal",
          capability: "schedule-reevaluation",
        }),
      ],
      decision: "approved",
      decidedBy: "human-1",
      reason: "Requer supervisão",
      now,
    });

    expect(result.actions[0]?.status).toBe("ready");
    expect(result.nextReviewAt).toBeNull();
  });

  it("rejects and cancels every action with a required disposition", () => {
    const result = decideRecommendation({
      recommendation: recommendation(),
      actions: [action(), action({ id: "action-2", status: "ready" })],
      decision: "rejected",
      rejectionDisposition: "revise",
      decidedBy: "human-1",
      reason: "Evidência insuficiente",
      now,
    });

    expect(result.recommendation).toMatchObject({
      status: "rejected",
      decision: "rejected",
      rejectionDisposition: "revise",
      nextReviewAt: null,
    });
    expect(result.actions.map(({ status }) => status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
    expect(result.actions.every(({ cancelledAt }) => cancelledAt === now)).toBe(true);
  });

  it("requires a pending recommendation", () => {
    expect(() =>
      decideRecommendation({
        recommendation: recommendation({ status: "approved" }),
        actions: [],
        decision: "approved",
        decidedBy: "human-1",
        reason: "Duplicada",
        now,
      }),
    ).toThrow("only pending recommendations can be decided");
  });

  it("requires rejection disposition and decision metadata", () => {
    expect(() =>
      decideRecommendation({
        recommendation: recommendation(),
        actions: [],
        decision: "rejected",
        decidedBy: "human-1",
        reason: "Recusada",
        now,
      }),
    ).toThrow("rejectionDisposition is required");

    expect(() =>
      decideRecommendation({
        recommendation: recommendation(),
        actions: [],
        decision: "approved",
        decidedBy: " ",
        reason: "Aceita",
        now,
      }),
    ).toThrow("decidedBy is required");
  });

  it("rejects disposition on approval and invalid SLA for auto scheduling", () => {
    expect(() =>
      decideRecommendation({
        recommendation: recommendation(),
        actions: [],
        decision: "approved",
        rejectionDisposition: "close",
        decidedBy: "human-1",
        reason: "Aceita",
        now,
      }),
    ).toThrow("only valid for rejection");

    expect(() =>
      decideRecommendation({
        recommendation: recommendation({ slaMinutes: -1 }),
        actions: [
          action({
            controlScope: "muster-internal",
            executionMode: "autonomous",
            capability: "schedule-reevaluation",
          }),
        ],
        decision: "approved",
        decidedBy: "human-1",
        reason: "Aceita",
        now,
      }),
    ).toThrow("slaMinutes must be non-negative");
  });
});

describe("transitionRecommendationAction", () => {
  const approved = recommendation({
    status: "approved",
    decision: "approved",
    nextReviewAt: new Date("2026-08-14T17:00:00.000Z"),
  });

  it("moves a ready action into execution and records its start", () => {
    const result = transitionRecommendationAction({
      recommendation: approved,
      actions: [action({ status: "ready" })],
      actionId: "action-1",
      status: "in-progress",
      now,
    });

    expect(result.recommendation.status).toBe("executing");
    expect(result.actions[0]).toMatchObject({
      status: "in-progress",
      startedAt: now,
      updatedAt: now,
    });
    expect(result.nextReviewAt).toEqual(approved.nextReviewAt);
  });

  it("marks the recommendation blocked when any action blocks", () => {
    const result = transitionRecommendationAction({
      recommendation: recommendation({ status: "executing" }),
      actions: [
        action({ status: "completed" }),
        action({ id: "action-2", status: "in-progress" }),
      ],
      actionId: "action-2",
      status: "blocked",
      result: { blocker: "approval-required" },
      now,
    });

    expect(result.recommendation.status).toBe("blocked");
    expect(result.actions[1]).toMatchObject({
      status: "blocked",
      result: { blocker: "approval-required" },
    });
  });

  it("returns to approved after the only blocked action becomes ready", () => {
    const result = transitionRecommendationAction({
      recommendation: recommendation({ status: "blocked" }),
      actions: [action({ status: "blocked" })],
      actionId: "action-1",
      status: "ready",
      now,
    });

    expect(result.recommendation.status).toBe("approved");
    expect(result.actions[0]?.status).toBe("ready");
  });

  it("stays executing when one action completes and another remains ready", () => {
    const result = transitionRecommendationAction({
      recommendation: recommendation({ status: "executing" }),
      actions: [
        action({ status: "in-progress" }),
        action({ id: "action-2", status: "ready" }),
      ],
      actionId: "action-1",
      status: "completed",
      result: { ticketId: "T-42" },
      now,
    });

    expect(result.recommendation.status).toBe("executing");
    expect(result.actions[0]).toMatchObject({
      status: "completed",
      completedAt: now,
      result: { ticketId: "T-42" },
    });
  });

  it("completes the recommendation when every action is completed", () => {
    const result = transitionRecommendationAction({
      recommendation: recommendation({ status: "executing" }),
      actions: [
        action({ status: "completed" }),
        action({ id: "action-2", status: "in-progress" }),
      ],
      actionId: "action-2",
      status: "completed",
      now,
    });

    expect(result.recommendation).toMatchObject({
      status: "completed",
      completedAt: now,
    });
  });

  it("validates action existence and the transition graph", () => {
    expect(() =>
      transitionRecommendationAction({
        recommendation: approved,
        actions: [action({ status: "ready" })],
        actionId: "missing",
        status: "in-progress",
        now,
      }),
    ).toThrow("was not found");

    expect(() =>
      transitionRecommendationAction({
        recommendation: approved,
        actions: [action({ status: "ready" })],
        actionId: "action-1",
        status: "proposed",
        now,
      }),
    ).toThrow("invalid action transition: ready -> proposed");

    expect(() =>
      transitionRecommendationAction({
        recommendation: approved,
        actions: [action({ status: "completed" })],
        actionId: "action-1",
        status: "ready",
        now,
      }),
    ).toThrow("invalid action transition: completed -> ready");
  });

  it("forbids transitions before decision and after terminal decisions", () => {
    for (const status of ["pending", "rejected", "completed"] as const) {
      expect(() =>
        transitionRecommendationAction({
          recommendation: recommendation({ status }),
          actions: [action({ status: "ready" })],
          actionId: "action-1",
          status: "in-progress",
          now,
        }),
      ).toThrow(`recommendation is ${status}`);
    }
  });
});

describe("slaStatus", () => {
  it("returns terminal statuses before evaluating the deadline", () => {
    expect(slaStatus(new Date("2026-08-14T14:00:00Z"), "completed", now)).toBe(
      "completed",
    );
    expect(slaStatus(new Date("2026-08-14T14:00:00Z"), "cancelled", now)).toBe(
      "cancelled",
    );
    expect(slaStatus(new Date("2026-08-14T14:00:00Z"), "rejected", now)).toBe(
      "cancelled",
    );
  });

  it("classifies overdue, due-soon and on-track deadlines", () => {
    expect(slaStatus(new Date("2026-08-14T15:00:00Z"), "ready", now)).toBe(
      "overdue",
    );
    expect(slaStatus(new Date("2026-08-14T16:00:00Z"), "ready", now)).toBe(
      "due-soon",
    );
    expect(slaStatus(new Date("2026-08-14T16:00:00.001Z"), "ready", now)).toBe(
      "on-track",
    );
  });

  it("accepts serializable dates and treats missing deadlines as on-track", () => {
    expect(slaStatus("2026-08-14T15:30:00Z", "in-progress", now)).toBe(
      "due-soon",
    );
    expect(slaStatus(undefined, "approved", now)).toBe("on-track");
  });

  it("rejects invalid dates", () => {
    expect(() => slaStatus("invalid", "ready", now)).toThrow(
      "dueAt must be a valid Date",
    );
    expect(() => slaStatus(now, "ready", new Date("invalid"))).toThrow(
      "now must be a valid Date",
    );
  });
});
