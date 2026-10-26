-- Down da 0022 (projetos e ambientes). Aplicação manual, nunca pelo migrator:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f lib/db/drizzle/down/0023_projects_envs.sql
-- Ordem inversa da up. Agentes, chaves e eventos são preservados; só as
-- colunas e tabelas novas saem. Runbook: docs/runbooks/0022-projects-envs.md.

-- Triggers e funções de compatibilidade.
DROP TRIGGER IF EXISTS "agent_api_keys_scope_trg" ON "agent_api_keys";--> statement-breakpoint
DROP TRIGGER IF EXISTS "agents_default_project_trg" ON "agents";--> statement-breakpoint
DROP TRIGGER IF EXISTS "organizations_default_project_trg" ON "organizations";--> statement-breakpoint
DROP TRIGGER IF EXISTS "projects_environments_trg" ON "projects";--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_agent_api_key_scope"();--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_agent_default_project"();--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_org_default_project"();--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_project_environments"();--> statement-breakpoint

-- ai_usage_daily: junta as linhas do mesmo (org, dia, feature) que a 0022
-- separou por projeto, para o único antigo voltar sem conflito. Os totais por
-- organização não mudam.
DROP INDEX IF EXISTS "ai_usage_daily_org_project_day_idx";--> statement-breakpoint
ALTER TABLE "ai_usage_daily" DROP CONSTRAINT IF EXISTS "ai_usage_daily_org_project_day_feature_unique";--> statement-breakpoint
ALTER TABLE "ai_usage_daily" DROP CONSTRAINT IF EXISTS "ai_usage_daily_project_org_fk";--> statement-breakpoint
CREATE TEMP TABLE "ai_usage_daily_down_0022" AS
SELECT "org_id", "day", "feature",
	sum("calls")::integer AS "calls",
	sum("input_tokens")::integer AS "input_tokens",
	sum("output_tokens")::integer AS "output_tokens",
	sum("est_cost_usd")::double precision AS "est_cost_usd"
FROM "ai_usage_daily"
GROUP BY "org_id", "day", "feature";--> statement-breakpoint
DELETE FROM "ai_usage_daily";--> statement-breakpoint
ALTER TABLE "ai_usage_daily" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint
INSERT INTO "ai_usage_daily" ("org_id", "day", "feature", "calls", "input_tokens", "output_tokens", "est_cost_usd")
SELECT "org_id", "day", "feature", "calls", "input_tokens", "output_tokens", "est_cost_usd"
FROM "ai_usage_daily_down_0022";--> statement-breakpoint
DROP TABLE "ai_usage_daily_down_0022";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_usage_daily_org_day_feature_idx" ON "ai_usage_daily" USING btree ("org_id","day","feature");--> statement-breakpoint

-- event_outbox
DROP INDEX IF EXISTS "event_outbox_org_project_env_idx";--> statement-breakpoint
ALTER TABLE "event_outbox" DROP CONSTRAINT IF EXISTS "event_outbox_environment_needs_project";--> statement-breakpoint
ALTER TABLE "event_outbox" DROP CONSTRAINT IF EXISTS "event_outbox_environment_fk";--> statement-breakpoint
ALTER TABLE "event_outbox" DROP CONSTRAINT IF EXISTS "event_outbox_project_org_fk";--> statement-breakpoint
ALTER TABLE "event_outbox" DROP COLUMN IF EXISTS "environment_id";--> statement-breakpoint
ALTER TABLE "event_outbox" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint

-- agent_api_keys
DROP INDEX IF EXISTS "agent_api_keys_org_project_env_idx";--> statement-breakpoint
ALTER TABLE "agent_api_keys" DROP CONSTRAINT IF EXISTS "agent_api_keys_environment_fk";--> statement-breakpoint
ALTER TABLE "agent_api_keys" DROP CONSTRAINT IF EXISTS "agent_api_keys_agent_project_fk";--> statement-breakpoint
ALTER TABLE "agent_api_keys" DROP COLUMN IF EXISTS "environment_id";--> statement-breakpoint
ALTER TABLE "agent_api_keys" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint

-- agents
DROP INDEX IF EXISTS "agents_org_project_idx";--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_project_org_fk";--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_id_project_org_unique";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint

-- Tabelas novas (environments antes de projects por causa da FK).
DROP TABLE IF EXISTS "environments";--> statement-breakpoint
DROP TABLE IF EXISTS "projects";--> statement-breakpoint

-- Tira a 0022 do registro do migrator (created_at = "when" do _journal.json),
-- para que um `migrate` seguinte a reaplique (up → down → up).
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1792887114875;
