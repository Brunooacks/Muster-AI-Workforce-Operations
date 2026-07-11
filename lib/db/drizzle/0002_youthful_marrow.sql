CREATE TABLE "agent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'execution' NOT NULL,
	"duration_ms" integer,
	"cost_cents" integer,
	"tokens_in" integer,
	"tokens_out" integer,
	"success" integer,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "connector_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"auth_method" text DEFAULT 'token' NOT NULL,
	"credential" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_credentials_connector_id_unique" UNIQUE("connector_id")
);
--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_credentials" ADD CONSTRAINT "connector_credentials_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;