import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  date,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  unique,
  foreignKey,
  check,
  numeric,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

export type OrgMemberRole = "owner" | "admin" | "member";
export type AccessScopeType = "organization" | "area" | "team";
export type AccessPermission =
  | "agents:read"
  | "agents:operate"
  | "teams:read"
  | "teams:manage"
  | "journeys:read"
  | "journeys:manage"
  | "decisions:approve"
  | "governance:read"
  | "governance:manage"
  | "reports:read"
  | "connectors:manage"
  | "members:manage";

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

// --- Projeto e ambiente (E1 · migração 0022) ----------------------------------
// conta (organizations) > projeto > ambiente > chave. Toda conta tem um projeto
// "Padrão" e todo projeto tem exatamente `sandbox` e `prod` — criados por
// trigger no banco, para que nenhum INSERT antigo precise saber disso. O
// ambiente pertence à chave e ao evento; o agente é do projeto (D-E1-1).
export type EnvironmentKind = "sandbox" | "prod";
export const ENVIRONMENT_KINDS: readonly EnvironmentKind[] = ["sandbox", "prod"];

export const projects = pgTable("projects", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  projectsOrgSlugIdx: uniqueIndex("projects_org_slug_idx").on(table.orgId, table.slug),
  projectsOrgDefaultIdx: uniqueIndex("projects_org_default_idx")
    .on(table.orgId)
    .where(sql`"is_default"`),
  // Alvo das FKs compostas: quem aponta para o projeto aponta também para a
  // conta dele, então uma linha não consegue misturar projeto e conta alheios.
  projectsIdOrgUnique: unique("projects_id_org_unique").on(table.id, table.orgId),
}));

export const environments = pgTable("environments", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull(),
  kind: text("kind").$type<EnvironmentKind>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  environmentsProjectFk: foreignKey({
    name: "environments_project_org_fk",
    columns: [table.projectId, table.orgId],
    foreignColumns: [projects.id, projects.orgId],
  }).onDelete("cascade"),
  environmentsProjectKindIdx: uniqueIndex("environments_project_kind_idx").on(table.projectId, table.kind),
  environmentsIdProjectOrgUnique: unique("environments_id_project_org_unique").on(
    table.id,
    table.projectId,
    table.orgId,
  ),
  environmentsKindCheck: check("environments_kind_check", sql`"kind" IN ('sandbox', 'prod')`),
}));

/**
 * Colunas de escopo preenchidas pelo banco quando o INSERT não as informa
 * (triggers da 0022). `sql\`default\`` faz o Drizzle mandar DEFAULT em vez de
 * exigir o valor no tipo de insert; a coluna continua NOT NULL.
 */
const filledByTrigger = () => sql`default`;

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

export const accessGroups = pgTable("access_groups", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  scopeType: text("scope_type").$type<AccessScopeType>().notNull().default("organization"),
  scopeId: text("scope_id"),
  permissions: jsonb("permissions").$type<AccessPermission[]>().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accessGroupsOrgSlugIdx: uniqueIndex("access_groups_org_slug_idx").on(table.orgId, table.slug),
  accessGroupsOrgIdx: index("access_groups_org_idx").on(table.orgId),
  accessGroupsScopeIdx: index("access_groups_scope_idx").on(table.orgId, table.scopeType, table.scopeId),
}));

export const accessGroupMembers = pgTable("access_group_members", {
  id: id(),
  groupId: text("group_id").notNull().references(() => accessGroups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull().default(""),
  userEmail: text("user_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accessGroupMemberUnique: uniqueIndex("access_group_members_group_user_idx").on(table.groupId, table.userId),
  accessGroupMemberUserIdx: index("access_group_members_user_idx").on(table.userId),
}));

/**
 * Área (ou grupo) — a estrutura interna da organização.
 *
 * A organização é a fronteira de isolamento: dado de uma nunca vaza para outra.
 * A área é outra coisa, e a distinção importa. Um piloto acontece dentro de UMA
 * empresa, mas essa empresa tem Atendimento, Financeiro, Engenharia — cada uma
 * com dono, orçamento e critério de sucesso próprios. Sem esse nível, a frota
 * vira uma lista plana de agentes que ninguém reconhece como sua.
 *
 * Área NÃO é fronteira de segurança: quem enxerga a organização enxerga todas as
 * suas áreas. É recorte de responsabilidade — quem responde por este agente, e
 * contra qual orçamento ele conta.
 */
export const areas = pgTable("areas", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  /** Quem responde pela área — o nome que aparece ao lado do veredito. */
  leader: text("leader").notNull().default(""),
  /** Centro de custo: liga o custo do agente ao orçamento que já existe. */
  costCenter: text("cost_center").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  areasOrgSlugIdx: uniqueIndex("areas_org_slug_idx").on(table.orgId, table.slug),
  areasOrgIdx: index("areas_org_idx").on(table.orgId),
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
export type ProfessionalPlanDecisionType =
  | "approved"
  | "adjustment_requested"
  | "rejected";
export type ProfessionalPlanActionStatus =
  | "ready"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";
export type ProfessionalPlanActionActor = "muster" | "agent" | "human";
export type ProfessionalPlanAction = {
  sequence: number;
  actorType: ProfessionalPlanActionActor;
  title: string;
  description: string;
  owner: string;
  status: ProfessionalPlanActionStatus;
  dueAt: string | null;
  evidence?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedBy?: string | null;
};
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
  metricContracts?: Array<{
    catalogMetricKey?: string;
    layer: LayerKey;
    label: string;
    unit: string;
    target?: string;
    rationale?: string;
  }>;
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
  /** Projeto do agente; sem valor no INSERT, o trigger usa o projeto Padrão da conta. */
  projectId: text("project_id").notNull().$defaultFn(filledByTrigger),
  /**
   * Área responsável. Nulo é permitido de propósito: um agente descoberto por
   * varredura ou integrado às pressas entra sem dono, e a plataforma precisa
   * conseguir mostrá-lo como "sem área" em vez de recusar o cadastro. `set null`
   * na exclusão da área: perder o recorte não pode apagar o agente.
   */
  areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
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
  agentsAreaIdx: index("agents_area_idx").on(table.areaId),
  agentsOrgProjectIdx: index("agents_org_project_idx").on(table.orgId, table.projectId),
  agentsProjectFk: foreignKey({
    name: "agents_project_org_fk",
    columns: [table.projectId, table.orgId],
    foreignColumns: [projects.id, projects.orgId],
  }),
  // Alvo da FK da chave: a chave é sempre do mesmo projeto e conta do agente.
  agentsIdProjectOrgUnique: unique("agents_id_project_org_unique").on(
    table.id,
    table.projectId,
    table.orgId,
  ),
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
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  entryCriterion: text("entry_criterion").notNull().default(""),
  successCriterion: text("success_criterion").notNull().default(""),
  status: text("status").$type<JourneyStatus>().notNull().default("draft"),
  slaMinutes: integer("sla_minutes").notNull().default(60),
  owner: text("owner").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  journeysOrgSlugIdx: uniqueIndex("journeys_org_slug_idx").on(table.orgId, table.slug),
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
  // Cunha (0024): versão do contrato vigente quando o veredito foi gravado.
  // Nulos em vereditos anteriores ao contrato numérico (regra R3).
  contractId: text("contract_id"),
  contractVersion: integer("contract_version"),
}, (table) => ({
  verdictsContractFk: foreignKey({
    name: "verdicts_contract_fk",
    columns: [table.contractId, table.contractVersion],
    foreignColumns: [agentContracts.id, agentContracts.version],
  }).onDelete("set null"),
}));

// --- Contrato numérico versionado (cunha · 0024) ------------------------------
// Substitui as strings de business_case (que ficam só como texto de
// referência). Cada mudança é uma versão nova; o trigger
// agent_contracts_immutable só deixa mudar status/superseded_at e recusa
// DELETE fora da cascata do agente/conta.
export type ContractDirection = "up" | "down";
export type ContractStatus = "draft" | "active" | "superseded";

export const agentContracts = pgTable("agent_contracts", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull(),
  agentId: text("agent_id").notNull(),
  version: integer("version").notNull(),
  metricKey: text("metric_key").notNull(),
  unit: text("unit").notNull(),
  direction: text("direction").$type<ContractDirection>().notNull(),
  baseline: numeric("baseline", { mode: "number" }).notNull(),
  target: numeric("target", { mode: "number" }).notNull(),
  limit: numeric("limit", { mode: "number" }),
  deadline: date("deadline").notNull(),
  /**
   * organization_members.id do dono, validado pela API. Sem FK de propósito: a
   * versão é imutável e precisa continuar dizendo quem era o dono mesmo depois
   * que a pessoa sair da conta.
   */
  ownerMemberId: text("owner_member_id").notNull(),
  status: text("status").$type<ContractStatus>().notNull().default("active"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  /** Minutos humanos de referência por tarefa (D-C2); não é o human_minutes do evento. */
  referenceHumanMinutes: numeric("reference_human_minutes", { mode: "number" }),
  /** D-C3: aceite automático não conta como tarefa aceita. */
  requireHumanAccept: boolean("require_human_accept").notNull().default(false),
  /** D-C1: modelo de referência fixado pela conta (sem valor = o mais barato aprovado). */
  referenceModel: text("reference_model"),
}, (table) => ({
  agentContractsAgentVersionIdx: uniqueIndex("agent_contracts_agent_version_idx").on(table.agentId, table.version),
  agentContractsActiveIdx: uniqueIndex("agent_contracts_active_idx")
    .on(table.agentId)
    .where(sql`"status" = 'active'`),
  agentContractsOrgAgentIdx: index("agent_contracts_org_agent_idx").on(table.orgId, table.agentId),
  // Alvo da FK de verdicts: (id, version) andam juntos.
  agentContractsIdVersionUnique: unique("agent_contracts_id_version_unique").on(table.id, table.version),
  agentContractsAgentFk: foreignKey({
    name: "agent_contracts_agent_project_org_fk",
    columns: [table.agentId, table.projectId, table.orgId],
    foreignColumns: [agents.id, agents.projectId, agents.orgId],
  }).onDelete("cascade"),
  agentContractsDirectionCheck: check("agent_contracts_direction_check", sql`"direction" IN ('up', 'down')`),
  agentContractsStatusCheck: check(
    "agent_contracts_status_check",
    sql`"status" IN ('draft', 'active', 'superseded')`,
  ),
  agentContractsVersionCheck: check("agent_contracts_version_check", sql`"version" >= 1`),
  agentContractsReferenceMinutesCheck: check(
    "agent_contracts_reference_minutes_check",
    sql`"reference_human_minutes" IS NULL OR "reference_human_minutes" >= 0`,
  ),
}));

// --- Custo-hora e custos fora da fatura (cunha · 0025) ------------------------
// Sem seed e sem default global (R4): conta sem custo-hora vigente vê a camada
// 1 como "indisponível". Valores em centavos, nunca em log.
export type RateCurrency = "BRL" | "USD";
export type OffInvoiceCategory = "license" | "infra" | "integration" | "other";
export type OffInvoiceAllocation = "agent" | "project" | "per_task";

export const roleRates = pgTable("role_rates", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  /** Nulo = vale para o papel em toda a conta; com área, a área tem precedência. */
  areaId: text("area_id").references(() => areas.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  hourlyCostCents: integer("hourly_cost_cents").notNull(),
  currency: text("currency").$type<RateCurrency>().notNull(),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  roleRatesOrgRoleIdx: index("role_rates_org_role_idx").on(table.orgId, table.role, table.validFrom),
  roleRatesValueCheck: check("role_rates_value_check", sql`"hourly_cost_cents" >= 0`),
  roleRatesCurrencyCheck: check("role_rates_currency_check", sql`"currency" IN ('BRL', 'USD')`),
  roleRatesPeriodCheck: check("role_rates_period_check", sql`"valid_to" IS NULL OR "valid_to" >= "valid_from"`),
}));

export const offInvoiceCosts = pgTable("off_invoice_costs", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: text("project_id"),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  category: text("category").$type<OffInvoiceCategory>().notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").$type<RateCurrency>().notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  allocation: text("allocation").$type<OffInvoiceAllocation>().notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  offInvoiceOrgPeriodIdx: index("off_invoice_costs_org_period_idx").on(table.orgId, table.periodStart),
  offInvoiceProjectFk: foreignKey({
    name: "off_invoice_costs_project_org_fk",
    columns: [table.projectId, table.orgId],
    foreignColumns: [projects.id, projects.orgId],
  }).onDelete("cascade"),
  offInvoiceValueCheck: check("off_invoice_costs_value_check", sql`"amount_cents" >= 0`),
  offInvoiceCurrencyCheck: check("off_invoice_costs_currency_check", sql`"currency" IN ('BRL', 'USD')`),
  offInvoicePeriodCheck: check("off_invoice_costs_period_check", sql`"period_end" >= "period_start"`),
  offInvoiceCategoryCheck: check(
    "off_invoice_costs_category_check",
    sql`"category" IN ('license', 'infra', 'integration', 'other')`,
  ),
  offInvoiceAllocationCheck: check(
    "off_invoice_costs_allocation_check",
    sql`("allocation" = 'agent' AND "agent_id" IS NOT NULL) OR ("allocation" = 'project' AND "project_id" IS NOT NULL) OR "allocation" = 'per_task'`,
  ),
}));

export type AlertSeverity = "critical" | "high" | "medium" | "antecedent";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type GovernanceAssessmentStatus =
  | "healthy"
  | "attention"
  | "critical"
  | "insufficient_data";
export type HallucinationAssessmentStatus =
  | "healthy"
  | "warning"
  | "critical"
  | "not_measured";
export type RegressionAssessmentStatus =
  | "insufficient_data"
  | "stable"
  | "drift"
  | "warning"
  | "regression";

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

export const agentGovernanceAssessments = pgTable("agent_governance_assessments", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id, { onDelete: "cascade" }),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  status: text("status")
    .$type<GovernanceAssessmentStatus>()
    .notNull()
    .default("insufficient_data"),
  directionScore: doublePrecision("direction_score").notNull().default(0),
  protectionScore: doublePrecision("protection_score").notNull().default(0),
  proofScore: doublePrecision("proof_score").notNull().default(0),
  contextHealthScore: doublePrecision("context_health_score"),
  hallucinationStatus: text("hallucination_status")
    .$type<HallucinationAssessmentStatus>()
    .notNull()
    .default("not_measured"),
  groundedOutputRate: doublePrecision("grounded_output_rate"),
  hallucinationFlags: integer("hallucination_flags").notNull().default(0),
  auditedOutputs: integer("audited_outputs").notNull().default(0),
  regressionStatus: text("regression_status").$type<RegressionAssessmentStatus>().notNull().default("insufficient_data"),
  regressionAttributable: boolean("regression_attributable").notNull().default(false),
  inputDrift: doublePrecision("input_drift"),
  baselineReleaseId: text("baseline_release_id"),
  currentReleaseId: text("current_release_id"),
  signals: jsonb("signals").$type<Record<string, unknown>[]>().notNull().default([]),
  recommendations: jsonb("recommendations").$type<string[]>().notNull().default([]),
  evidenceCount: integer("evidence_count").notNull().default(0),
  sourceEventCount: integer("source_event_count").notNull().default(0),
  assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  governanceAssessmentOrgStatusIdx: index("agent_governance_assessments_org_status_idx").on(
    table.orgId,
    table.status,
  ),
  governanceAssessmentOrgAssessedIdx: index("agent_governance_assessments_org_assessed_idx").on(
    table.orgId,
    table.assessedAt,
  ),
}));

export type ConnectorStatus =
  | "available"
  | "configured"
  | "connected"
  | "syncing"
  | "degraded"
  | "error";
export type ConnectorMode = "native" | "universal" | "runtime";
export type ConnectorHealth = "unverified" | "healthy" | "degraded" | "error";

export const connectors = pgTable("connectors", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  status: text("status")
    .$type<ConnectorStatus>()
    .notNull()
    .default("available"),
  mode: text("mode").$type<ConnectorMode>().notNull().default("native"),
  health: text("health")
    .$type<ConnectorHealth>()
    .notNull()
    .default("unverified"),
  agentsDiscovered: integer("agents_discovered").notNull().default(0),
  category: text("category").notNull().default(""),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
}, (table) => ({
  connectorsOrgIdx: index("connectors_org_idx").on(table.orgId),
}));

export type AgentConnectorRole = "primary" | "telemetry" | "discovery";

export const agentConnectorLinks = pgTable("agent_connector_links", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  connectorId: text("connector_id").notNull().references(() => connectors.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  role: text("role").$type<AgentConnectorRole>().notNull().default("primary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  agentConnectorUnique: uniqueIndex("agent_connector_links_agent_connector_idx").on(
    table.agentId,
    table.connectorId,
  ),
  connectorExternalUnique: uniqueIndex("agent_connector_links_connector_external_idx").on(
    table.connectorId,
    table.externalId,
  ),
  agentConnectorOrgIdx: index("agent_connector_links_org_idx").on(table.orgId),
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
  catalogMetricKey?: string;
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
  // Kebab-case key unique inside the organization, e.g. "acuracia-das-decisoes".
  key: text("key").notNull(),
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
  catalogMetricsOrgKeyIdx: uniqueIndex("catalog_metrics_org_key_idx").on(table.orgId, table.key),
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
  // Versioned AES-256-GCM envelope; plaintext is materialized only in-memory
  // at the connector adapter boundary. Production may replace this with KMS.
  credential: text("credential"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Credential used by an EXTERNAL CONNECTOR to publish normalized envelopes.
// It is distinct from provider credentials above: provider secrets are
// encrypted and used by native adapters, while ingestion keys are one-way
// hashes and can only call the tenant-scoped ingestion boundary.
export const connectorApiKeys = pgTable("connector_api_keys", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  connectorId: text("connector_id")
    .notNull()
    .references(() => connectors.id, { onDelete: "cascade" }),
  label: text("label"),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => ({
  connectorApiKeysOrgIdx: index("connector_api_keys_org_idx").on(table.orgId),
  connectorApiKeysPrefixIdx: uniqueIndex("connector_api_keys_prefix_idx").on(table.prefix),
  connectorApiKeysConnectorIdx: index("connector_api_keys_connector_idx").on(table.connectorId),
}));

// --- Telemetry (R6) -----------------------------------------------------------
// Raw execution events reported by agents (SDK/reporter). Aggregations derive
// the real 5-layer evaluation; when an agent has no events the evaluation
// falls back to the seeded demo scoring (flagged as dataSource="seeded").
export type AgentEventKind =
  | "execution"
  | "error"
  | "escalation"
  | "feedback"
  | "heartbeat"
  // Cunha (0023): aprovação/rejeição humana de uma tarefa (regra R5).
  | "human_review";

export type AcceptedByKind = "human" | "auto";

/** Capabilities que a tarefa usou; base da escolha do modelo de referência (D-C1). */
export interface TaskCapabilities {
  tools?: boolean;
  vision?: boolean;
  /** Janela de contexto usada, em tokens. */
  contextWindow?: number;
  [key: string]: unknown;
}

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
  // --- Cunha · resultado da tarefa (0023) ------------------------------------
  // Todas anuláveis: evento antigo continua válido. Conta/projeto vêm do
  // agente (trigger, quando o INSERT não informa) e o ambiente vem da chave;
  // nunca do corpo da requisição. Nomes iguais aos headers x-veltrix-* (R2).
  orgId: text("org_id"),
  projectId: text("project_id"),
  environmentId: text("environment_id"),
  /** x-veltrix-task */
  taskId: text("task_id"),
  /** x-veltrix-run */
  runId: text("run_id"),
  /** Ordinal do run dentro da task (1, 2, …). */
  attempt: integer("attempt"),
  /** run_id da tentativa anterior da mesma task. */
  retryOf: text("retry_of"),
  expected: jsonb("expected").$type<unknown>(),
  actual: jsonb("actual").$type<unknown>(),
  /** Quem decidiu: pessoa (human) ou regra (auto). Em human_review, o revisor. */
  acceptedBy: text("accepted_by"),
  acceptedByKind: text("accepted_by_kind").$type<AcceptedByKind>(),
  acceptedRuleVersion: text("accepted_rule_version"),
  /** Não nulo = a tarefa foi aceita por este evento. */
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  capabilities: jsonb("capabilities").$type<TaskCapabilities>(),
  reworkCount: integer("rework_count"),
  /** Minutos humanos reais: revisão (human_review) ou retrabalho (demais). */
  humanMinutes: numeric("human_minutes", { precision: 8, scale: 2, mode: "number" }),
  contextTokens: integer("context_tokens"),
  model: text("model"),
}, (table) => ({
  agentEventsAgentTsIdx: index("agent_events_agent_ts_idx").on(table.agentId, table.ts),
  agentEventsOrgProjectEnvTsIdx: index("agent_events_org_project_env_ts_idx").on(
    table.orgId,
    table.projectId,
    table.environmentId,
    table.ts,
  ),
  // Um resultado terminal por tentativa; escalation/feedback/human_review
  // anotam a tentativa e podem se repetir.
  agentEventsTaskAttemptIdx: uniqueIndex("agent_events_task_attempt_idx")
    .on(table.orgId, table.taskId, table.attempt)
    .where(sql`"task_id" IS NOT NULL AND "kind" IN ('execution', 'error')`),
  agentEventsOrgRunIdx: index("agent_events_org_run_idx")
    .on(table.orgId, table.runId)
    .where(sql`"run_id" IS NOT NULL`),
  agentEventsAgentFk: foreignKey({
    name: "agent_events_agent_project_org_fk",
    columns: [table.agentId, table.projectId, table.orgId],
    foreignColumns: [agents.id, agents.projectId, agents.orgId],
  }).onDelete("cascade"),
  agentEventsProjectFk: foreignKey({
    name: "agent_events_project_org_fk",
    columns: [table.projectId, table.orgId],
    foreignColumns: [projects.id, projects.orgId],
  }),
  agentEventsEnvironmentFk: foreignKey({
    name: "agent_events_environment_fk",
    columns: [table.environmentId, table.projectId, table.orgId],
    foreignColumns: [environments.id, environments.projectId, environments.orgId],
  }),
  agentEventsEnvironmentNeedsProject: check(
    "agent_events_environment_needs_project",
    sql`"environment_id" IS NULL OR "project_id" IS NOT NULL`,
  ),
  agentEventsAttemptCheck: check("agent_events_attempt_check", sql`"attempt" IS NULL OR "attempt" >= 1`),
  agentEventsAcceptedKindCheck: check(
    "agent_events_accepted_by_kind_check",
    sql`"accepted_by_kind" IS NULL OR "accepted_by_kind" IN ('human', 'auto')`,
  ),
  // D-C3: aceite automático sem versão da regra não é prova de nada.
  agentEventsAutoNeedsRuleCheck: check(
    "agent_events_auto_needs_rule_version",
    sql`"accepted_by_kind" IS DISTINCT FROM 'auto' OR "accepted_rule_version" IS NOT NULL`,
  ),
  agentEventsReworkCheck: check("agent_events_rework_count_check", sql`"rework_count" IS NULL OR "rework_count" >= 0`),
  agentEventsHumanMinutesCheck: check(
    "agent_events_human_minutes_check",
    sql`"human_minutes" IS NULL OR "human_minutes" >= 0`,
  ),
}));

export type OutboxStatus =
  | "pending"
  | "processing"
  | "completed"
  | "dead-letter";

export type OutboxPriority = "critical" | "high" | "normal" | "low";

// Durable, tenant-aware boundary between telemetry ingestion and continuous
// projections. Producers always insert this row in the same transaction as
// the domain event; workers claim rows with SKIP LOCKED.
export const eventOutbox = pgTable("event_outbox", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Nulos de propósito: evento de sistema/org-wide não tem projeto nem
  // ambiente. Evento vindo de chave de agente grava os dois (D-E1-1).
  projectId: text("project_id"),
  environmentId: text("environment_id"),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  priority: text("priority")
    .$type<OutboxPriority>()
    .notNull()
    .default("normal"),
  availableAt: timestamp("available_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  status: text("status")
    .$type<OutboxStatus>()
    .notNull()
    .default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  eventOutboxClaimIdx: index("event_outbox_claim_idx").on(
    table.status,
    table.availableAt,
    table.priority,
    table.createdAt,
  ),
  eventOutboxOrgActivityIdx: index("event_outbox_org_activity_idx").on(
    table.orgId,
    table.createdAt,
  ),
  eventOutboxAggregateIdx: index("event_outbox_aggregate_idx").on(
    table.orgId,
    table.aggregateType,
    table.aggregateId,
    table.createdAt,
  ),
  eventOutboxOrgProjectEnvIdx: index("event_outbox_org_project_env_idx").on(
    table.orgId,
    table.projectId,
    table.environmentId,
    table.createdAt,
  ),
  eventOutboxProjectFk: foreignKey({
    name: "event_outbox_project_org_fk",
    columns: [table.projectId, table.orgId],
    foreignColumns: [projects.id, projects.orgId],
  }),
  eventOutboxEnvironmentFk: foreignKey({
    name: "event_outbox_environment_fk",
    columns: [table.environmentId, table.projectId, table.orgId],
    foreignColumns: [environments.id, environments.projectId, environments.orgId],
  }),
  // FK composta com coluna nula não é checada (MATCH SIMPLE): sem esta regra,
  // um evento com ambiente e sem projeto escaparia da FK de ambiente.
  eventOutboxEnvironmentNeedsProject: check(
    "event_outbox_environment_needs_project",
    sql`"environment_id" IS NULL OR "project_id" IS NOT NULL`,
  ),
}));

// Atomic idempotency boundary for external ingestion. Keeping it separate from
// agent_events matters because a single envelope may materialize more than one
// event (execution + feedback) and several evidence observations.
export const externalEventReceipts = pgTable("external_event_receipts", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  eventId: text("event_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  externalEventReceiptsDedupeIdx: uniqueIndex("external_event_receipts_dedupe_idx").on(
    table.orgId,
    table.platform,
    table.eventId,
  ),
  externalEventReceiptsAgentIdx: index("external_event_receipts_agent_idx").on(table.agentId),
}));

// --- Metric evidence (R7) ----------------------------------------------------
// Persisted observations are the auditable bridge between telemetry/discovery
// and KPI decisions. References are optional because evidence can be scoped to
// an agent, a mixed team, a purpose, or remain entity-unscoped inside its org.
export const metricEvidence = pgTable("metric_evidence", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
  metricEvidenceOrgAgentMetricCapturedIdx: index(
    "metric_evidence_org_agent_metric_captured_idx",
  ).on(table.orgId, table.agentId, table.metricKey, table.capturedAt),
}));

export type ExecutiveReportStatus = "draft" | "published" | "superseded";
export type ExecutiveNarrativeSource = "deterministic" | "ai-assisted";
export type InsightGenerationMethod = "rules" | "ai-assisted" | "human";
export type InsightRecordStatus = "generated" | "accepted" | "dismissed" | "expired";
export type ExecutiveInsightSeverity = "critical" | "high" | "medium" | "low" | "positive";

export interface ExecutiveMetricComparison {
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPercent: number | null;
  unit: string;
  direction: "higher-is-better" | "lower-is-better" | "informational";
}

export interface ExecutiveReportSection {
  key: string;
  title: string;
  summary: string;
  highlights: string[];
  evidenceRefs: string[];
}

export interface ExecutiveReportQuality {
  score: number;
  dataCoverage: number;
  evaluationConfidence: number;
  decisionReady: boolean;
  limitations: string[];
}

export const executiveReportSnapshots = pgTable("executive_report_snapshots", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").$type<ExecutiveReportStatus>().notNull().default("draft"),
  templateId: text("template_id").notNull().default("board-brief"),
  title: text("title").notNull(),
  executiveSummary: text("executive_summary").notNull(),
  metrics: jsonb("metrics")
    .$type<Record<string, ExecutiveMetricComparison>>()
    .notNull()
    .default({}),
  layerComparison: jsonb("layer_comparison")
    .$type<Record<string, ExecutiveMetricComparison>>()
    .notNull()
    .default({}),
  portfolio: jsonb("portfolio").$type<Record<string, unknown>>().notNull().default({}),
  sections: jsonb("sections").$type<ExecutiveReportSection[]>().notNull().default([]),
  quality: jsonb("quality").$type<ExecutiveReportQuality>().notNull(),
  narrativeSource: text("narrative_source")
    .$type<ExecutiveNarrativeSource>()
    .notNull()
    .default("deterministic"),
  narrativeModel: text("narrative_model"),
  promptVersion: text("prompt_version"),
  sourceWatermark: timestamp("source_watermark", { withTimezone: true }),
  generatedBy: text("generated_by"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  executiveReportsOrgPeriodVersionIdx: uniqueIndex(
    "executive_reports_org_period_version_idx",
  ).on(table.orgId, table.period, table.version),
  executiveReportsOrgPeriodIdx: index("executive_reports_org_period_idx").on(
    table.orgId,
    table.period,
    table.generatedAt,
  ),
}));

export const insightRecords = pgTable("insight_records", {
  id: id(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  reportId: text("report_id").references(() => executiveReportSnapshots.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  entityType: text("entity_type").notNull().default("organization"),
  entityId: text("entity_id"),
  category: text("category").notNull(),
  title: text("title").notNull(),
  narrative: text("narrative").notNull(),
  recommendation: text("recommendation").notNull().default(""),
  severity: text("severity").$type<ExecutiveInsightSeverity>().notNull().default("medium"),
  confidence: doublePrecision("confidence").notNull().default(0),
  evidenceRefs: jsonb("evidence_refs").$type<string[]>().notNull().default([]),
  generationMethod: text("generation_method")
    .$type<InsightGenerationMethod>()
    .notNull()
    .default("rules"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  status: text("status").$type<InsightRecordStatus>().notNull().default("generated"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => ({
  insightRecordsOrgPeriodIdx: index("insight_records_org_period_idx").on(
    table.orgId,
    table.period,
    table.generatedAt,
  ),
  insightRecordsReportIdx: index("insight_records_report_idx").on(table.reportId),
  insightRecordsEntityIdx: index("insight_records_entity_idx").on(
    table.orgId,
    table.entityType,
    table.entityId,
  ),
}));

// Daily, tenant-scoped usage ledger for the AI features. This table contains
// aggregates only: prompts and generated content are never persisted here.
export const aiUsageDaily = pgTable("ai_usage_daily", {
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  // Nulo no histórico e nas chamadas sem projeto conhecido (D-E1-3). A soma
  // do orçamento continua por organização.
  projectId: text("project_id"),
  day: date("day").notNull(),
  feature: text("feature").notNull(),
  calls: integer("calls").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  estCostUsd: doublePrecision("est_cost_usd").notNull().default(0),
}, (table) => ({
  // NULLS NOT DISTINCT: linhas sem projeto continuam colidindo entre si, como
  // no índice único anterior (org, dia, feature).
  aiUsageDailyOrgProjectDayFeatureUnique: unique("ai_usage_daily_org_project_day_feature_unique")
    .on(table.orgId, table.projectId, table.day, table.feature)
    .nullsNotDistinct(),
  aiUsageDailyOrgDayIdx: index("ai_usage_daily_org_day_idx").on(table.orgId, table.day),
  aiUsageDailyOrgProjectDayIdx: index("ai_usage_daily_org_project_day_idx").on(
    table.orgId,
    table.projectId,
    table.day,
  ),
  aiUsageDailyProjectFk: foreignKey({
    name: "ai_usage_daily_project_org_fk",
    columns: [table.projectId, table.orgId],
    foreignColumns: [projects.id, projects.orgId],
  }),
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
  /** Sem valor no INSERT, o trigger usa o projeto do agente. */
  projectId: text("project_id").notNull().$defaultFn(filledByTrigger),
  /** Sem valor no INSERT, o trigger usa o ambiente prod do projeto (D-E1-2). */
  environmentId: text("environment_id").notNull().$defaultFn(filledByTrigger),
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
  agentApiKeysOrgProjectEnvIdx: index("agent_api_keys_org_project_env_idx").on(
    table.orgId,
    table.projectId,
    table.environmentId,
  ),
  agentApiKeysAgentProjectFk: foreignKey({
    name: "agent_api_keys_agent_project_fk",
    columns: [table.agentId, table.projectId, table.orgId],
    foreignColumns: [agents.id, agents.projectId, agents.orgId],
  }),
  agentApiKeysEnvironmentFk: foreignKey({
    name: "agent_api_keys_environment_fk",
    columns: [table.environmentId, table.projectId, table.orgId],
    foreignColumns: [environments.id, environments.projectId, environments.orgId],
  }),
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

// --- Professional development-plan decisions --------------------------------
// The Workforce OS can review a professional before or after formal admission.
// `professionalRef` therefore remains stable for discovered/demo records while
// `agentId`, when available, links the decision to the admitted runtime identity.
// Decisions are append-only so approval, adjustment and rejection remain
// auditable instead of overwriting the previous management judgment.
export const professionalPlanDecisions = pgTable("professional_plan_decisions", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  professionalRef: text("professional_ref").notNull(),
  professionalName: text("professional_name").notNull(),
  recommendation: text("recommendation").notNull(),
  decision: text("decision").$type<ProfessionalPlanDecisionType>().notNull(),
  reason: text("reason").notNull(),
  owner: text("owner").notNull(),
  decidedBy: text("decided_by").notNull(),
  actions: jsonb("actions").$type<ProfessionalPlanAction[]>().notNull().default([]),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  professionalPlanOrgRefIdx: index("professional_plan_org_ref_idx").on(
    table.orgId,
    table.professionalRef,
    table.decidedAt,
  ),
  professionalPlanAgentIdx: index("professional_plan_agent_idx").on(table.agentId),
}));
