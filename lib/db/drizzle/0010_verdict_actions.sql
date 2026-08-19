-- Ciclo de revisão do agente (gauntlet rodada 5).
-- As ações recomendadas deixam de ser texto dentro de `verdicts.next_actions` e
-- passam a ser linhas com status, evidência e responsável — mesma paridade que
-- as ações de jornada já tinham.

CREATE TABLE IF NOT EXISTS "verdict_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"verdict_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"action" text NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"due" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"health_score_at_approval" integer,
	"updated_by" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verdict_actions" ADD CONSTRAINT "verdict_actions_verdict_id_fk" FOREIGN KEY ("verdict_id") REFERENCES "public"."verdicts"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "verdict_actions" ADD CONSTRAINT "verdict_actions_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verdict_actions_verdict_idx" ON "verdict_actions" USING btree ("verdict_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verdict_actions_agent_idx" ON "verdict_actions" USING btree ("agent_id");--> statement-breakpoint

-- Backfill: cada item de `next_actions` vira uma linha rastreável, preservando a
-- ordem original. Sem isso, todo veredito já emitido ficaria sem plano de ação
-- na tela nova.
INSERT INTO "verdict_actions" ("id", "verdict_id", "agent_id", "sequence", "action", "owner", "due")
SELECT
	gen_random_uuid()::text,
	v."id",
	v."agent_id",
	(item.ord)::int,
	COALESCE(item.value ->> 'action', ''),
	COALESCE(item.value ->> 'owner', ''),
	COALESCE(item.value ->> 'due', '')
FROM "verdicts" v
CROSS JOIN LATERAL jsonb_array_elements(v."next_actions") WITH ORDINALITY AS item(value, ord)
WHERE jsonb_typeof(v."next_actions") = 'array'
  AND COALESCE(item.value ->> 'action', '') <> ''
  AND NOT EXISTS (SELECT 1 FROM "verdict_actions" va WHERE va."verdict_id" = v."id");
