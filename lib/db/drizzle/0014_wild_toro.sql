-- Versioned executive snapshots and auditable insight ledger.
-- Metrics remain deterministic; AI may only enrich narrative fields.

CREATE TABLE "executive_report_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"period" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"executive_summary" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"layer_comparison" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"portfolio" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quality" jsonb NOT NULL,
	"narrative_source" text DEFAULT 'deterministic' NOT NULL,
	"narrative_model" text,
	"prompt_version" text,
	"source_watermark" timestamp with time zone,
	"generated_by" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_records" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"report_id" text,
	"period" text NOT NULL,
	"entity_type" text DEFAULT 'organization' NOT NULL,
	"entity_id" text,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"narrative" text NOT NULL,
	"recommendation" text DEFAULT '' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generation_method" text DEFAULT 'rules' NOT NULL,
	"model" text,
	"prompt_version" text,
	"status" text DEFAULT 'generated' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "executive_report_snapshots" ADD CONSTRAINT "executive_report_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight_records" ADD CONSTRAINT "insight_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight_records" ADD CONSTRAINT "insight_records_report_id_executive_report_snapshots_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."executive_report_snapshots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "executive_reports_org_period_version_idx" ON "executive_report_snapshots" USING btree ("org_id","period","version");
--> statement-breakpoint
CREATE INDEX "executive_reports_org_period_idx" ON "executive_report_snapshots" USING btree ("org_id","period","generated_at");
--> statement-breakpoint
CREATE INDEX "insight_records_org_period_idx" ON "insight_records" USING btree ("org_id","period","generated_at");
--> statement-breakpoint
CREATE INDEX "insight_records_report_idx" ON "insight_records" USING btree ("report_id");
--> statement-breakpoint
CREATE INDEX "insight_records_entity_idx" ON "insight_records" USING btree ("org_id","entity_type","entity_id");
