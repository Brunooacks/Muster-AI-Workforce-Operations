CREATE TABLE "purposes" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"domain" text NOT NULL,
	"outcome" text NOT NULL,
	"risk_tier" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purposes_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "team_agent_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"assignment_role" text DEFAULT 'supporting' NOT NULL,
	"responsibility" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"role" text DEFAULT 'operator' NOT NULL,
	"decision_rights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"purpose_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "team_agent_assignments" ADD CONSTRAINT "team_agent_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_agent_assignments" ADD CONSTRAINT "team_agent_assignments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_purpose_id_purposes_id_fk" FOREIGN KEY ("purpose_id") REFERENCES "public"."purposes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_agent_assignments_team_agent_idx" ON "team_agent_assignments" USING btree ("team_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_memberships_team_member_idx" ON "team_memberships" USING btree ("team_id","member_id");