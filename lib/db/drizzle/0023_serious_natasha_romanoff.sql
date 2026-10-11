CREATE TABLE "agent_event_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"agent_event_id" text NOT NULL,
	"task_run_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"step_key" text NOT NULL,
	"step_version" text,
	"input_fingerprint" text NOT NULL,
	"output_hash" text NOT NULL,
	"path" text NOT NULL,
	"model" text,
	"shadow" boolean NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_cents" integer,
	"currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_event_steps" ADD CONSTRAINT "agent_event_steps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_event_steps" ADD CONSTRAINT "agent_event_steps_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_event_steps" ADD CONSTRAINT "agent_event_steps_agent_event_id_agent_events_id_fk" FOREIGN KEY ("agent_event_id") REFERENCES "public"."agent_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_event_steps_event_step_key_idx" ON "agent_event_steps" USING btree ("agent_event_id","step_key");--> statement-breakpoint
CREATE INDEX "agent_event_steps_org_agent_key_occurred_idx" ON "agent_event_steps" USING btree ("org_id","agent_id","step_key","occurred_at");--> statement-breakpoint
CREATE INDEX "agent_event_steps_org_key_fingerprint_occurred_idx" ON "agent_event_steps" USING btree ("org_id","step_key","input_fingerprint","occurred_at");--> statement-breakpoint
CREATE INDEX "agent_event_steps_shadow_occurred_idx" ON "agent_event_steps" USING btree ("org_id","agent_id","step_key","occurred_at") WHERE "agent_event_steps"."shadow" = true;