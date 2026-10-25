-- Down da 0026 (snapshots de resultado). Aplicação manual, nunca pelo migrator:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f lib/db/drizzle/down/0026_outcome_snapshots.sql
-- Os snapshots fechados SE PERDEM (exporte antes: `COPY outcome_snapshots TO …`);
-- como guardam os próprios inputs, um export basta para reproduzir o cálculo.
-- Roda antes do down da 0025 e da 0024 (a FK de contrato aponta para a 0024).

DROP TRIGGER IF EXISTS "outcome_snapshots_immutable_trg" ON "outcome_snapshots";--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_outcome_snapshots_immutable"();--> statement-breakpoint
DROP TABLE IF EXISTS "outcome_snapshots";--> statement-breakpoint

-- Tira a 0026 do registro do migrator (created_at = "when" do _journal.json).
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1792899833796;
