CREATE TABLE "catalog_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"vertical" text NOT NULL,
	"layer" text NOT NULL,
	"label" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"target" text DEFAULT '—' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"is_custom" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_metrics_key_unique" UNIQUE("key")
);
