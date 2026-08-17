CREATE TABLE "journey_events" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"external_event_id" text,
	"run_id" text NOT NULL,
	"step_id" text,
	"agent_id" text,
	"kind" text NOT NULL,
	"from_step_id" text,
	"to_step_id" text,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"cost_cents" integer,
	"success" integer,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "journey_handoffs" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"from_step_id" text NOT NULL,
	"to_step_id" text NOT NULL,
	"condition" text DEFAULT 'success' NOT NULL,
	"protocol" text DEFAULT 'a2a' NOT NULL,
	"required_context" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"step_key" text NOT NULL,
	"name" text NOT NULL,
	"sequence" integer NOT NULL,
	"step_type" text DEFAULT 'agent' NOT NULL,
	"agent_id" text,
	"responsibility" text DEFAULT '' NOT NULL,
	"decision_mode" text DEFAULT 'autonomous' NOT NULL,
	"expected_duration_ms" integer,
	"required" integer DEFAULT 1 NOT NULL,
	"guardrails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"entry_criterion" text DEFAULT '' NOT NULL,
	"success_criterion" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sla_minutes" integer DEFAULT 60 NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journeys_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_step_id_journey_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."journey_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_from_step_id_journey_steps_id_fk" FOREIGN KEY ("from_step_id") REFERENCES "public"."journey_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_to_step_id_journey_steps_id_fk" FOREIGN KEY ("to_step_id") REFERENCES "public"."journey_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_handoffs" ADD CONSTRAINT "journey_handoffs_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_handoffs" ADD CONSTRAINT "journey_handoffs_from_step_id_journey_steps_id_fk" FOREIGN KEY ("from_step_id") REFERENCES "public"."journey_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_handoffs" ADD CONSTRAINT "journey_handoffs_to_step_id_journey_steps_id_fk" FOREIGN KEY ("to_step_id") REFERENCES "public"."journey_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journey_events_external_idx" ON "journey_events" USING btree ("journey_id","external_event_id");--> statement-breakpoint
CREATE INDEX "journey_events_timeline_idx" ON "journey_events" USING btree ("journey_id","ts");--> statement-breakpoint
CREATE INDEX "journey_events_run_idx" ON "journey_events" USING btree ("journey_id","run_id");--> statement-breakpoint
CREATE INDEX "journey_events_step_idx" ON "journey_events" USING btree ("step_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_handoffs_path_idx" ON "journey_handoffs" USING btree ("journey_id","from_step_id","to_step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_steps_journey_key_idx" ON "journey_steps" USING btree ("journey_id","step_key");--> statement-breakpoint
CREATE INDEX "journey_steps_journey_sequence_idx" ON "journey_steps" USING btree ("journey_id","sequence");--> statement-breakpoint
CREATE INDEX "journeys_team_idx" ON "journeys" USING btree ("team_id");