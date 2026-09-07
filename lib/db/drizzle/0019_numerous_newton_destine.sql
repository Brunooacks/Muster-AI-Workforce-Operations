CREATE TABLE "agent_governance_assessments" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"status" text DEFAULT 'insufficient_data' NOT NULL,
	"direction_score" double precision DEFAULT 0 NOT NULL,
	"protection_score" double precision DEFAULT 0 NOT NULL,
	"proof_score" double precision DEFAULT 0 NOT NULL,
	"context_health_score" double precision,
	"hallucination_status" text DEFAULT 'not_measured' NOT NULL,
	"grounded_output_rate" double precision,
	"hallucination_flags" integer DEFAULT 0 NOT NULL,
	"audited_outputs" integer DEFAULT 0 NOT NULL,
	"regression_status" text DEFAULT 'insufficient_data' NOT NULL,
	"regression_attributable" boolean DEFAULT false NOT NULL,
	"input_drift" double precision,
	"baseline_release_id" text,
	"current_release_id" text,
	"signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"source_event_count" integer DEFAULT 0 NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_governance_assessments" ADD CONSTRAINT "agent_governance_assessments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_governance_assessments" ADD CONSTRAINT "agent_governance_assessments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_governance_assessments_org_status_idx" ON "agent_governance_assessments" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "agent_governance_assessments_org_assessed_idx" ON "agent_governance_assessments" USING btree ("org_id","assessed_at");