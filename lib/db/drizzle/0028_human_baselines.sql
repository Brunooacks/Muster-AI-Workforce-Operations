CREATE TABLE "human_baselines" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"task_type" text NOT NULL,
	"agent_id" text,
	"human_minutes_per_task" numeric(8, 2) NOT NULL,
	"human_accuracy_rate" numeric(5, 2) NOT NULL,
	"human_escalation_rate" numeric(5, 2) NOT NULL,
	"measurement_kind" text DEFAULT 'measured' NOT NULL,
	"measured_at" date,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "human_baselines_minutes_check" CHECK ("human_minutes_per_task" >= 0),
	CONSTRAINT "human_baselines_accuracy_check" CHECK ("human_accuracy_rate" >= 0 AND "human_accuracy_rate" <= 100),
	CONSTRAINT "human_baselines_escalation_check" CHECK ("human_escalation_rate" >= 0 AND "human_escalation_rate" <= 100),
	CONSTRAINT "human_baselines_measurement_kind_check" CHECK ("measurement_kind" IN ('measured', 'estimated'))
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "task_type" text;--> statement-breakpoint
ALTER TABLE "human_baselines" ADD CONSTRAINT "human_baselines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_baselines" ADD CONSTRAINT "human_baselines_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "human_baselines_org_task_idx" ON "human_baselines" USING btree ("org_id",lower(trim("task_type"))) WHERE "agent_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "human_baselines_org_agent_idx" ON "human_baselines" USING btree ("org_id","agent_id") WHERE "agent_id" IS NOT NULL;