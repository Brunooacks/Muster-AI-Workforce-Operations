-- Reversão de 0011_areas.sql
--
-- Destrutivo: derrubar a tabela apaga o recorte por área de toda a frota. A
-- coluna sai antes da tabela para que a FK não impeça o DROP.

ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_area_id_areas_id_fk";
DROP INDEX IF EXISTS "agents_area_idx";
ALTER TABLE "agents" DROP COLUMN IF EXISTS "area_id";

DROP INDEX IF EXISTS "areas_org_slug_idx";
DROP INDEX IF EXISTS "areas_org_idx";
DROP TABLE IF EXISTS "areas";
