-- 0022 · conta > projeto > ambiente > chave (E1).
-- Gerada por drizzle-kit e reordenada à mão em três fases, na mesma migração
-- (o migrator roda tudo numa transação só):
--   1. cria tabelas e colunas novas, todas anuláveis;
--   2. backfill idempotente;
--   3. SET NOT NULL, FKs compostas e índices.
-- Down manual em lib/db/drizzle/down/0022_projects_envs.sql (fora do migrator).

-- ── Fase 1 · tabelas e colunas anuláveis ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_id_org_unique" UNIQUE("id","org_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_idx" ON "projects" USING btree ("org_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_default_idx" ON "projects" USING btree ("org_id") WHERE "is_default";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "environments_id_project_org_unique" UNIQUE("id","project_id","org_id"),
	CONSTRAINT "environments_kind_check" CHECK ("kind" IN ('sandbox', 'prod'))
);
--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_org_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "environments_project_kind_idx" ON "environments" USING btree ("project_id","kind");--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD COLUMN "environment_id" text;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD COLUMN "environment_id" text;--> statement-breakpoint
ALTER TABLE "ai_usage_daily" ADD COLUMN "project_id" text;--> statement-breakpoint

-- ── Fase 2 · backfill ──────────────────────────────────────────────────────
-- Tudo entre os marcadores é reexecutável: rodar duas vezes dá o mesmo estado
-- (backfill-0022.integration.test.ts roda o trecho de novo e compara).
-- >>> backfill-0022
-- Todo projeto nasce com sandbox e prod, inclusive os criados pelo backfill.
CREATE OR REPLACE FUNCTION "muster_project_environments"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO "environments" ("id", "org_id", "project_id", "kind")
	SELECT gen_random_uuid()::text, NEW."org_id", NEW."id", kind
	FROM unnest(ARRAY['sandbox', 'prod']) AS kind
	ON CONFLICT ("project_id", "kind") DO NOTHING;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "projects_environments_trg"
	AFTER INSERT ON "projects"
	FOR EACH ROW EXECUTE FUNCTION "muster_project_environments"();--> statement-breakpoint
-- 1 projeto "Padrão" por conta (inclusive conta sem agentes).
INSERT INTO "projects" ("id", "org_id", "name", "slug", "is_default")
SELECT gen_random_uuid()::text, o."id", 'Padrão', 'padrao', true
FROM "organizations" o
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Rede de segurança para projeto que exista sem os dois ambientes.
INSERT INTO "environments" ("id", "org_id", "project_id", "kind")
SELECT gen_random_uuid()::text, p."org_id", p."id", kind
FROM "projects" p CROSS JOIN unnest(ARRAY['sandbox', 'prod']) AS kind
ON CONFLICT ("project_id", "kind") DO NOTHING;--> statement-breakpoint
UPDATE "agents" a SET "project_id" = p."id"
FROM "projects" p
WHERE p."org_id" = a."org_id" AND p."is_default" AND a."project_id" IS NULL;--> statement-breakpoint
-- Chave herda o projeto do agente; toda chave existente é msk_live_ = prod (D-E1-2).
UPDATE "agent_api_keys" k SET "project_id" = a."project_id"
FROM "agents" a
WHERE a."id" = k."agent_id" AND k."project_id" IS NULL;--> statement-breakpoint
UPDATE "agent_api_keys" k SET "environment_id" = e."id"
FROM "environments" e
WHERE e."project_id" = k."project_id" AND e."kind" = 'prod' AND k."environment_id" IS NULL;--> statement-breakpoint
-- Outbox: só o que ainda vai ser processado ganha Padrão/prod; o histórico
-- processado (completed, dead-letter) fica NULL.
UPDATE "event_outbox" o SET "project_id" = p."id", "environment_id" = e."id"
FROM "projects" p
JOIN "environments" e ON e."project_id" = p."id" AND e."kind" = 'prod'
WHERE p."org_id" = o."org_id" AND p."is_default"
	AND o."project_id" IS NULL AND o."status" IN ('pending', 'processing');--> statement-breakpoint
-- ai_usage_daily não recebe backfill: o histórico fica sem projeto.
DO $$
DECLARE
	orgs bigint;
	padroes bigint;
	projetos bigint;
	ambientes bigint;
	agentes bigint;
	chaves bigint;
	agentes_sem_projeto bigint;
	chaves_sem_escopo bigint;
	projetos_incompletos bigint;
BEGIN
	SELECT count(*) INTO orgs FROM "organizations";
	SELECT count(*) INTO padroes FROM "projects" WHERE "is_default";
	SELECT count(*) INTO projetos FROM "projects";
	SELECT count(*) INTO ambientes FROM "environments";
	SELECT count(*) INTO agentes FROM "agents";
	SELECT count(*) INTO chaves FROM "agent_api_keys";
	SELECT count(*) INTO agentes_sem_projeto FROM "agents" WHERE "project_id" IS NULL;
	SELECT count(*) INTO chaves_sem_escopo FROM "agent_api_keys"
		WHERE "project_id" IS NULL OR "environment_id" IS NULL;
	SELECT count(*) INTO projetos_incompletos FROM "projects" p
		WHERE (SELECT count(*) FROM "environments" e WHERE e."project_id" = p."id") <> 2;
	IF agentes_sem_projeto > 0 OR chaves_sem_escopo > 0 OR padroes <> orgs OR projetos_incompletos > 0 THEN
		RAISE EXCEPTION '0022: backfill incompleto (orgs=% padrao=% agentes_sem_projeto=% chaves_sem_escopo=% projetos_incompletos=%)',
			orgs, padroes, agentes_sem_projeto, chaves_sem_escopo, projetos_incompletos;
	END IF;
	RAISE NOTICE '0022: orgs=% projetos=% ambientes=% agentes=% chaves=%',
		orgs, projetos, ambientes, agentes, chaves;
END;
$$;--> statement-breakpoint
-- <<< backfill-0022
-- Compatibilidade daqui para frente: INSERT que não conhece projeto/ambiente
-- continua válido (rotas antigas, seed, scripts e fixtures).
CREATE OR REPLACE FUNCTION "muster_org_default_project"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO "projects" ("id", "org_id", "name", "slug", "is_default")
	VALUES (gen_random_uuid()::text, NEW."id", 'Padrão', 'padrao', true)
	ON CONFLICT DO NOTHING;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "organizations_default_project_trg"
	AFTER INSERT ON "organizations"
	FOR EACH ROW EXECUTE FUNCTION "muster_org_default_project"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "muster_agent_default_project"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."project_id" IS NULL THEN
		SELECT p."id" INTO NEW."project_id"
		FROM "projects" p
		WHERE p."org_id" = NEW."org_id" AND p."is_default";
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "agents_default_project_trg"
	BEFORE INSERT ON "agents"
	FOR EACH ROW EXECUTE FUNCTION "muster_agent_default_project"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "muster_agent_api_key_scope"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."project_id" IS NULL THEN
		SELECT a."project_id" INTO NEW."project_id"
		FROM "agents" a
		WHERE a."id" = NEW."agent_id" AND a."org_id" = NEW."org_id";
	END IF;
	IF NEW."environment_id" IS NULL THEN
		SELECT e."id" INTO NEW."environment_id"
		FROM "environments" e
		WHERE e."project_id" = NEW."project_id" AND e."kind" = 'prod';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "agent_api_keys_scope_trg"
	BEFORE INSERT ON "agent_api_keys"
	FOR EACH ROW EXECUTE FUNCTION "muster_agent_api_key_scope"();--> statement-breakpoint

-- ── Fase 3 · NOT NULL, FKs compostas e índices ─────────────────────────────
ALTER TABLE "agents" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ALTER COLUMN "environment_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_id_project_org_unique" UNIQUE("id","project_id","org_id");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_org_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_agent_project_fk" FOREIGN KEY ("agent_id","project_id","org_id") REFERENCES "public"."agents"("id","project_id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_environment_fk" FOREIGN KEY ("environment_id","project_id","org_id") REFERENCES "public"."environments"("id","project_id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD CONSTRAINT "event_outbox_project_org_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD CONSTRAINT "event_outbox_environment_fk" FOREIGN KEY ("environment_id","project_id","org_id") REFERENCES "public"."environments"("id","project_id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_outbox" ADD CONSTRAINT "event_outbox_environment_needs_project" CHECK ("environment_id" IS NULL OR "project_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_project_org_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX "ai_usage_daily_org_day_feature_idx";--> statement-breakpoint
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_org_project_day_feature_unique" UNIQUE NULLS NOT DISTINCT("org_id","project_id","day","feature");--> statement-breakpoint
CREATE INDEX "agents_org_project_idx" ON "agents" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "agent_api_keys_org_project_env_idx" ON "agent_api_keys" USING btree ("org_id","project_id","environment_id");--> statement-breakpoint
CREATE INDEX "event_outbox_org_project_env_idx" ON "event_outbox" USING btree ("org_id","project_id","environment_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_daily_org_project_day_idx" ON "ai_usage_daily" USING btree ("org_id","project_id","day");
