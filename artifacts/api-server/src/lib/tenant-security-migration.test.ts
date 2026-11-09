import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(import.meta.dirname, "../../../../lib/db/drizzle/0012_tenant_security.sql"),
  "utf8",
);

describe("migration 0012 tenant security", () => {
  it("faz backfill seguro e torna evidence tenant-owned", () => {
    expect(migration).toContain('ALTER TABLE "metric_evidence" ADD COLUMN IF NOT EXISTS "org_id"');
    expect(migration).toContain("referências cruzadas entre organizações");
    expect(migration).toContain('ALTER COLUMN "org_id" SET NOT NULL');
    expect(migration).toContain("metric_evidence_org_agent_metric_captured_idx");
  });

  it("substitui unicidades globais por compostas", () => {
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "catalog_metrics_key_unique"');
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "journeys_slug_unique"');
    expect(migration).toContain('("org_id", "key")');
    expect(migration).toContain('("org_id", "slug")');
  });

  it("materializa idempotência por tenant, plataforma e evento", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "external_event_receipts"');
    expect(migration).toContain('("org_id", "platform", "event_id")');
    expect(migration).toContain("agent_events_agent_ts_idx");
  });
});

const drizzleDir = join(import.meta.dirname, "../../../../lib/db/drizzle");
const up0022 = readFileSync(join(drizzleDir, "0023_projects_envs.sql"), "utf8");
const down0022 = readFileSync(join(drizzleDir, "down", "0023_projects_envs.sql"), "utf8");
const journal = JSON.parse(readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf8")) as {
  entries: Array<{ tag: string; when: number }>;
};

describe("migração 0022 projetos e ambientes", () => {
  it("roda em três fases: nullable → backfill → NOT NULL e FKs compostas", () => {
    const fase1 = up0022.indexOf("Fase 1");
    const fase2 = up0022.indexOf("Fase 2");
    const fase3 = up0022.indexOf("Fase 3");
    expect(fase1).toBeGreaterThan(-1);
    expect(fase2).toBeGreaterThan(fase1);
    expect(fase3).toBeGreaterThan(fase2);
    expect(up0022.slice(fase1, fase2)).toContain('ALTER TABLE "agents" ADD COLUMN "project_id" text;');
    expect(up0022.slice(fase1, fase2)).not.toContain("SET NOT NULL");
    expect(up0022.slice(fase3)).toContain('ALTER TABLE "agents" ALTER COLUMN "project_id" SET NOT NULL');
    expect(up0022.slice(fase3)).toContain('FOREIGN KEY ("environment_id","project_id","org_id")');
  });

  it("backfill é idempotente e aborta se sobrar escopo nulo", () => {
    expect(up0022).toContain("-- >>> backfill-0022");
    expect(up0022).toContain("-- <<< backfill-0022");
    expect(up0022).toContain("ON CONFLICT DO NOTHING");
    expect(up0022).toContain("RAISE EXCEPTION '0022: backfill incompleto");
    expect(up0022).toContain("'0022: orgs=% projetos=% ambientes=% agentes=% chaves=%'");
    // Toda chave existente vira prod (D-E1-2).
    expect(up0022).toMatch(/UPDATE "agent_api_keys"[\s\S]*"kind" = 'prod'/);
  });

  it("ai_usage_daily ganha project_id anulável com unicidade NULLS NOT DISTINCT", () => {
    expect(up0022).toContain('ALTER TABLE "ai_usage_daily" ADD COLUMN "project_id" text;');
    expect(up0022).not.toMatch(/"ai_usage_daily" ALTER COLUMN "project_id" SET NOT NULL/);
    expect(up0022).toContain('UNIQUE NULLS NOT DISTINCT("org_id","project_id","day","feature")');
  });

  it("down desfaz tudo na ordem inversa e tira a 0022 do registro do migrator", () => {
    for (const obj of [
      'DROP TABLE IF EXISTS "projects"',
      'DROP TABLE IF EXISTS "environments"',
      'ALTER TABLE "agents" DROP COLUMN IF EXISTS "project_id"',
      'ALTER TABLE "agent_api_keys" DROP COLUMN IF EXISTS "environment_id"',
      'ALTER TABLE "event_outbox" DROP COLUMN IF EXISTS "project_id"',
      'ALTER TABLE "ai_usage_daily" DROP COLUMN IF EXISTS "project_id"',
      'CREATE UNIQUE INDEX IF NOT EXISTS "ai_usage_daily_org_day_feature_idx"',
      'DROP TRIGGER IF EXISTS "agents_default_project_trg"',
    ]) {
      expect(down0022).toContain(obj);
    }
    expect(down0022.indexOf('DROP TABLE IF EXISTS "environments"')).toBeLessThan(
      down0022.indexOf('DROP TABLE IF EXISTS "projects"'),
    );
    const entrada = journal.entries.find((e) => e.tag === "0023_projects_envs");
    expect(entrada).toBeDefined();
    expect(down0022).toContain(`WHERE "created_at" = ${entrada!.when};`);
  });
});
