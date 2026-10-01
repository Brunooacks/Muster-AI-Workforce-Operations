import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    import.meta.dirname,
    "../../../../lib/db/drizzle/0013_continuous_telemetry_outbox.sql",
  ),
  "utf8",
);

describe("migration 0013 continuous telemetry outbox", () => {
  it("creates a tenant-owned durable event envelope", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "event_outbox"');
    expect(migration).toContain('"org_id" text NOT NULL');
    expect(migration).toContain('"aggregate_type" text NOT NULL');
    expect(migration).toContain('"aggregate_id" text NOT NULL');
    expect(migration).toContain('"payload" jsonb NOT NULL');
    expect(migration).toContain('REFERENCES "organizations"("id")');
  });

  it("constrains lifecycle and priority", () => {
    expect(migration).toContain("'pending', 'processing', 'completed', 'dead-letter'");
    expect(migration).toContain("'critical', 'high', 'normal', 'low'");
    expect(migration).toContain('CHECK ("attempts" >= 0)');
  });

  it("indexes claims, tenant activity and aggregates", () => {
    expect(migration).toContain("event_outbox_claim_idx");
    expect(migration).toContain("event_outbox_org_activity_idx");
    expect(migration).toContain("event_outbox_aggregate_idx");
  });
});
