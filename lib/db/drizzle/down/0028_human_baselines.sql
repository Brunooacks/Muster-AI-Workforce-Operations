-- Down da 0028 (baseline humano por tipo de tarefa, MUS-195). Aplicação manual,
-- nunca pelo migrator:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f lib/db/drizzle/down/0028_human_baselines.sql

DROP TABLE IF EXISTS "human_baselines";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN IF EXISTS "task_type";--> statement-breakpoint

-- Tira a 0028 do registro do migrator (created_at = "when" do _journal.json).
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1795628924163;
