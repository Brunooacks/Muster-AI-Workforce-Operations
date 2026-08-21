import { db, catalogMetrics } from "@workspace/db";
import { METRIC_CATALOG } from "./metric-catalog";
import { logger } from "./logger";
import { DEFAULT_ORG_ID } from "../middlewares/requireOrg";
import { ofOrg } from "./tenant-scope";

/**
 * Popula o catálogo de métricas de uma organização a partir do catálogo
 * embutido. Só insere o que falta, então edições e exclusões sob medida nunca
 * são sobrescritas.
 *
 * A conferência do que já existe é por organização, e isso não é detalhe: se
 * ela olhasse a tabela inteira, a segunda organização a nascer encontraria as
 * chaves da primeira e ficaria com o catálogo vazio — sem erro algum, só sem
 * métrica. Por isso a função recebe `orgId` e é chamada tanto no boot (para a
 * organização padrão) quanto na criação de cada nova organização.
 */
export async function ensureCatalogSeed(orgId: string = DEFAULT_ORG_ID): Promise<void> {
  const existing = await db
    .select({ key: catalogMetrics.key })
    .from(catalogMetrics)
    .where(ofOrg(catalogMetrics, orgId));
  const existingKeys = new Set(existing.map((row) => row.key));
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
  ).filter((row) => !existingKeys.has(row.key));
  if (rows.length === 0) return;

  await db.insert(catalogMetrics).values(rows.map((r) => ({ ...r, orgId })));
  logger.info({ metrics: rows.length, orgId }, "Metric catalog entries seeded.");
}
