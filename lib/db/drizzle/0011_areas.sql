-- Áreas: a estrutura interna da organização (gauntlet rodada 7).
--
-- A organização isola; a área organiza. Um piloto roda dentro de UMA empresa que
-- tem Atendimento, Financeiro, Engenharia — cada uma com dono e orçamento. Sem
-- esse nível, a frota é uma lista plana que nenhum gestor reconhece como sua.
--
-- Reversível: lib/db/drizzle/down/0011_areas.sql

CREATE TABLE IF NOT EXISTS "areas" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "leader" text DEFAULT '' NOT NULL,
  "cost_center" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "areas" ADD CONSTRAINT "areas_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Slug único POR organização, não globalmente: duas empresas podem ter
-- "financeiro" sem colidir. Mesma decisão já tomada para agents/teams em 0009.
CREATE UNIQUE INDEX IF NOT EXISTS "areas_org_slug_idx" ON "areas" ("org_id","slug");
CREATE INDEX IF NOT EXISTS "areas_org_idx" ON "areas" ("org_id");

-- Nulo permitido: agente descoberto por varredura entra sem dono, e a tela
-- precisa poder mostrá-lo como "sem área" em vez de recusar o cadastro.
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "area_id" text;

DO $$ BEGIN
  ALTER TABLE "agents" ADD CONSTRAINT "agents_area_id_areas_id_fk"
    FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "agents_area_idx" ON "agents" ("area_id");
