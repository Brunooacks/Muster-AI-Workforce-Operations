DROP INDEX IF EXISTS "agent_events_agent_task_run_idx";
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "task_run_id";
