ALTER TABLE "agent_events" ADD COLUMN "task_run_id" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "currency" text;--> statement-breakpoint
CREATE INDEX "agent_events_agent_task_run_idx" ON "agent_events" USING btree ("agent_id","task_run_id");