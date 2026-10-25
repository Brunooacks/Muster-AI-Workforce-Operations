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
-- (T1.3)

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
