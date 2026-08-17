ALTER TABLE "alerts" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "resolved_at" timestamp with time zone;