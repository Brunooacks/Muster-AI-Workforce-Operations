-- 0024 · contrato numérico versionado por agente (cunha · C2.1, MUS-175).
-- Gerada por drizzle-kit; o trigger de imutabilidade é escrito à mão no fim.
-- Nenhum dado é convertido: business_case continua como texto de referência e
-- todo agente existente começa com "contrato pendente" (sem linha aqui).
-- Down manual em lib/db/drizzle/down/0024_agent_contracts.sql.

CREATE TABLE "agent_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"version" integer NOT NULL,
	"metric_key" text NOT NULL,
	"unit" text NOT NULL,
	"direction" text NOT NULL,
	"baseline" numeric NOT NULL,
	"target" numeric NOT NULL,
	"limit" numeric,
	"deadline" date NOT NULL,
	"owner_member_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"reference_human_minutes" numeric,
	"require_human_accept" boolean DEFAULT false NOT NULL,
	"reference_model" text,
	CONSTRAINT "agent_contracts_id_version_unique" UNIQUE("id","version"),
	CONSTRAINT "agent_contracts_direction_check" CHECK ("direction" IN ('up', 'down')),
	CONSTRAINT "agent_contracts_status_check" CHECK ("status" IN ('draft', 'active', 'superseded')),
	CONSTRAINT "agent_contracts_version_check" CHECK ("version" >= 1),
	CONSTRAINT "agent_contracts_reference_minutes_check" CHECK ("reference_human_minutes" IS NULL OR "reference_human_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "verdicts" ADD COLUMN "contract_id" text;--> statement-breakpoint
ALTER TABLE "verdicts" ADD COLUMN "contract_version" integer;--> statement-breakpoint
ALTER TABLE "agent_contracts" ADD CONSTRAINT "agent_contracts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_contracts" ADD CONSTRAINT "agent_contracts_agent_project_org_fk" FOREIGN KEY ("agent_id","project_id","org_id") REFERENCES "public"."agents"("id","project_id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_contracts_agent_version_idx" ON "agent_contracts" USING btree ("agent_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_contracts_active_idx" ON "agent_contracts" USING btree ("agent_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "agent_contracts_org_agent_idx" ON "agent_contracts" USING btree ("org_id","agent_id");--> statement-breakpoint
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_contract_fk" FOREIGN KEY ("contract_id","contract_version") REFERENCES "public"."agent_contracts"("id","version") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Versão gravada é história: só status/superseded_at mudam, nas transições
-- draft→active, draft→superseded e active→superseded. DELETE só na cascata da
-- exclusão do agente ou da conta (a linha-mãe já não existe nesse momento).
CREATE OR REPLACE FUNCTION "muster_agent_contracts_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF EXISTS (SELECT 1 FROM "agents" a WHERE a."id" = OLD."agent_id")
			AND EXISTS (SELECT 1 FROM "organizations" o WHERE o."id" = OLD."org_id") THEN
			RAISE EXCEPTION 'agent_contracts: versão de contrato não pode ser apagada (crie uma nova versão)'
				USING ERRCODE = 'integrity_constraint_violation';
		END IF;
		RETURN OLD;
	END IF;
	IF (to_jsonb(NEW) - 'status' - 'superseded_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'superseded_at') THEN
		RAISE EXCEPTION 'agent_contracts: versão de contrato é imutável (só status e superseded_at mudam)'
			USING ERRCODE = 'integrity_constraint_violation';
	END IF;
	IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
		(OLD."status" = 'draft' AND NEW."status" IN ('active', 'superseded'))
		OR (OLD."status" = 'active' AND NEW."status" = 'superseded')
	) THEN
		RAISE EXCEPTION 'agent_contracts: transição de status inválida (% → %)', OLD."status", NEW."status"
			USING ERRCODE = 'integrity_constraint_violation';
	END IF;
	IF OLD."superseded_at" IS NOT NULL AND NEW."superseded_at" IS DISTINCT FROM OLD."superseded_at" THEN
		RAISE EXCEPTION 'agent_contracts: superseded_at já gravado não muda'
			USING ERRCODE = 'integrity_constraint_violation';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "agent_contracts_immutable_trg"
	BEFORE UPDATE OR DELETE ON "agent_contracts"
	FOR EACH ROW EXECUTE FUNCTION "muster_agent_contracts_immutable"();
--> statement-breakpoint
-- C2.3 · veredito aponta para a versão vigente. Qualquer INSERT em verdicts
-- (admissão, conector, reavaliação, seed) que não informe o contrato herda o
-- ativo do agente; sem contrato ativo fica nulo ("contrato pendente").
CREATE OR REPLACE FUNCTION "muster_verdict_contract"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."contract_id" IS NULL THEN
		SELECT c."id", c."version" INTO NEW."contract_id", NEW."contract_version"
		FROM "agent_contracts" c
		WHERE c."agent_id" = NEW."agent_id" AND c."status" = 'active';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "verdicts_contract_trg"
	BEFORE INSERT ON "verdicts"
	FOR EACH ROW EXECUTE FUNCTION "muster_verdict_contract"();
