DROP TABLE IF EXISTS "connector_api_keys" CASCADE;
ALTER TABLE "connectors" DROP COLUMN IF EXISTS "mode";
ALTER TABLE "connectors" DROP COLUMN IF EXISTS "health";
ALTER TABLE "connectors" DROP COLUMN IF EXISTS "last_tested_at";
ALTER TABLE "connectors" DROP COLUMN IF EXISTS "last_event_at";
