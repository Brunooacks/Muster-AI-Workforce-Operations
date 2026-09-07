CREATE TABLE "connector_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"label" text,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "mode" text DEFAULT 'native' NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "health" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "last_tested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "last_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connector_api_keys" ADD CONSTRAINT "connector_api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_api_keys" ADD CONSTRAINT "connector_api_keys_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connector_api_keys_org_idx" ON "connector_api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_api_keys_prefix_idx" ON "connector_api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "connector_api_keys_connector_idx" ON "connector_api_keys" USING btree ("connector_id");--> statement-breakpoint
UPDATE "connectors"
SET
	"mode" = CASE WHEN "platform" = 'kubernetes-otel' THEN 'runtime' ELSE 'universal' END,
	"status" = 'configured',
	"health" = 'unverified',
	"last_event_at" = NULL
WHERE "platform" <> 'github';--> statement-breakpoint
UPDATE "connectors"
SET
	"mode" = 'native',
	"health" = CASE WHEN "status" = 'connected' THEN 'healthy' ELSE 'unverified' END,
	"last_tested_at" = "last_sync_at"
WHERE "platform" = 'github';
