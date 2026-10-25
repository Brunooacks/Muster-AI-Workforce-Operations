-- Down da 0024 (contrato numérico versionado). Aplicação manual, nunca pelo
-- migrator:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f lib/db/drizzle/down/0024_agent_contracts.sql
-- Ordem inversa da up. Os contratos versionados SE PERDEM (exporte antes:
-- `COPY agent_contracts TO …`); vereditos ficam, sem contract_id/version.
-- business_case nunca foi alterado pela 0024, então não há o que restaurar.

DROP TRIGGER IF EXISTS "verdicts_contract_trg" ON "verdicts";--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_verdict_contract"();--> statement-breakpoint
ALTER TABLE "verdicts" DROP CONSTRAINT IF EXISTS "verdicts_contract_fk";--> statement-breakpoint
ALTER TABLE "verdicts" DROP COLUMN IF EXISTS "contract_version";--> statement-breakpoint
ALTER TABLE "verdicts" DROP COLUMN IF EXISTS "contract_id";--> statement-breakpoint
DROP TRIGGER IF EXISTS "agent_contracts_immutable_trg" ON "agent_contracts";--> statement-breakpoint
DROP FUNCTION IF EXISTS "muster_agent_contracts_immutable"();--> statement-breakpoint
DROP TABLE IF EXISTS "agent_contracts";--> statement-breakpoint

-- Tira a 0024 do registro do migrator (created_at = "when" do _journal.json).
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1792890019675;
