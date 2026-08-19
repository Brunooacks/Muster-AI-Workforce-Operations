-- Tenancy (gauntlet rodada 4) — organizações como raiz de isolamento.
--
-- Escrita à mão, e não por `drizzle-kit generate`, porque adicionar uma coluna
-- NOT NULL em tabelas que já têm dados exige três passos: criar a coluna
-- anulável, preencher (backfill) e só então travar. O generate produz o ALTER
-- direto, que falharia em qualquer banco com frota existente.

CREATE TABLE IF NOT EXISTS "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_org_user_idx" ON "organization_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint

-- Organização de acolhimento: recebe tudo que existia antes do multi-tenant.
INSERT INTO "organizations" ("id", "name", "slug")
VALUES ('org_default', 'Organização padrão', 'default')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

-- Passo 1 e 2: coluna anulável + backfill para a organização de acolhimento.
ALTER TABLE "purposes"        ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "teams"           ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "agents"          ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "connectors"      ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "journeys"        ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "catalog_metrics" ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "discovery_runs"  ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "agent_drafts"    ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint
ALTER TABLE "agent_api_keys"  ADD COLUMN IF NOT EXISTS "org_id" text;--> statement-breakpoint

UPDATE "purposes"        SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "teams"           SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "agents"          SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "connectors"      SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "journeys"        SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "catalog_metrics" SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "discovery_runs"  SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "agent_drafts"    SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "agent_api_keys"  SET "org_id" = 'org_default' WHERE "org_id" IS NULL;--> statement-breakpoint

-- Passo 3: travar NOT NULL e amarrar a chave estrangeira.
ALTER TABLE "purposes"        ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams"           ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents"          ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors"      ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "journeys"        ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_metrics" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery_runs"  ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_drafts"    ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_api_keys"  ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "purposes"        ADD CONSTRAINT "purposes_org_id_fk"        FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "teams"           ADD CONSTRAINT "teams_org_id_fk"           FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "agents"          ADD CONSTRAINT "agents_org_id_fk"          FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "connectors"      ADD CONSTRAINT "connectors_org_id_fk"      FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "journeys"        ADD CONSTRAINT "journeys_org_id_fk"        FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "catalog_metrics" ADD CONSTRAINT "catalog_metrics_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "discovery_runs"  ADD CONSTRAINT "discovery_runs_org_id_fk"  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "agent_drafts"    ADD CONSTRAINT "agent_drafts_org_id_fk"    FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "agent_api_keys"  ADD CONSTRAINT "agent_api_keys_org_id_fk"  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;--> statement-breakpoint

-- Unicidade deixa de ser global e passa a ser por organização: duas empresas
-- diferentes podem ter um agente "triagem-n1" sem colidir.
ALTER TABLE "agents"   DROP CONSTRAINT IF EXISTS "agents_slug_unique";--> statement-breakpoint
ALTER TABLE "agents"   DROP CONSTRAINT IF EXISTS "agents_external_id_unique";--> statement-breakpoint
ALTER TABLE "teams"    DROP CONSTRAINT IF EXISTS "teams_slug_unique";--> statement-breakpoint
ALTER TABLE "purposes" DROP CONSTRAINT IF EXISTS "purposes_key_unique";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "agents_org_slug_idx"     ON "agents"   USING btree ("org_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_org_external_idx" ON "agents"   USING btree ("org_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS        "agents_org_idx"          ON "agents"   USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teams_org_slug_idx"      ON "teams"    USING btree ("org_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS        "teams_org_idx"           ON "teams"    USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purposes_org_key_idx"    ON "purposes" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS        "purposes_org_idx"        ON "purposes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connectors_org_idx"      ON "connectors"      USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journeys_org_idx"        ON "journeys"        USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_metrics_org_idx" ON "catalog_metrics" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovery_runs_org_idx"  ON "discovery_runs"  USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_drafts_org_idx"    ON "agent_drafts"    USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_api_keys_org_idx"  ON "agent_api_keys"  USING btree ("org_id");
