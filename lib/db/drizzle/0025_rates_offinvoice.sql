-- 0025 · custo-hora por papel/área e custos fora da fatura (cunha · C3.1, MUS-176).
-- Gerada por drizzle-kit. Sem seed e sem default global (R4): conta sem
-- custo-hora vigente vê a camada 1 como "indisponível".
-- Down manual em lib/db/drizzle/down/0025_rates_offinvoice.sql.

CREATE TABLE "off_invoice_costs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text,
	"agent_id" text,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"allocation" text NOT NULL,
	"description" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "off_invoice_costs_value_check" CHECK ("amount_cents" >= 0),
	CONSTRAINT "off_invoice_costs_currency_check" CHECK ("currency" IN ('BRL', 'USD')),
	CONSTRAINT "off_invoice_costs_period_check" CHECK ("period_end" >= "period_start"),
	CONSTRAINT "off_invoice_costs_category_check" CHECK ("category" IN ('license', 'infra', 'integration', 'other')),
	CONSTRAINT "off_invoice_costs_allocation_check" CHECK (("allocation" = 'agent' AND "agent_id" IS NOT NULL) OR ("allocation" = 'project' AND "project_id" IS NOT NULL) OR "allocation" = 'per_task')
);
--> statement-breakpoint
CREATE TABLE "role_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"area_id" text,
	"role" text NOT NULL,
	"hourly_cost_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_rates_value_check" CHECK ("hourly_cost_cents" >= 0),
	CONSTRAINT "role_rates_currency_check" CHECK ("currency" IN ('BRL', 'USD')),
	CONSTRAINT "role_rates_period_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);
--> statement-breakpoint
ALTER TABLE "off_invoice_costs" ADD CONSTRAINT "off_invoice_costs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "off_invoice_costs" ADD CONSTRAINT "off_invoice_costs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "off_invoice_costs" ADD CONSTRAINT "off_invoice_costs_project_org_fk" FOREIGN KEY ("project_id","org_id") REFERENCES "public"."projects"("id","org_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_rates" ADD CONSTRAINT "role_rates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_rates" ADD CONSTRAINT "role_rates_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "off_invoice_costs_org_period_idx" ON "off_invoice_costs" USING btree ("org_id","period_start");--> statement-breakpoint
CREATE INDEX "role_rates_org_role_idx" ON "role_rates" USING btree ("org_id","role","valid_from");