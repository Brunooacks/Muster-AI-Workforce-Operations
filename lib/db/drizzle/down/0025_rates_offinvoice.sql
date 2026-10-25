-- Down da 0025 (custo-hora e custos fora da fatura). Aplicação manual, nunca
-- pelo migrator:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f lib/db/drizzle/down/0025_rates_offinvoice.sql
-- Os valores cadastrados SE PERDEM (exporte antes: `COPY role_rates TO …` e
-- `COPY off_invoice_costs TO …`). Snapshots já fechados (0026) guardam o
-- custo-hora que usaram, então o down da 0025 só roda depois do down da 0026.

DROP TABLE IF EXISTS "off_invoice_costs";--> statement-breakpoint
DROP TABLE IF EXISTS "role_rates";--> statement-breakpoint

-- Tira a 0025 do registro do migrator (created_at = "when" do _journal.json).
DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1792899094881;
