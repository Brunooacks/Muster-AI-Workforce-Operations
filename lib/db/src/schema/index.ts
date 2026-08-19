import { randomUUID } from "crypto";
import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

export type OrgMemberRole = "owner" | "admin" | "member";

// --- Tenancy (R7 · gauntlet rodada 4) -----------------------------------------
// Toda entidade-raiz pertence a uma organização. As entidades filhas derivam a
// organização pela chave estrangeira do pai, então existe um único lugar por
// domínio onde o escopo precisa ser aplicado — e um único lugar para auditar.
export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Identificador da organização no provedor de identidade (Clerk org_id),
  // quando a org nasce de um convite/SSO em vez de cadastro direto.
  externalId: text("external_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").$type<OrgMemberRole>().notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgMemberUnique: uniqueIndex("organization_members_org_user_idx").on(table.orgId, table.userId),
  orgMemberUserIdx: index("organization_members_user_idx").on(table.userId),
}));

export type AgentStatus =
  | "observation"
  | "active"
  | "flagged"
  | "retiring"
  | "retired";
export type VerdictType = "promote" | "mentor" | "retire" | "observation";
export type Severity = "critical" | "high" | "medium" | "stable";
export type AutonomyLevel = "autonomous" | "escalates" | "restricted";
export type DecisionStatus = "pending" | "approved" | "disagreed" | "exported";
export type PurposeRiskTier = "low" | "medium" | "high" | "critical";
export type TeamStatus = "active" | "archived";
export type TeamMemberRole = "owner" | "supervisor" | "operator" | "observer";
export type AgentAssignmentRole = "primary" | "supporting" | "reviewer";
export type AgentAssignmentStatus = "active" | "paused" | "ended";
export type JourneyStatus = "draft" | "active" | "paused" | "archived";
export type JourneyStepType = "agent" | "human" | "system";
export type JourneyDecisionMode =
  | "autonomous"
  | "human-approval"
  | "committee";
export type JourneyHandoffStatus = "active" | "paused";
export type JourneyEventKind =
  | "journey_started"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "handoff"
  | "decision"
  | "journey_completed"
  | "journey_failed";
export type JourneyRecommendationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executing"
  | "blocked"
  | "completed";
export type JourneyRecommendationRisk = "low" | "medium" | "high" | "critical";
export type JourneyRecommendationSource = "system" | "agent" | "human";
export type JourneyRejectionDisposition = "revise" | "close" | "escalate";
export type JourneyActionActorType = "muster" | "agent" | "human";
export type JourneyActionExecutionMode =
  | "autonomous"
  | "supervised"
  | "human-only";
export type JourneyActionControlScope =
  | "muster-internal"
  | "external-agent"
  | "human-decision";
export type JourneyActionStatus =
  | "proposed"
  | "ready"
  | "in-progress"
  | "blocked"
  | "completed"
  | "cancelled";
export type LayerKey =
  | "efficacy"
  | "efficiency"
  | "adoption"
  | "governance"
  | "value";

export interface KpiMetric {
  label: string;
  value: number;
  unit: string;
  trend: number;
  direction?: "up" | "down" | "flat";
  target?: string;
  rationale?: string;
}

export interface KpiLayer {
  key: LayerKey;
  label: string;
  score: number;
  severity: Severity;
  metrics: KpiMetric[];
}

export interface NextAction {
  action: string;
  owner: string;
  due: string;
}

export interface BusinessCase {
  baseline: string;
  targetPayback: string;
  actualPayback: string;
  description: string;
}

export const purposes = pgTable("purposes", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  domain: text("domain").notNull(),
  outcome: text("outcome").notNull(),
  riskTier: text("risk_tier").$type<PurposeRiskTier>().notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  purposesOrgKeyIdx: uniqueIndex("purposes_org_key_idx").on(table.orgId, table.key),
  purposesOrgIdx: index("purposes_org_idx").on(table.orgId),
}));

export const teams = pgTable("teams", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  purposeId: text("purpose_id").notNull().references(() => purposes.id, { onDelete: "restrict" }),
  status: text("status").$type<TeamStatus>().notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  teamsOrgSlugIdx: uniqueIndex("teams_org_slug_idx").on(table.orgId, table.slug),
  teamsOrgIdx: index("teams_org_idx").on(table.orgId),
}));

export const teamMemberships = pgTable("team_memberships", {
  id: id(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull(),
  memberName: text("member_name").notNull(),
  role: text("role").$type<TeamMemberRole>().notNull().default("operator"),
  decisionRights: jsonb("decision_rights").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  teamMemberUnique: uniqueIndex("team_memberships_team_member_idx").on(table.teamId, table.memberId),
}));

export const agents = pgTable("agents", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  role: text("role").notNull(),
  platform: text("platform").notNull(),
  version: text("version").notNull().default("1.0.0"),
  status: text("status").$type<AgentStatus>().notNull().default("observation"),
  avatarUrl: text("avatar_url"),
  bio: text("bio").notNull().default(""),
  tagline: text("tagline").notNull().default(""),
  monthlyVolume: integer("monthly_volume").notNull().default(0),
  headlineKpis: jsonb("headline_kpis")
    .$type<KpiMetric[]>()
    .notNull()
    .default([]),
  currentVerdict: text("current_verdict")
    .$type<VerdictType>()
    .notNull()
    .default("observation"),
  verdictConfidence: doublePrecision("verdict_confidence").notNull().default(0),
  severity: text("severity").$type<Severity>().notNull().default("stable"),
  healthScore: doublePrecision("health_score").notNull().default(0),
  activeAlerts: integer("active_alerts").notNull().default(0),
  monthlyValue: doublePrecision("monthly_value").notNull().default(0),
  monthlyCost: doublePrecision("monthly_cost").notNull().default(0),
  admittedAt: timestamp("admitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  agentsOrgSlugIdx: uniqueIndex("agents_org_slug_idx").on(table.orgId, table.slug),
  agentsOrgExternalIdx: uniqueIndex("agents_org_external_idx").on(table.orgId, table.externalId),
  agentsOrgIdx: index("agents_org_idx").on(table.orgId),
}));

export const teamAgentAssignments = pgTable("team_agent_assignments", {
  id: id(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  assignmentRole: text("assignment_role").$type<AgentAssignmentRole>().notNull().default("supporting"),
  responsibility: text("responsibility").notNull().default(""),
  status: text("status").$type<AgentAssignmentStatus>().notNull().default("active"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  teamAgentUnique: uniqueIndex("team_agent_assignments_team_agent_idx").on(table.teamId, table.agentId),
}));

export const journeys = pgTable("journeys", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  entryCriterion: text("entry_criterion").notNull().default(""),
  successCriterion: text("success_criterion").notNull().default(""),
  status: text("status").$type<JourneyStatus>().notNull().default("draft"),
  slaMinutes: integer("sla_minutes").notNull().default(60),
  owner: text("owner").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  journeysOrgIdx: index("journeys_org_idx").on(table.orgId),
  journeysTeamIdx: index("journeys_team_idx").on(table.teamId),
}));

export const journeySteps = pgTable("journey_steps", {
  id: id(),
  journeyId: text("journey_id")
    .notNull()
    .references(() => journeys.id, { onDelete: "cascade" }),
  stepKey: text("step_key").notNull(),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  stepType: text("step_type").$type<JourneyStepType>().notNull().default("agent"),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  responsibility: text("responsibility").notNull().default(""),
  decisionMode: text("decision_mode")
    .$type<JourneyDecisionMode>()
    .notNull()
    .default("autonomous"),
  expectedDurationMs: integer("expected_duration_ms"),
  required: integer("required").notNull().default(1),
  guardrails: jsonb("guardrails").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  journeyStepKeyUnique: uniqueIndex("journey_steps_journey_key_idx").on(
    table.journeyId,
    table.stepKey,
  ),
  journeyStepSequenceIdx: index("journey_steps_journey_sequence_idx").on(
    table.journeyId,
    table.sequence,
  ),
}));

export const journeyHandoffs = pgTable("journey_handoffs", {
  id: id(),
  journeyId: text("journey_id")
    .notNull()
    .references(() => journeys.id, { onDelete: "cascade" }),
  fromStepId: text("from_step_id")
    .notNull()
    .references(() => journeySteps.id, { onDelete: "cascade" }),
  toStepId: text("to_step_id")
    .notNull()
    .references(() => journeySteps.id, { onDelete: "cascade" }),
  condition: text("condition").notNull().default("success"),
  protocol: text("protocol").notNull().default("a2a"),
  requiredContext: jsonb("required_context").$type<string[]>().notNull().default([]),
  status: text("status").$type<JourneyHandoffStatus>().notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  journeyHandoffUnique: uniqueIndex("journey_handoffs_path_idx").on(
    table.journeyId,
    table.fromStepId,
    table.toStepId,
  ),
}));

export const journeyEvents = pgTable("journey_events", {
  id: id(),
  journeyId: text("journey_id")
    .notNull()
    .references(() => journeys.id, { onDelete: "cascade" }),
  externalEventId: text("external_event_id"),
  runId: text("run_id").notNull(),
  stepId: text("step_id").references(() => journeySteps.id, { onDelete: "set null" }),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  kind: text("kind").$type<JourneyEventKind>().notNull(),
  fromStepId: text("from_step_id").references(() => journeySteps.id, { onDelete: "set null" }),
  toStepId: text("to_step_id").references(() => journeySteps.id, { onDelete: "set null" }),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  durationMs: integer("duration_ms"),
  costCents: integer("cost_cents"),
  success: integer("success"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
}, (table) => ({
  journeyEventExternalUnique: uniqueIndex("journey_events_external_idx").on(
    table.journeyId,
    table.externalEventId,
  ),
  journeyEventTimelineIdx: index("journey_events_timeline_idx").on(
    table.journeyId,
    table.ts,
  ),
  journeyEventRunIdx: index("journey_events_run_idx").on(
    table.journeyId,
    table.runId,
  ),
  journeyEventStepIdx: index("journey_events_step_idx").on(
    table.stepId,
    table.ts,
  ),
}));

export const journeyRecommendations = pgTable("journey_recommendations", {
  id: id(),
  journeyId: text("journey_id")
    .notNull()
    .references(() => journeys.id, { onDelete: "cascade" }),
  runId: text("run_id"),
  stepId: text("step_id").references(() => journeySteps.id, { onDelete: "set null" }),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  expectedImpact: text("expected_impact").notNull().default(""),
  riskLevel: text("risk_level")
    .$type<JourneyRecommendationRisk>()
    .notNull()
    .default("medium"),
  status: text("status")
    .$type<JourneyRecommendationStatus>()
    .notNull()
    .default("pending"),
  source: text("source")
    .$type<JourneyRecommendationSource>()
    .notNull()
    .default("system"),
  reviewSlaMinutes: integer("review_sla_minutes").notNull().default(240),
  reviewDueAt: timestamp("review_due_at", { withTimezone: true }).notNull(),
  decisionReason: text("decision_reason"),
  rejectionDisposition: text("rejection_disposition").$type<JourneyRejectionDisposition>(),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  journeyRecommendationJourneyIdx: index("journey_recommendations_journey_idx").on(
    table.journeyId,
    table.createdAt,
  ),
  journeyRecommendationStatusIdx: index("journey_recommendations_status_idx").on(
    table.status,
    table.reviewDueAt,
  ),
}));

export const journeyRecommendationActions = pgTable("journey_recommendation_actions", {
  id: id(),
  recommendationId: text("recommendation_id")
    .notNull()
    .references(() => journeyRecommendations.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  actorType: text("actor_type").$type<JourneyActionActorType>().notNull(),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  capability: text("capability").notNull(),
  executionMode: text("execution_mode")
    .$type<JourneyActionExecutionMode>()
    .notNull(),
  controlScope: text("control_scope")
    .$type<JourneyActionControlScope>()
    .notNull(),
  status: text("status")
    .$type<JourneyActionStatus>()
    .notNull()
    .default("proposed"),
  owner: text("owner").notNull().default(""),
  slaMinutes: integer("sla_minutes").notNull().default(60),
  dueAt: timestamp("due_at", { withTimezone: true }),
  result: text("result"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  journeyRecommendationActionOrderUnique: uniqueIndex(
    "journey_recommendation_actions_order_idx",
  ).on(table.recommendationId, table.sequence),
  journeyRecommendationActionDueIdx: index(
    "journey_recommendation_actions_due_idx",
  ).on(table.status, table.dueAt),
}));

export const agentIdentities = pgTable("agent_identities", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id, { onDelete: "cascade" }),
  bio: text("bio").notNull().default(""),
  shouldDo: jsonb("should_do").$type<string[]>().notNull().default([]),
  shouldNotDo: jsonb("should_not_do").$type<string[]>().notNull().default([]),
  autonomyLevel: text("autonomy_level")
    .$type<AutonomyLevel>()
    .notNull()
    .default("escalates"),
  autonomyNotes: text("autonomy_notes"),
  limits: jsonb("limits").$type<string[]>().notNull().default([]),
  businessCase: jsonb("business_case")
    .$type<BusinessCase>()
    .notNull()
    .default({
      baseline: "",
      targetPayback: "",
      actualPayback: "",
      description: "",
    }),
  version: integer("version").notNull().default(1),
});

export const agentOwners = pgTable("agent_owners", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id, { onDelete: "cascade" }),
  businessOwner: text("business_owner").notNull().default(""),
  technicalOwner: text("technical_owner").notNull().default(""),
  governanceSponsor: text("governance_sponsor").notNull().default(""),
});

export const evaluations = pgTable("evaluations", {
  id: id(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  window: text("window").notNull().default("30d"),
  layers: jsonb("layers").$type<KpiLayer[]>().notNull().default([]),
  verdict: text("verdict").$type<VerdictType>().notNull().default("observation"),
  verdictConfidence: doublePrecision("verdict_confidence").notNull().default(0),
  rationale: text("rationale").notNull().default(""),
});

export const verdicts = pgTable("verdicts", {
  id: id(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  verdict: text("verdict").$type<VerdictType>().notNull().default("observation"),
  confidence: doublePrecision("confidence").notNull().default(0),
  executionWindow: text("execution_window").notNull().default(""),
  suggestedSponsor: text("suggested_sponsor").notNull().default(""),
  nextActions: jsonb("next_actions").$type<NextAction[]>().notNull().default([]),
  rationale: text("rationale").notNull().default(""),
  decision: text("decision")
    .$type<DecisionStatus>()
    .notNull()
    .default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AlertSeverity = "critical" | "high" | "medium" | "antecedent";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export const alerts = pgTable("alerts", {
  id: id(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(),
  patternType: text("pattern_type").notNull().default(""),
  severity: text("severity")
    .$type<AlertSeverity>()
    .notNull()
    .default("medium"),
  hypothesis: text("hypothesis").notNull().default(""),
  recommendation: text("recommendation").notNull().default(""),
  detectedAt: timestamp("detected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: text("status").$type<AlertStatus>().notNull().default("active"),
  assignedTo: text("assigned_to"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type ConnectorStatus = "connected" | "available" | "syncing";

export const connectors = pgTable("connectors", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  status: text("status")
    .$type<ConnectorStatus>()
    .notNull()
    .default("available"),
  agentsDiscovered: integer("agents_discovered").notNull().default(0),
  category: text("category").notNull().default(""),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
}, (table) => ({
  connectorsOrgIdx: index("connectors_org_idx").on(table.orgId),
}));

export const metricPoints = pgTable("metric_points", {
  id: id(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  efficacy: doublePrecision("efficacy").notNull().default(0),
  efficiency: doublePrecision("efficiency").notNull().default(0),
  adoption: doublePrecision("adoption").notNull().default(0),
  governance: doublePrecision("governance").notNull().default(0),
  value: doublePrecision("value").notNull().default(0),
});

// --- Mass discovery staging -------------------------------------------------
// Discovered agents are parked as editable drafts (separate from the real
// fleet) and grouped by a discovery run before any of them is admitted.

export type DiscoveryRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

// Hybrid enrichment lifecycle: rules fill instantly, AI enriches in batch.
export type DraftEnrichmentStatus =
  | "pending"
  | "rules"
  | "enriching"
  | "enriched"
  | "failed";

export type DraftReviewStatus = "pending" | "approved" | "rejected";

export interface DraftKpiMetric {
  layer: LayerKey;
  label: string;
  unit: string;
  target?: string;
  // Optional reviewer-set starting/current value (overrides seeded value at
  // admission so goal-vs-actual reflects reality).
  value?: number;
  rationale?: string;
}

export interface DraftBusinessCase {
  baseline: string;
  targetPayback: string;
  description: string;
}

export const discoveryRuns = pgTable("discovery_runs", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  sourceRef: text("source_ref"),
  status: text("status")
    .$type<DiscoveryRunStatus>()
    .notNull()
    .default("pending"),
  totalDiscovered: integer("total_discovered").notNull().default(0),
  draftsCreated: integer("drafts_created").notNull().default(0),
  note: text("note").notNull().default(""),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  discoveryRunsOrgIdx: index("discovery_runs_org_idx").on(table.orgId),
}));

export const agentDrafts = pgTable("agent_drafts", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  runId: text("run_id")
    .notNull()
    .references(() => discoveryRuns.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  externalId: text("external_id"),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  platform: text("platform").notNull(),
  tagline: text("tagline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  shouldDo: jsonb("should_do").$type<string[]>().notNull().default([]),
  shouldNotDo: jsonb("should_not_do").$type<string[]>().notNull().default([]),
  autonomyLevel: text("autonomy_level")
    .$type<AutonomyLevel>()
    .notNull()
    .default("escalates"),
  autonomyNotes: text("autonomy_notes"),
  limits: jsonb("limits").$type<string[]>().notNull().default([]),
  businessCase: jsonb("business_case")
    .$type<DraftBusinessCase>()
    .notNull()
    .default({ baseline: "", targetPayback: "", description: "" }),
  proposedMetrics: jsonb("proposed_metrics")
    .$type<DraftKpiMetric[]>()
    .notNull()
    .default([]),
  summary: text("summary").notNull().default(""),
  confidence: doublePrecision("confidence").notNull().default(0),
  enrichmentStatus: text("enrichment_status")
    .$type<DraftEnrichmentStatus>()
    .notNull()
    .default("pending"),
  reviewStatus: text("review_status")
    .$type<DraftReviewStatus>()
    .notNull()
    .default("pending"),
  promotedAgentId: text("promoted_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  agentDraftsOrgIdx: index("agent_drafts_org_idx").on(table.orgId),
}));

// --- Metric catalog (R2) ------------------------------------------------------
// Pre-populated library of deep metrics organized by business vertical, plus
// tailor-made custom metrics created by the user. Seeded rows carry
// isCustom=false and are re-seeded on boot when the table is empty.

export const catalogMetrics = pgTable("catalog_metrics", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  // Unique kebab-case key, e.g. "acuracia-das-decisoes".
  key: text("key").notNull().unique(),
  // One of the vertical keys defined in the metric catalog seed
  // (negocios, tecnologia, operacoes, suporte-ti, risco-compliance, financeiro).
  vertical: text("vertical").notNull(),
  layer: text("layer").$type<LayerKey>().notNull(),
  label: text("label").notNull(),
  unit: text("unit").notNull().default(""),
  target: text("target").notNull().default("—"),
  description: text("description").notNull().default(""),
  rationale: text("rationale").notNull().default(""),
  isCustom: integer("is_custom").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  catalogMetricsOrgIdx: index("catalog_metrics_org_idx").on(table.orgId),
}));

// --- Real connectors (R3) -----------------------------------------------------
// Credentials for registered connectors. The credential column is NEVER
// serialized in API responses — only its presence (hasCredential) is exposed.
export type ConnectorAuthMethod = "token" | "env" | "none";

export const connectorCredentials = pgTable("connector_credentials", {
  id: id(),
  connectorId: text("connector_id")
    .notNull()
    .unique()
    .references(() => connectors.id, { onDelete: "cascade" }),
  authMethod: text("auth_method").$type<ConnectorAuthMethod>().notNull().default("token"),
  // Plaintext at rest for local dev; production must move to a KMS/vault.
  credential: text("credential"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Telemetry (R6) -----------------------------------------------------------
// Raw execution events reported by agents (SDK/reporter). Aggregations derive
// the real 5-layer evaluation; when an agent has no events the evaluation
// falls back to the seeded demo scoring (flagged as dataSource="seeded").
export type AgentEventKind =
  | "execution"
  | "error"
  | "escalation"
  | "feedback"
  | "heartbeat";

export const agentEvents = pgTable("agent_events", {
  id: id(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind").$type<AgentEventKind>().notNull().default("execution"),
  durationMs: integer("duration_ms"),
  costCents: integer("cost_cents"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  success: integer("success"), // 1/0/null — drizzle boolean-as-int keeps parity with is_custom
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

// --- Metric evidence (R7) ----------------------------------------------------
// Persisted observations are the auditable bridge between telemetry/discovery
// and KPI decisions. References are optional because evidence can be scoped to
// an agent, a mixed team, a purpose, or remain unscoped during ingestion.
export const metricEvidence = pgTable("metric_evidence", {
  id: id(),
  metricKey: text("metric_key").notNull(),
  label: text("label").notNull(),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
  purposeId: text("purpose_id").references(() => purposes.id, { onDelete: "cascade" }),
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull(),
  kind: text("kind").notNull(),
  source: jsonb("source").$type<Record<string, unknown>>().notNull(),
  lineage: jsonb("lineage").$type<Record<string, unknown>[]>().notNull().default([]),
  confidence: doublePrecision("confidence").notNull(),
  sampleSize: integer("sample_size"),
  qualityFlags: jsonb("quality_flags").$type<string[]>().notNull().default([]),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  metricEvidenceMetricKeyIdx: index("metric_evidence_metric_key_idx").on(table.metricKey),
}));

// --- Agent credentials (R7 · gauntlet rodada 3) -------------------------------
// The credential a RUNNING agent uses to report telemetry, deliberately
// separate from the human Clerk session: an agent deployed in the customer's
// infrastructure must never carry a user session. Only the SHA-256 of the token
// is stored, so a database dump cannot be replayed against the ingest endpoint.
// `prefix` is the public, indexed lookup handle — never secret.
export const agentApiKeys = pgTable("agent_api_keys", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  label: text("label"),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => ({
  agentApiKeysOrgIdx: index("agent_api_keys_org_idx").on(table.orgId),
  agentApiKeysPrefixIdx: uniqueIndex("agent_api_keys_prefix_idx").on(table.prefix),
  agentApiKeysAgentIdx: index("agent_api_keys_agent_idx").on(table.agentId),
}));

// --- Ciclo de revisão do agente (R7 · gauntlet rodada 5) ----------------------
// Paridade com journey_recommendation_actions: no nível da jornada as ações já
// tinham responsável, status, SLA e evidência; no nível do agente eram apenas
// texto em `verdicts.next_actions`, sem acompanhamento. Sem status, ninguém
// sabia se a mentoria recomendada chegou a acontecer — e a pergunta "funcionou?"
// ficava sem resposta verificável.
export type VerdictActionStatus =
  | "proposed"
  | "in-progress"
  | "blocked"
  | "completed"
  | "cancelled";

export const verdictActions = pgTable("verdict_actions", {
  id: id(),
  verdictId: text("verdict_id")
    .notNull()
    .references(() => verdicts.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull().default(1),
  action: text("action").notNull(),
  owner: text("owner").notNull().default(""),
  due: text("due").notNull().default(""),
  status: text("status").$type<VerdictActionStatus>().notNull().default("proposed"),
  // Evidência do que foi feito — o que transforma "marquei como pronto" em algo
  // auditável seis meses depois.
  evidence: text("evidence").notNull().default(""),
  // Fotografia da saúde no momento em que a ação foi aprovada: é contra ela que
  // a próxima avaliação responde se a intervenção funcionou.
  healthScoreAtApproval: integer("health_score_at_approval"),
  updatedBy: text("updated_by"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  verdictActionsVerdictIdx: index("verdict_actions_verdict_idx").on(table.verdictId),
  verdictActionsAgentIdx: index("verdict_actions_agent_idx").on(table.agentId),
}));
