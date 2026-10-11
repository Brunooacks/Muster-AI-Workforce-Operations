CREATE TABLE "connector_sync_cursors" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"watermark" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_sync_cursors" ADD CONSTRAINT "connector_sync_cursors_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connector_sync_cursors" ADD CONSTRAINT "connector_sync_cursors_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "connector_sync_cursors_org_connector_idx" ON "connector_sync_cursors" USING btree ("org_id","connector_id");
--> statement-breakpoint
CREATE INDEX "connector_sync_cursors_connector_idx" ON "connector_sync_cursors" USING btree ("connector_id");
