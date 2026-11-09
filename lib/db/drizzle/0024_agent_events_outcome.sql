-- 0023 · agent_events no formato do envelope (cunha · C1.2, MUS-174).
-- Gerada por drizzle-kit e reordenada à mão em três fases, como a 0022:
--   1. colunas novas, todas anuláveis (evento antigo continua válido);
--   2. backfill idempotente de conta/projeto/ambiente pelo agente (o ambiente
--      histórico vira prod) + trigger de compatibilidade;
--   3. FKs compostas, CHECKs e índices.
-- Down manual em lib/db/drizzle/down/0024_agent_events_outcome.sql.

-- ── Fase 1 · colunas anuláveis ─────────────────────────────────────────────
ALTER TABLE "agent_events" ADD COLUMN "org_id" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "environment_id" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "attempt" integer;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "retry_of" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "expected" jsonb;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "actual" jsonb;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "accepted_by" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "accepted_by_kind" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "accepted_rule_version" text;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "capabilities" jsonb;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "rework_count" integer;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "human_minutes" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "context_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_events" ADD COLUMN "model" text;--> statement-breakpoint

-- ── Fase 2 · backfill ──────────────────────────────────────────────────────
-- Tudo entre os marcadores é reexecutável (agent-events-0023.integration.test.ts
-- roda o trecho de novo e compara).
-- >>> backfill-0023
UPDATE "agent_events" ev SET "org_id" = a."org_id", "project_id" = a."project_id"
FROM "agents" a
WHERE a."id" = ev."agent_id" AND ev."org_id" IS NULL;--> statement-breakpoint
UPDATE "agent_events" ev SET "environment_id" = e."id"
FROM "environments" e
WHERE e."project_id" = ev."project_id" AND e."kind" = 'prod' AND ev."environment_id" IS NULL;--> statement-breakpoint
DO $$
DECLARE
	eventos bigint;
	sem_conta bigint;
	sem_ambiente bigint;
BEGIN
	SELECT count(*) INTO eventos FROM "agent_events";
	SELECT count(*) INTO sem_conta FROM "agent_events" WHERE "org_id" IS NULL OR "project_id" IS NULL;
	SELECT count(*) INTO sem_ambiente FROM "agent_events" WHERE "environment_id" IS NULL;
	IF sem_conta > 0 THEN
		RAISE EXCEPTION '0023: backfill incompleto (eventos=% sem_conta=%)', eventos, sem_conta;
	END IF;
	RAISE NOTICE '0023: eventos=% sem_conta=% sem_ambiente=%', eventos, sem_conta, sem_ambiente;
END;
$$;--> statement-breakpoint
-- <<< backfill-0023
-- Compatibilidade: INSERT que não informa conta/projeto (seed, scripts,
-- conectores, heartbeat) herda do agente. O ambiente não é inventado aqui: sem
-- chave de agente (sessão humana, conector org-wide) ele fica nulo.
CREATE OR REPLACE FUNCTION "muster_agent_event_scope"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."org_id" IS NULL OR NEW."project_id" IS NULL THEN
		SELECT a."org_id", a."project_id" INTO NEW."org_id", NEW."project_id"
		FROM "agents" a
		WHERE a."id" = NEW."agent_id";
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "agent_events_scope_trg"
	BEFORE INSERT ON "agent_events"
	FOR EACH ROW EXECUTE FUNCTION "muster_agent_event_scope"();--> statement-breakpoint

-- ── Fase 3 · FKs compostas, CHECKs e índices ───────────────────────────────
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agent_project_org_fk" FOREIGN KEY ("agent_id","project_id","org_id") REFERENCES "public"."agents"("id","project_id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_project_org_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_environment_fk" FOREIGN KEY ("environment_id","project_id","org_id") REFERENCES "public"."environments"("id","project_id","org_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_environment_needs_project" CHECK ("environment_id" IS NULL OR "project_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_attempt_check" CHECK ("attempt" IS NULL OR "attempt" >= 1);--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_accepted_by_kind_check" CHECK ("accepted_by_kind" IS NULL OR "accepted_by_kind" IN ('human', 'auto'));--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_auto_needs_rule_version" CHECK ("accepted_by_kind" IS DISTINCT FROM 'auto' OR "accepted_rule_version" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_rework_count_check" CHECK ("rework_count" IS NULL OR "rework_count" >= 0);--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_human_minutes_check" CHECK ("human_minutes" IS NULL OR "human_minutes" >= 0);--> statement-breakpoint
CREATE INDEX "agent_events_org_project_env_ts_idx" ON "agent_events" USING btree ("org_id","project_id","environment_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_events_task_attempt_idx" ON "agent_events" USING btree ("org_id","task_id","attempt") WHERE "task_id" IS NOT NULL AND "kind" IN ('execution', 'error');--> statement-breakpoint
CREATE INDEX "agent_events_org_run_idx" ON "agent_events" USING btree ("org_id","run_id") WHERE "run_id" IS NOT NULL;
