CREATE TABLE "agent_connector_links" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"external_id" text NOT NULL,
	"role" text DEFAULT 'primary' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_connector_links" ADD CONSTRAINT "agent_connector_links_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connector_links" ADD CONSTRAINT "agent_connector_links_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connector_links" ADD CONSTRAINT "agent_connector_links_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_connector_links_agent_connector_idx" ON "agent_connector_links" USING btree ("agent_id","connector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_connector_links_connector_external_idx" ON "agent_connector_links" USING btree ("connector_id","external_id");--> statement-breakpoint
CREATE INDEX "agent_connector_links_org_idx" ON "agent_connector_links" USING btree ("org_id");