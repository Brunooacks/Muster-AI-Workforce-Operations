import { db, catalogMetrics } from "@workspace/db";
import { METRIC_CATALOG } from "./metric-catalog";
import { logger } from "./logger";

// Populates the metric catalog from the built-in seed on first boot. Runs only
// when the table is empty so tailor-made edits/deletions are never overwritten.
export async function ensureCatalogSeed(): Promise<void> {
  const existing = await db.select({ id: catalogMetrics.id }).from(catalogMetrics).limit(1);
  if (existing.length > 0) return;

  logger.info("Seeding metric catalog...");
  const rows = METRIC_CATALOG.flatMap((vertical) =>
    vertical.metrics.map((m) => ({
      key: m.key,
      vertical: vertical.key,
      layer: m.layer,
      label: m.label,
      unit: m.unit,
      target: m.target,
      description: m.description,
      rationale: m.rationale,
      isCustom: 0,
    })),
  );
  await db.insert(catalogMetrics).values(rows);
  logger.info({ metrics: rows.length }, "Metric catalog seeded.");
}
