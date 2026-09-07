CREATE TABLE "professional_plan_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"professional_ref" text NOT NULL,
	"professional_name" text NOT NULL,
	"recommendation" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"owner" text NOT NULL,
	"decided_by" text NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_review_at" timestamp with time zone,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "professional_plan_decisions" ADD CONSTRAINT "professional_plan_decisions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_plan_decisions" ADD CONSTRAINT "professional_plan_decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professional_plan_org_ref_idx" ON "professional_plan_decisions" USING btree ("org_id","professional_ref","decided_at");--> statement-breakpoint
CREATE INDEX "professional_plan_agent_idx" ON "professional_plan_decisions" USING btree ("agent_id");