CREATE TABLE "ai_usage_daily" (
	"org_id" text NOT NULL,
	"day" date NOT NULL,
	"feature" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"est_cost_usd" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_daily_org_day_feature_idx" ON "ai_usage_daily" USING btree ("org_id","day","feature");--> statement-breakpoint
CREATE INDEX "ai_usage_daily_org_day_idx" ON "ai_usage_daily" USING btree ("org_id","day");