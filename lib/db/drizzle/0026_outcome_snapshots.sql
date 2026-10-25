-- 0026 · snapshot de resultado por agente e período (cunha · C4.4, MUS-177).
-- Gerada por drizzle-kit; o trigger de imutabilidade é escrito à mão no fim.
-- O snapshot guarda inputs, custo-hora e preços usados: recalcular o mesmo
-- período com os mesmos dados dá o mesmo inputs_hash (o único impede duplicar).
-- Down manual em lib/db/drizzle/down/0026_outcome_snapshots.sql.

CREATE TABLE "outcome_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"environment_id" text,
	"agent_id" text NOT NULL,
	"period" text NOT NULL,
	"layer1" jsonb NOT NULL,
	"layer2" jsonb NOT NULL,
	"signals" jsonb NOT NULL,
	"contract_id" text,
	"contract_version" integer,
	"calc_version" text NOT NULL,
	"inputs_hash" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"role_rates_snapshot" jsonb,
	"prices_snapshot" jsonb,
	"reference_model" text,
	"price_version" text,
	"task_coverage" numeric(6, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outcome_snapshots_period_check" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "outcome_snapshots" ADD CONSTRAINT "outcome_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_snapshots" ADD CONSTRAINT "outcome_snapshots_agent_project_org_fk" FOREIGN KEY ("agent_id","project_id","org_id") REFERENCES "public"."agents"("id","project_id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_snapshots" ADD CONSTRAINT "outcome_snapshots_contract_fk" FOREIGN KEY ("contract_id","contract_version") REFERENCES "public"."agent_contracts"("id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outcome_snapshots_agent_period_calc_hash_idx" ON "outcome_snapshots" USING btree ("agent_id","period","calc_version","inputs_hash");--> statement-breakpoint
CREATE INDEX "outcome_snapshots_org_period_idx" ON "outcome_snapshots" USING btree ("org_id","period");--> statement-breakpoint
-- Snapshot fechado é prova: não muda nem some, exceto na cascata da exclusão
-- do agente ou da conta (a linha-mãe já não existe nesse momento).
CREATE OR REPLACE FUNCTION "muster_outcome_snapshots_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF EXISTS (SELECT 1 FROM "agents" a WHERE a."id" = OLD."agent_id")
			AND EXISTS (SELECT 1 FROM "organizations" o WHERE o."id" = OLD."org_id") THEN
			RAISE EXCEPTION 'outcome_snapshots: snapshot fechado não pode ser apagado'
				USING ERRCODE = 'integrity_constraint_violation';
		END IF;
		RETURN OLD;
	END IF;
	RAISE EXCEPTION 'outcome_snapshots: snapshot fechado é imutável (feche de novo com outro calc_version)'
		USING ERRCODE = 'integrity_constraint_violation';
END;
$$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER "outcome_snapshots_immutable_trg"
	BEFORE UPDATE OR DELETE ON "outcome_snapshots"
	FOR EACH ROW EXECUTE FUNCTION "muster_outcome_snapshots_immutable"();
