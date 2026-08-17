CREATE TABLE "journey_recommendation_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"recommendation_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"actor_type" text NOT NULL,
	"agent_id" text,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"capability" text NOT NULL,
	"execution_mode" text NOT NULL,
	"control_scope" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"sla_minutes" integer DEFAULT 60 NOT NULL,
	"due_at" timestamp with time zone,
	"result" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"run_id" text,
	"step_id" text,
	"agent_id" text,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"expected_impact" text DEFAULT '' NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'system' NOT NULL,
	"review_sla_minutes" integer DEFAULT 240 NOT NULL,
	"review_due_at" timestamp with time zone NOT NULL,
	"decision_reason" text,
	"rejection_disposition" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journey_recommendation_actions" ADD CONSTRAINT "journey_recommendation_actions_recommendation_id_journey_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."journey_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_recommendation_actions" ADD CONSTRAINT "journey_recommendation_actions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_recommendations" ADD CONSTRAINT "journey_recommendations_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_recommendations" ADD CONSTRAINT "journey_recommendations_step_id_journey_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."journey_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_recommendations" ADD CONSTRAINT "journey_recommendations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journey_recommendation_actions_order_idx" ON "journey_recommendation_actions" USING btree ("recommendation_id","sequence");--> statement-breakpoint
CREATE INDEX "journey_recommendation_actions_due_idx" ON "journey_recommendation_actions" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "journey_recommendations_journey_idx" ON "journey_recommendations" USING btree ("journey_id","created_at");--> statement-breakpoint
CREATE INDEX "journey_recommendations_status_idx" ON "journey_recommendations" USING btree ("status","review_due_at");