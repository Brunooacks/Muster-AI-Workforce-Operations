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
