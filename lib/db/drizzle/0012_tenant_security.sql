-- Tenant security hardening (gauntlet tenancy/security).
--
-- 1. Materializa org_id em evidências para que isolamento não dependa de uma
--    referência opcional a agente/time/propósito.
-- 2. Torna catálogo e jornadas reutilizáveis entre organizações.
-- 3. Cria uma fronteira de idempotência explícita para ingestão externa.
-- 4. Adiciona índices das janelas quentes de telemetria/evidência.

ALTER TABLE "metric_evidence" ADD COLUMN IF NOT EXISTS "org_id" text;
--> statement-breakpoint

-- Falha antes do backfill se uma linha antiga combinar referências de tenants
-- diferentes. Escolher uma delas silenciosamente preservaria um vazamento.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "metric_evidence" me
    LEFT JOIN "agents" a ON a."id" = me."agent_id"
    LEFT JOIN "teams" t ON t."id" = me."team_id"
    LEFT JOIN "purposes" p ON p."id" = me."purpose_id"
    WHERE
      (a."org_id" IS NOT NULL AND t."org_id" IS NOT NULL AND a."org_id" <> t."org_id") OR
      (a."org_id" IS NOT NULL AND p."org_id" IS NOT NULL AND a."org_id" <> p."org_id") OR
      (t."org_id" IS NOT NULL AND p."org_id" IS NOT NULL AND t."org_id" <> p."org_id") OR
      (me."org_id" IS NOT NULL AND a."org_id" IS NOT NULL AND me."org_id" <> a."org_id") OR
      (me."org_id" IS NOT NULL AND t."org_id" IS NOT NULL AND me."org_id" <> t."org_id") OR
      (me."org_id" IS NOT NULL AND p."org_id" IS NOT NULL AND me."org_id" <> p."org_id")
  ) THEN
    RAISE EXCEPTION 'metric_evidence contém referências cruzadas entre organizações; corrija antes de migrar';
  END IF;
END $$;
--> statement-breakpoint

UPDATE "metric_evidence" me
SET "org_id" = COALESCE(
  (SELECT a."org_id" FROM "agents" a WHERE a."id" = me."agent_id"),
  (SELECT t."org_id" FROM "teams" t WHERE t."id" = me."team_id"),
  (SELECT p."org_id" FROM "purposes" p WHERE p."id" = me."purpose_id"),
  'org_default'
)
WHERE me."org_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "metric_evidence" ALTER COLUMN "org_id" SET NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "metric_evidence" ADD CONSTRAINT "metric_evidence_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

ALTER TABLE "catalog_metrics" DROP CONSTRAINT IF EXISTS "catalog_metrics_key_unique";
--> statement-breakpoint
ALTER TABLE "journeys" DROP CONSTRAINT IF EXISTS "journeys_slug_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_metrics_org_key_idx"
  ON "catalog_metrics" ("org_id", "key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "journeys_org_slug_idx"
  ON "journeys" ("org_id", "slug");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_events_agent_ts_idx"
  ON "agent_events" ("agent_id", "ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "metric_evidence_org_agent_metric_captured_idx"
  ON "metric_evidence" ("org_id", "agent_id", "metric_key", "captured_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "external_event_receipts" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "platform" text NOT NULL,
  "event_id" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "external_event_receipts" ADD CONSTRAINT "external_event_receipts_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "external_event_receipts" ADD CONSTRAINT "external_event_receipts_agent_id_agents_id_fk"
    FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_event_receipts_dedupe_idx"
  ON "external_event_receipts" ("org_id", "platform", "event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_event_receipts_agent_idx"
  ON "external_event_receipts" ("agent_id");
