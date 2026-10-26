-- Down da 0023 (agent_events no formato do envelope). Aplicação manual, nunca
-- pelo migrator:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f lib/db/drizzle/down/0024_agent_events_outcome.sql
-- Ordem inversa da up. Os eventos são preservados; só as colunas novas saem
-- (os campos de tarefa/aceite gravados depois da 0023 se perdem — exporte antes
-- se precisar deles). Eventos human_review continuam como linhas com kind
-- 'human_review', que o código anterior à cunha ignora.

DROP INDEX IF EXISTS "agent_events_org_run_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "agent_events_task_attempt_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "agent_events_org_project_env_ts_idx";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_human_minutes_check";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_rework_count_check";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_auto_needs_rule_version";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_accepted_by_kind_check";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_attempt_check";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_environment_needs_project";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_environment_fk";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_project_org_fk";--> statement-breakpoint
ALTER TABLE "agent_events" DROP CONSTRAINT IF EXISTS "agent_events_agent_project_org_fk";--> statement-breakpoint
DROP TRIGGER IF EXISTS "agent_events_scope_trg" ON "agent_events";--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_agent_event_scope"();--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "model";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "context_tokens";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "human_minutes";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "rework_count";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "capabilities";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "accepted_at";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "accepted_rule_version";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "accepted_by_kind";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "accepted_by";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "actual";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "expected";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "retry_of";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "attempt";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "run_id";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "task_id";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "environment_id";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint
ALTER TABLE "agent_events" DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint

-- Tira a 0023 do registro do migrator (created_at = "when" do _journal.json),
-- para que um `migrate` seguinte a reaplique (up → down → up).
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1792889358830;
