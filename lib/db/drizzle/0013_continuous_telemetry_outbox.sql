-- Durable tenant-aware queue for continuous telemetry projections.
-- Producers write event_outbox in the same transaction as agent_events;
-- workers use FOR UPDATE SKIP LOCKED and never infer tenant from payload.

CREATE TABLE IF NOT EXISTS "event_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "priority" text DEFAULT 'normal' NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "processed_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "event_outbox_status_check"
    CHECK ("status" IN ('pending', 'processing', 'completed', 'dead-letter')),
  CONSTRAINT "event_outbox_priority_check"
    CHECK ("priority" IN ('critical', 'high', 'normal', 'low')),
  CONSTRAINT "event_outbox_attempts_check" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_outbox" ADD CONSTRAINT "event_outbox_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_outbox_claim_idx"
  ON "event_outbox" ("status", "available_at", "priority", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_outbox_org_activity_idx"
  ON "event_outbox" ("org_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_outbox_aggregate_idx"
  ON "event_outbox" ("org_id", "aggregate_type", "aggregate_id", "created_at");
