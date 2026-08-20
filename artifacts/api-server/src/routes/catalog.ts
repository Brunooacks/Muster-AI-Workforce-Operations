import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, catalogMetrics } from "@workspace/db";
import {
  ListCatalogMetricsResponse,
  CreateCatalogMetricBody,
  UpdateCatalogMetricBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { ofOrg } from "../lib/tenant-scope";
import { instrumentacaoPara } from "../lib/metric-instrumentation";
import { METRIC_CATALOG, METRIC_STARTER_KITS } from "../lib/metric-catalog";

const router: IRouter = Router();

// Do catálogo à captura: dada uma métrica, diz como o número chega ao Muster.
// Declarar sem dizer como capturar é o que deixa catálogo de métrica virar
// enfeite — esta rota é o elo que faltava.
router.get("/catalog/metrics/:metricKey/instrumentation", requireAuth, requireOrg, async (req, res) => {
  const metricKey = req.params.metricKey as string;
  const [row] = await db
    .select()
    .from(catalogMetrics)
    .where(and(eq(catalogMetrics.key, metricKey), eq(catalogMetrics.orgId, req.orgId!)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Métrica não encontrada no catálogo." });
    return;
  }
  const instrucao = instrumentacaoPara({
    key: row.key, label: row.label, unit: row.unit,
    target: row.target ?? "", layer: row.layer,
  });
  res.json({ metricKey: row.key, label: row.label, ...instrucao });
});

// Vertical presentation metadata comes from the built-in catalog; DB rows are
// grouped under it so custom metrics land in their vertical alongside seeded ones.
const VERTICAL_META = new Map(
  METRIC_CATALOG.map((v) => [
    v.key,
    { label: v.label, description: v.description, icon: v.icon },
  ]),
);

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.get("/catalog/metrics", requireAuth, requireOrg, async (req, res) => {
  const rows = await db.select().from(catalogMetrics).where(ofOrg(catalogMetrics, req.orgId!));

  // Keep the built-in vertical order; unknown verticals (future-proofing) go last.
  const order = new Map(METRIC_CATALOG.map((v, i) => [v.key, i]));
  const byVertical = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byVertical.get(row.vertical) ?? [];
    list.push(row);
    byVertical.set(row.vertical, list);
  }

  const data = [...byVertical.entries()]
    .sort(
      (a, b) => (order.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (order.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(([verticalKey, metrics]) => {
      const meta = VERTICAL_META.get(verticalKey) ?? {
        label: verticalKey,
        description: "",
        icon: "Layers",
      };
      return {
        key: verticalKey,
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        metrics: metrics.map((m) => ({
          key: m.key,
          vertical: m.vertical,
          layer: m.layer,
          label: m.label,
          unit: m.unit,
          target: m.target,
          description: m.description,
          rationale: m.rationale,
          isCustom: m.isCustom === 1,
        })),
      };
    });

  res.json(ListCatalogMetricsResponse.parse(data));
});

router.get("/catalog/metric-kits", requireAuth, requireOrg, async (req, res) => {
  const rows = await db.select().from(catalogMetrics).where(ofOrg(catalogMetrics, req.orgId!));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  res.json(METRIC_STARTER_KITS.map((kit) => ({
    key: kit.key,
    label: kit.label,
    objective: kit.objective,
    guidance: kit.guidance,
    vertical: kit.vertical,
    metrics: kit.metricKeys.flatMap((key) => {
      const metric = byKey.get(key);
      return metric ? [{ key: metric.key, label: metric.label, layer: metric.layer, unit: metric.unit, target: metric.target }] : [];
    }),
  })));
});

router.post("/catalog/metrics", requireAuth, requireOrg, async (req, res) => {
  const body = CreateCatalogMetricBody.parse(req.body);

  // Derive a unique key from the label; suffix on collision.
  const base = slugifyKey(body.label) || "metrica";
  let key = base;
  for (let i = 2; ; i++) {
    const clash = await db
      .select({ id: catalogMetrics.id })
      .from(catalogMetrics)
      .where(and(eq(catalogMetrics.key, key), ofOrg(catalogMetrics, req.orgId!)))
      .limit(1);
    if (clash.length === 0) break;
    key = `${base}-${i}`;
  }

  const [row] = await db
    .insert(catalogMetrics)
    .values({
      orgId: req.orgId!,
      key,
      vertical: body.vertical,
      layer: body.layer,
      label: body.label,
      unit: body.unit ?? "",
      target: body.target ?? "—",
      description: body.description ?? "",
      rationale: body.rationale ?? "",
      isCustom: 1,
    })
    .returning();

  res.status(201).json({
    key: row!.key,
    vertical: row!.vertical,
    layer: row!.layer,
    label: row!.label,
    unit: row!.unit,
    target: row!.target,
    description: row!.description,
    rationale: row!.rationale,
    isCustom: true,
  });
});

router.patch("/catalog/metrics/:metricKey", requireAuth, requireOrg, async (req, res) => {
  const body = UpdateCatalogMetricBody.parse(req.body);
  const metricKey = req.params.metricKey as string;

  const [existing] = await db
    .select()
    .from(catalogMetrics)
    .where(and(eq(catalogMetrics.key, metricKey), ofOrg(catalogMetrics, req.orgId!)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Métrica não encontrada." });
    return;
  }

  // Seeded metrics keep their identity: only goal/rationale/description are
  // editable. Custom metrics accept full edits.
  const isSeeded = existing.isCustom === 0;
  const patch: Partial<typeof existing> = {
    ...(body.target !== undefined ? { target: body.target } : {}),
    ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(!isSeeded && body.label !== undefined ? { label: body.label } : {}),
    ...(!isSeeded && body.unit !== undefined ? { unit: body.unit } : {}),
    ...(!isSeeded && body.layer !== undefined ? { layer: body.layer } : {}),
    updatedAt: new Date(),
  };

  const [row] = await db
    .update(catalogMetrics)
    .set(patch)
    .where(and(eq(catalogMetrics.key, metricKey), ofOrg(catalogMetrics, req.orgId!)))
    .returning();

  res.json({
    key: row!.key,
    vertical: row!.vertical,
    layer: row!.layer,
    label: row!.label,
    unit: row!.unit,
    target: row!.target,
    description: row!.description,
    rationale: row!.rationale,
    isCustom: row!.isCustom === 1,
  });
});

router.delete("/catalog/metrics/:metricKey", requireAuth, requireOrg, async (req, res) => {
  const metricKey = req.params.metricKey as string;
  const [existing] = await db
    .select()
    .from(catalogMetrics)
    .where(and(eq(catalogMetrics.key, metricKey), ofOrg(catalogMetrics, req.orgId!)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Métrica não encontrada." });
    return;
  }
  if (existing.isCustom === 0) {
    res.status(409).json({ error: "Métricas do catálogo padrão não podem ser excluídas." });
    return;
  }
  await db.delete(catalogMetrics).where(and(eq(catalogMetrics.key, metricKey), ofOrg(catalogMetrics, req.orgId!)));
  res.status(204).end();
});

export default router;
