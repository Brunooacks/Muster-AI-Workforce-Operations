CREATE TABLE "access_group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text DEFAULT '' NOT NULL,
	"user_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"scope_type" text DEFAULT 'organization' NOT NULL,
	"scope_id" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_group_members" ADD CONSTRAINT "access_group_members_group_id_access_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."access_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_groups" ADD CONSTRAINT "access_groups_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_group_members_group_user_idx" ON "access_group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "access_group_members_user_idx" ON "access_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_groups_org_slug_idx" ON "access_groups" USING btree ("org_id","slug");--> statement-breakpoint
CREATE INDEX "access_groups_org_idx" ON "access_groups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "access_groups_scope_idx" ON "access_groups" USING btree ("org_id","scope_type","scope_id");