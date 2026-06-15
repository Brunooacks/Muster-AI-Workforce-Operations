import { randomUUID } from "crypto";
import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

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

export const agents = pgTable("agents", {
  id: id(),
  externalId: text("external_id").unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  role: text("role").notNull(),
  platform: text("platform").notNull(),
  version: text("version").notNull().default("1.0.0"),
  status: text("status").$type<AgentStatus>().notNull().default("observation"),
  avatarUrl: text("avatar_url"),
  bio: text("bio").notNull().default(""),
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
});

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
});

export type ConnectorStatus = "connected" | "available" | "syncing";

export const connectors = pgTable("connectors", {
  id: id(),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  status: text("status")
    .$type<ConnectorStatus>()
    .notNull()
    .default("available"),
  agentsDiscovered: integer("agents_discovered").notNull().default(0),
  category: text("category").notNull().default(""),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});

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
