CREATE TABLE "metric_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"metric_key" text NOT NULL,
	"label" text NOT NULL,
	"agent_id" text,
	"team_id" text,
	"purpose_id" text,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"kind" text NOT NULL,
	"source" jsonb NOT NULL,
	"lineage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" double precision NOT NULL,
	"sample_size" integer,
	"quality_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metric_evidence" ADD CONSTRAINT "metric_evidence_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_evidence" ADD CONSTRAINT "metric_evidence_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_evidence" ADD CONSTRAINT "metric_evidence_purpose_id_purposes_id_fk" FOREIGN KEY ("purpose_id") REFERENCES "public"."purposes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "metric_evidence_metric_key_idx" ON "metric_evidence" USING btree ("metric_key");