import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reportMigration = readFileSync(
  join(import.meta.dirname, "../../../../lib/db/drizzle/0014_wild_toro.sql"),
  "utf8",
);
const templateMigration = readFileSync(
  join(import.meta.dirname, "../../../../lib/db/drizzle/0015_keen_roxanne_simpson.sql"),
  "utf8",
);

describe("executive reporting migrations", () => {
  it("creates tenant-owned versioned snapshots and insight records", () => {
    expect(reportMigration).toContain('CREATE TABLE "executive_report_snapshots"');
    expect(reportMigration).toContain('CREATE TABLE "insight_records"');
    expect(reportMigration).toContain('"org_id" text NOT NULL');
    expect(reportMigration).toContain("executive_reports_org_period_version_idx");
    expect(reportMigration).toContain("insight_records_org_period_idx");
  });

  it("does not recreate tables owned by earlier tenancy migrations", () => {
    expect(reportMigration).not.toContain('CREATE TABLE "organizations"');
    expect(reportMigration).not.toContain('CREATE TABLE "areas"');
    expect(reportMigration).not.toContain('CREATE TABLE "event_outbox"');
  });

  it("adds the report presentation template separately", () => {
    expect(templateMigration).toContain(
      'ALTER TABLE "executive_report_snapshots" ADD COLUMN "template_id"',
    );
  });
});
