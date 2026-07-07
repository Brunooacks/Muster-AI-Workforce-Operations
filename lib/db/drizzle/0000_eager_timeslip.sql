CREATE TABLE "agent_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"platform" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"should_do" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"should_not_do" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"autonomy_level" text DEFAULT 'escalates' NOT NULL,
	"autonomy_notes" text,
	"limits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"business_case" jsonb DEFAULT '{"baseline":"","targetPayback":"","description":""}'::jsonb NOT NULL,
	"proposed_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"enrichment_status" text DEFAULT 'pending' NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"promoted_agent_id" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_identities" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"should_do" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"should_not_do" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"autonomy_level" text DEFAULT 'escalates' NOT NULL,
	"autonomy_notes" text,
	"limits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"business_case" jsonb DEFAULT '{"baseline":"","targetPayback":"","actualPayback":"","description":""}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_owners" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"business_owner" text DEFAULT '' NOT NULL,
	"technical_owner" text DEFAULT '' NOT NULL,
	"governance_sponsor" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"role" text NOT NULL,
	"platform" text NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"status" text DEFAULT 'observation' NOT NULL,
	"avatar_url" text,
	"bio" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"monthly_volume" integer DEFAULT 0 NOT NULL,
	"headline_kpis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_verdict" text DEFAULT 'observation' NOT NULL,
	"verdict_confidence" double precision DEFAULT 0 NOT NULL,
	"severity" text DEFAULT 'stable' NOT NULL,
	"health_score" double precision DEFAULT 0 NOT NULL,
	"active_alerts" integer DEFAULT 0 NOT NULL,
	"monthly_value" double precision DEFAULT 0 NOT NULL,
	"monthly_cost" double precision DEFAULT 0 NOT NULL,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"pattern" text NOT NULL,
	"pattern_type" text DEFAULT '' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"hypothesis" text DEFAULT '' NOT NULL,
	"recommendation" text DEFAULT '' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"agents_discovered" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"last_sync_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_discovered" integer DEFAULT 0 NOT NULL,
	"drafts_created" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window" text DEFAULT '30d' NOT NULL,
	"layers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" text DEFAULT 'observation' NOT NULL,
	"verdict_confidence" double precision DEFAULT 0 NOT NULL,
	"rationale" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_points" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"efficacy" double precision DEFAULT 0 NOT NULL,
	"efficiency" double precision DEFAULT 0 NOT NULL,
	"adoption" double precision DEFAULT 0 NOT NULL,
	"governance" double precision DEFAULT 0 NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"verdict" text DEFAULT 'observation' NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"execution_window" text DEFAULT '' NOT NULL,
	"suggested_sponsor" text DEFAULT '' NOT NULL,
	"next_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_drafts" ADD CONSTRAINT "agent_drafts_run_id_discovery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."discovery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_drafts" ADD CONSTRAINT "agent_drafts_promoted_agent_id_agents_id_fk" FOREIGN KEY ("promoted_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_identities" ADD CONSTRAINT "agent_identities_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_owners" ADD CONSTRAINT "agent_owners_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_points" ADD CONSTRAINT "metric_points_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;