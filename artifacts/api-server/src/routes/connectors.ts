import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  agents,
  agentIdentities,
  agentOwners,
  evaluations,
  verdicts,
  connectors,
  metricPoints,
} from "@workspace/db";
import {
  ListConnectorsResponse,
  ConnectPlatformBody,
  DiscoverAgentsParams,
  DiscoverAgentsResponse,
  ImportDiscoveredAgentsParams,
  ImportDiscoveredAgentsBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { toAgentSummary } from "../lib/serializers";
import {
  PLATFORM_CATALOG,
  buildProposedMetrics,
  scoreEvaluation,
} from "../lib/discovery";

const router: IRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.get("/connectors", requireAuth, async (_req, res) => {
  const rows = await db.select().from(connectors);

  const existingPlatforms = new Set(rows.map((r) => r.platform));
  const catalogExtras = PLATFORM_CATALOG.filter(
    (p) => !existingPlatforms.has(p.platform),
  ).map((p) => ({
    id: `catalog_${p.platform}`,
    platform: p.platform,
    name: p.name,
    status: "available" as const,
    agentsDiscovered: 0,
    category: p.category,
    lastSyncAt: null,
  }));

  const data = ListConnectorsResponse.parse([
    ...rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      name: r.name,
      status: r.status,
      agentsDiscovered: r.agentsDiscovered,
      category: r.category,
      lastSyncAt: r.lastSyncAt ? r.lastSyncAt.toISOString() : null,
    })),
    ...catalogExtras,
  ]);

  res.json(data);
});

router.post("/connectors", requireAuth, async (req, res) => {
  const body = ConnectPlatformBody.parse(req.body);

  const catalog = PLATFORM_CATALOG.find((p) => p.platform === body.platform);

  const [existing] = await db
    .select()
    .from(connectors)
    .where(eq(connectors.platform, body.platform));

  if (existing) {
    const [updated] = await db
      .update(connectors)
      .set({ status: "connected", lastSyncAt: new Date() })
      .where(eq(connectors.id, existing.id))
      .returning();
    res.status(201).json({
      id: updated!.id,
      platform: updated!.platform,
      name: updated!.name,
      status: updated!.status,
      agentsDiscovered: updated!.agentsDiscovered,
      category: updated!.category,
      lastSyncAt: updated!.lastSyncAt ? updated!.lastSyncAt.toISOString() : null,
    });
    return;
  }

  const [created] = await db
    .insert(connectors)
    .values({
      platform: body.platform,
      name: body.name ?? catalog?.name ?? body.platform,
      category: catalog?.category ?? "Plataforma de Agentes",
      status: "connected",
      agentsDiscovered: catalog?.discovered.length ?? 0,
      lastSyncAt: new Date(),
    })
    .returning();

  res.status(201).json({
    id: created!.id,
    platform: created!.platform,
    name: created!.name,
    status: created!.status,
    agentsDiscovered: created!.agentsDiscovered,
    category: created!.category,
    lastSyncAt: created!.lastSyncAt ? created!.lastSyncAt.toISOString() : null,
  });
});

router.post(
  "/connectors/:connectorId/discover",
  requireAuth,
  async (req, res) => {
    const { connectorId } = DiscoverAgentsParams.parse(req.params);

    const [connector] = await db
      .select()
      .from(connectors)
      .where(eq(connectors.id, connectorId));

    const platformKey = connector
      ? connector.platform
      : connectorId.replace(/^catalog_/, "");

    const catalog = PLATFORM_CATALOG.find((p) => p.platform === platformKey);
    if (!catalog) {
      res.status(404).json({ error: "Connector not found" });
      return;
    }

    const importedExternalIds = new Set(
      (
        await db
          .select({ externalId: agents.externalId })
          .from(agents)
      )
        .map((r) => r.externalId)
        .filter((x): x is string => Boolean(x)),
    );

    const discoveredAgents = catalog.discovered.map((d) => {
      const proposedMetrics = buildProposedMetrics(d.externalId, d.signals);
      const scored = scoreEvaluation(d.externalId, proposedMetrics);
      return {
        externalId: d.externalId,
        name: d.name,
        role: d.role,
        platform: catalog.platform,
        signals: d.signals,
        proposedMetrics,
        proposedVerdict: scored.verdict,
        confidence: scored.verdictConfidence,
        alreadyImported: importedExternalIds.has(d.externalId),
      };
    });

    if (connector) {
      await db
        .update(connectors)
        .set({
          status: "connected",
          agentsDiscovered: discoveredAgents.length,
          lastSyncAt: new Date(),
        })
        .where(eq(connectors.id, connector.id));
    }

    const data = DiscoverAgentsResponse.parse({
      connectorId,
      platform: catalog.platform,
      discoveredAt: new Date().toISOString(),
      agentsFound: discoveredAgents.length,
      agents: discoveredAgents,
      coverageNote: `Mapeamos ${discoveredAgents.length} agente(s) na plataforma ${catalog.name}, com metas das 5 camadas propostas a partir dos sinais detectados.`,
    });

    res.json(data);
  },
);

router.post(
  "/connectors/:connectorId/import",
  requireAuth,
  async (req, res) => {
    const { connectorId } = ImportDiscoveredAgentsParams.parse(req.params);
    const body = ImportDiscoveredAgentsBody.parse(req.body);

    const [connector] = await db
      .select()
      .from(connectors)
      .where(eq(connectors.id, connectorId));
    const platformKey = connector
      ? connector.platform
      : connectorId.replace(/^catalog_/, "");
    const catalog = PLATFORM_CATALOG.find((p) => p.platform === platformKey);
    if (!catalog) {
      res.status(404).json({ error: "Connector not found" });
      return;
    }

    const existing = await db
      .select({ externalId: agents.externalId })
      .from(agents)
      .where(inArray(agents.externalId, body.externalIds));
    const alreadyImported = new Set(
      existing.map((r) => r.externalId).filter((x): x is string => Boolean(x)),
    );

    const created: (typeof agents.$inferSelect)[] = [];

    for (const externalId of body.externalIds) {
      if (alreadyImported.has(externalId)) continue;
      const seed = catalog.discovered.find((d) => d.externalId === externalId);
      if (!seed) continue;

      const proposed = buildProposedMetrics(seed.externalId, seed.signals);
      const scored = scoreEvaluation(seed.externalId, proposed);

      let slug = slugify(seed.name);
      const [clash] = await db
        .select()
        .from(agents)
        .where(eq(agents.slug, slug));
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;

      const now = Date.now();
      const agent = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(agents)
          .values({
            externalId: seed.externalId,
            name: seed.name,
            slug,
            role: seed.role,
            platform: catalog.platform,
            version: "1.0.0",
            status: "observation",
            bio: `Importado via conector ${catalog.name}.`,
            currentVerdict: "observation",
            verdictConfidence: scored.verdictConfidence,
            severity: scored.severity,
            healthScore: scored.healthScore,
            activeAlerts: 0,
            monthlyValue: 0,
            monthlyCost: 0,
          })
          .returning();
        if (!inserted) throw new Error("Failed to import agent");

        await tx.insert(agentIdentities).values({
          agentId: inserted.id,
          bio: `Importado via conector ${catalog.name}.`,
          shouldDo: [],
          shouldNotDo: [],
          autonomyLevel: "escalates",
          limits: [],
          businessCase: {
            baseline: "",
            targetPayback: "",
            actualPayback: "—",
            description: "Definir caso de negócio após admissão.",
          },
          version: 1,
        });

        await tx.insert(agentOwners).values({ agentId: inserted.id });

        await tx.insert(evaluations).values({
          agentId: inserted.id,
          window: "30d",
          layers: scored.layers,
          verdict: "observation",
          verdictConfidence: scored.verdictConfidence,
          rationale:
            "Avaliação inicial proposta pela descoberta automática; confirmar com dados reais.",
        });

        await tx.insert(verdicts).values({
          agentId: inserted.id,
          verdict: "observation",
          confidence: scored.verdictConfidence,
          executionWindow: "60 dias",
          suggestedSponsor: "Comitê",
          nextActions: [
            {
              action: "Validar as metas propostas com o dono de negócio",
              owner: "Comitê",
              due: "15 dias",
            },
          ],
          rationale: "Agente importado; veredito preliminar em observação.",
          decision: "pending",
        });

        await tx.insert(metricPoints).values(
          Array.from({ length: 14 }, (_, idx) => {
            const i = 13 - idx;
            const score = (k: number) =>
              Math.max(
                5,
                Math.min(99, Math.round(scored.layers[k]!.score - i / 2)),
              );
            return {
              agentId: inserted.id,
              timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
              efficacy: score(0),
              efficiency: score(1),
              adoption: score(2),
              governance: score(3),
              value: score(4),
            };
          }),
        );

        return inserted;
      });

      created.push(agent);
    }

    res.status(201).json(created.map(toAgentSummary));
  },
);

export default router;
