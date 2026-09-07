-- Reversão estrutural da 0012. Pode falhar ao restaurar unicidade global caso
-- organizações diferentes já tenham criado a mesma key/slug — comportamento
-- intencional para não apagar dados silenciosamente.

DROP TABLE IF EXISTS "external_event_receipts";
DROP INDEX IF EXISTS "metric_evidence_org_agent_metric_captured_idx";
DROP INDEX IF EXISTS "agent_events_agent_ts_idx";
DROP INDEX IF EXISTS "journeys_org_slug_idx";
DROP INDEX IF EXISTS "catalog_metrics_org_key_idx";

ALTER TABLE "catalog_metrics" ADD CONSTRAINT "catalog_metrics_key_unique" UNIQUE("key");
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_slug_unique" UNIQUE("slug");

ALTER TABLE "metric_evidence" DROP CONSTRAINT IF EXISTS "metric_evidence_org_id_organizations_id_fk";
ALTER TABLE "metric_evidence" DROP COLUMN IF EXISTS "org_id";
