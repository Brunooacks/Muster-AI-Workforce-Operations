-- Reversão do multi-tenant: devolve as entidades ao estado global.
-- Só é segura enquanto existir uma única organização; com duas ou mais, os
-- índices únicos globais abaixo colidem — e essa colisão é intencional, para
-- impedir uma reversão que fundiria dados de clientes diferentes.

DROP INDEX IF EXISTS "agents_org_slug_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "agents_org_external_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "agents_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "teams_org_slug_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "teams_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "purposes_org_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "purposes_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "connectors_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "journeys_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "catalog_metrics_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "discovery_runs_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "agent_drafts_org_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "agent_api_keys_org_idx";--> statement-breakpoint

ALTER TABLE "agents"   ADD CONSTRAINT "agents_slug_unique"        UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "agents"   ADD CONSTRAINT "agents_external_id_unique" UNIQUE("external_id");--> statement-breakpoint
ALTER TABLE "teams"    ADD CONSTRAINT "teams_slug_unique"         UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "purposes" ADD CONSTRAINT "purposes_key_unique"       UNIQUE("key");--> statement-breakpoint

ALTER TABLE "purposes"        DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "teams"           DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "agents"          DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "connectors"      DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "journeys"        DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "catalog_metrics" DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "discovery_runs"  DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "agent_drafts"    DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "agent_api_keys"  DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint

DROP TABLE IF EXISTS "organization_members";--> statement-breakpoint
DROP TABLE IF EXISTS "organizations";
