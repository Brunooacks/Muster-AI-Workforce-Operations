import { z } from "zod";

export const JourneyStatus = z.enum(["draft", "active", "paused", "archived"]);
export const JourneyStepType = z.enum(["agent", "human", "system"]);
export const JourneyDecisionMode = z.enum([
  "autonomous",
  "human-approval",
  "committee",
]);
export const JourneyHandoffStatus = z.enum(["active", "paused"]);
export const JourneyEventKind = z.enum([
  "journey_started",
  "step_started",
  "step_completed",
  "step_failed",
  "handoff",
  "decision",
  "journey_completed",
  "journey_failed",
]);
export const JourneyRecommendationStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "executing",
  "blocked",
  "completed",
]);
export const JourneyRecommendationRisk = z.enum(["low", "medium", "high", "critical"]);
export const JourneyRecommendationSource = z.enum(["system", "agent", "human"]);
export const JourneyRejectionDisposition = z.enum(["revise", "close", "escalate"]);
export const JourneyActionActorType = z.enum(["muster", "agent", "human"]);
export const JourneyActionExecutionMode = z.enum([
  "autonomous",
  "supervised",
  "human-only",
]);
export const JourneyActionControlScope = z.enum([
  "muster-internal",
  "external-agent",
  "human-decision",
]);
export const JourneyActionStatus = z.enum([
  "proposed",
  "ready",
  "in-progress",
  "blocked",
  "completed",
  "cancelled",
]);

export const CreateJourneyInput = z.object({
  teamId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(1000).default(""),
  entryCriterion: z.string().trim().max(1000).default(""),
  successCriterion: z.string().trim().max(1000).default(""),
  status: JourneyStatus.default("draft"),
  slaMinutes: z.number().int().positive().max(525600).default(60),
  owner: z.string().trim().max(160).default(""),
});

export const UpdateJourneyInput = CreateJourneyInput.omit({ teamId: true, slug: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const Journey = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  entryCriterion: z.string(),
  successCriterion: z.string(),
  status: JourneyStatus,
  slaMinutes: z.number().int(),
  owner: z.string(),
  stepCount: z.number().int().nonnegative(),
  handoffCount: z.number().int().nonnegative(),
  agentCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const JourneyStepInput = z.object({
  stepKey: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(160),
  sequence: z.number().int().nonnegative(),
  stepType: JourneyStepType.default("agent"),
  agentId: z.string().min(1).nullish(),
  responsibility: z.string().trim().max(1000).default(""),
  decisionMode: JourneyDecisionMode.default("autonomous"),
  expectedDurationMs: z.number().int().positive().nullish(),
  required: z.boolean().default(true),
  guardrails: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
}).superRefine((value, context) => {
  if (value.stepType === "agent" && !value.agentId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["agentId"],
      message: "Agent steps require an agentId",
    });
  }
});

export const JourneyStep = JourneyStepInput.innerType().extend({
  id: z.string(),
  journeyId: z.string(),
  agent: z
    .object({
      id: z.string(),
      name: z.string(),
      platform: z.string(),
      role: z.string(),
      status: z.string(),
      healthScore: z.number(),
      currentVerdict: z.string(),
    })
    .nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const JourneyHandoffInput = z.object({
  fromStepId: z.string().min(1),
  toStepId: z.string().min(1),
  condition: z.string().trim().min(1).max(500).default("success"),
  protocol: z.string().trim().min(1).max(80).default("a2a"),
  requiredContext: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
});

export const JourneyHandoff = JourneyHandoffInput.extend({
  id: z.string(),
  journeyId: z.string(),
  status: JourneyHandoffStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const JourneyEventInput = z.object({
  externalEventId: z.string().trim().min(1).max(240).optional(),
  runId: z.string().trim().min(1).max(240),
  stepId: z.string().min(1).nullish(),
  agentId: z.string().min(1).nullish(),
  kind: JourneyEventKind,
  fromStepId: z.string().min(1).nullish(),
  toStepId: z.string().min(1).nullish(),
  ts: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().nullish(),
  costCents: z.number().int().nonnegative().nullish(),
  success: z.boolean().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const JourneyEvent = JourneyEventInput.extend({
  id: z.string(),
  journeyId: z.string(),
  ts: z.string(),
});

export const JourneyDetail = Journey.extend({
  team: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  purpose: z.object({ id: z.string(), name: z.string(), outcome: z.string() }),
  steps: z.array(JourneyStep),
  handoffs: z.array(JourneyHandoff),
});

export const JourneyStepMonitoring = z.object({
  stepId: z.string(),
  stepName: z.string().nullable(),
  agentId: z.string().nullable(),
  agentName: z.string().nullable(),
  sequence: z.number().int().nullable(),
  executions: z.number().int().nonnegative(),
  completedExecutions: z.number().int().nonnegative(),
  failedExecutions: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1).nullable(),
  avgDurationMs: z.number().nonnegative().nullable(),
  p95DurationMs: z.number().nonnegative().nullable(),
  totalCostCents: z.number().nonnegative(),
  avgCostCentsPerExecution: z.number().nonnegative().nullable(),
  judgedHandoffs: z.number().int().nonnegative(),
  handoffSuccessRate: z.number().min(0).max(1).nullable(),
  illusoryVictory: z.boolean(),
});

export const JourneyRunMonitoring = z.object({
  runId: z.string(),
  status: z.enum(["active", "completed", "failed"]),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastEventAt: z.string().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  totalCostCents: z.number().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  currentStepId: z.string().nullable(),
});

export const JourneyMonitoring = z.object({
  totalRuns: z.number().int().nonnegative(),
  activeRuns: z.number().int().nonnegative(),
  completedRuns: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(1),
  avgDurationMs: z.number().nonnegative().nullable(),
  p95DurationMs: z.number().nonnegative().nullable(),
  totalCostCents: z.number().nonnegative(),
  avgCostCentsPerRun: z.number().nonnegative().nullable(),
  handoffSuccessRate: z.number().min(0).max(1).nullable(),
  bottleneckStepId: z.string().nullable(),
  illusoryVictory: z.boolean(),
  warnings: z.array(z.string()),
  steps: z.array(JourneyStepMonitoring),
  recentRuns: z.array(JourneyRunMonitoring),
});

export const JourneyRecommendationActionInput = z.object({
  sequence: z.number().int().positive(),
  actorType: JourneyActionActorType,
  agentId: z.string().min(1).nullish(),
  title: z.string().trim().min(1).max(240),
  instructions: z.string().trim().max(2000).default(""),
  capability: z.string().trim().min(1).max(120),
  executionMode: JourneyActionExecutionMode,
  controlScope: JourneyActionControlScope,
  owner: z.string().trim().max(160).default(""),
  slaMinutes: z.number().int().positive().max(525600).default(60),
}).superRefine((value, context) => {
  if (value.actorType === "agent" && !value.agentId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["agentId"],
      message: "Agent actions require an agentId",
    });
  }
  if (value.actorType === "human" && value.controlScope !== "human-decision") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["controlScope"],
      message: "Human actions must use human-decision scope",
    });
  }
});

export const CreateJourneyRecommendationInput = z.object({
  runId: z.string().trim().min(1).max(240).nullish(),
  stepId: z.string().min(1).nullish(),
  agentId: z.string().min(1).nullish(),
  title: z.string().trim().min(1).max(240),
  rationale: z.string().trim().min(1).max(3000),
  expectedImpact: z.string().trim().max(2000).default(""),
  riskLevel: JourneyRecommendationRisk.default("medium"),
  source: JourneyRecommendationSource.default("human"),
  reviewSlaMinutes: z.number().int().positive().max(10080).default(240),
  actions: z.array(JourneyRecommendationActionInput).min(1).max(20),
});

export const JourneyRecommendationDecisionInput = z.object({
  decision: z.enum(["approved", "rejected"]),
  decidedBy: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(2000),
  rejectionDisposition: JourneyRejectionDisposition.optional(),
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.rejectionDisposition) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rejectionDisposition"],
      message: "Rejected recommendations require a disposition",
    });
  }
});

export const UpdateJourneyRecommendationActionInput = z.object({
  status: z.enum(["ready", "in-progress", "blocked", "completed"]),
  result: z.string().trim().max(3000).optional(),
});

export const JourneyRecommendationAction = JourneyRecommendationActionInput.innerType().extend({
  id: z.string(),
  recommendationId: z.string(),
  status: JourneyActionStatus,
  agentName: z.string().nullable(),
  dueAt: z.string().nullable(),
  result: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  slaStatus: z.enum(["on-track", "due-soon", "overdue", "completed", "cancelled"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const JourneyRecommendation = z.object({
  id: z.string(),
  journeyId: z.string(),
  runId: z.string().nullable(),
  stepId: z.string().nullable(),
  agentId: z.string().nullable(),
  title: z.string(),
  rationale: z.string(),
  expectedImpact: z.string(),
  riskLevel: JourneyRecommendationRisk,
  status: JourneyRecommendationStatus,
  source: JourneyRecommendationSource,
  reviewSlaMinutes: z.number().int(),
  reviewDueAt: z.string(),
  reviewSlaStatus: z.enum(["on-track", "due-soon", "overdue", "completed", "cancelled"]),
  decisionReason: z.string().nullable(),
  rejectionDisposition: JourneyRejectionDisposition.nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  nextReviewAt: z.string().nullable(),
  actions: z.array(JourneyRecommendationAction),
  autonomySummary: z.object({
    muster: z.number().int().nonnegative(),
    agent: z.number().int().nonnegative(),
    human: z.number().int().nonnegative(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const JourneyIdParams = z.object({ journeyId: z.string().min(1) });
export const JourneyStepParams = JourneyIdParams.extend({ stepId: z.string().min(1) });
export const JourneyHandoffParams = JourneyIdParams.extend({ handoffId: z.string().min(1) });
export const JourneyRecommendationParams = JourneyIdParams.extend({
  recommendationId: z.string().min(1),
});
export const JourneyRecommendationActionParams = JourneyRecommendationParams.extend({
  actionId: z.string().min(1),
});
export const ListJourneysResponse = z.array(Journey);
export const ListJourneyRecommendationsResponse = z.array(JourneyRecommendation);
