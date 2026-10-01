import { Router, type IRouter, type Response } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  agents,
  agentIdentities,
  agentOwners,
  evaluations,
  verdicts,
  connectors,
  connectorCredentials,
  connectorApiKeys,
  metricPoints,
} from "@workspace/db";
import type { ConnectorMode } from "@workspace/db";
import {
  ListConnectorsResponse,
  ConnectPlatformBody,
  DiscoverAgentsParams,
  DiscoverAgentsResponse,
  ImportDiscoveredAgentsParams,
  ImportDiscoveredAgentsBody,
  RegisterConnectorBody,
  TestConnectorResponse,
  PreAssessAgentSourceBody,
  PreAssessAgentSourceResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import { ofOrg } from "../lib/tenant-scope";
import { toAgentSummary } from "../lib/serializers";
import {
  PLATFORM_CATALOG,
  buildProposedMetrics,
  proposedMetricsFromDraft,
  scoreEvaluation,
} from "../lib/discovery";
import { getConnectorImpl } from "../lib/connectors/registry";
import { connectorCapabilities } from "../lib/connectors/registry";
import { resolveImportSource } from "../lib/connectors/import-source";
import { fetchAgentSourceFromUrl, FetchSourceError } from "../lib/fetch-source";
import { preAssess } from "../lib/pre-assessment";
import {
  ConnectorCredentialError,
  connectorCredentialEncryptionKey,
  encryptConnectorCredential,
  materializeConnectorCredentialForAdapter,
} from "../lib/connectors/credential-crypto";
import { redactConnectorMetadata } from "../lib/connectors/redaction";
import { generateConnectorApiKey } from "../lib/connector-api-key";

const router: IRouter = Router();

router.get(
  "/connectors/capabilities",
  requireAuth,
  requireOrg,
  async (_req, res) => {
    res.json(connectorCapabilities());
  },
);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type ConnectorRow = typeof connectors.$inferSelect;

function nextConnectorAction(row: ConnectorRow): string {
  if (row.status === "error") return "Corrigir a configuração e repetir o teste.";
  if (row.status === "degraded") return "Revisar eventos recentes e a credencial da integração.";
  if (row.mode === "native" && row.status === "connected") return "Executar discovery e selecionar os agentes para admissão.";
  if (row.status === "configured") return "Enviar o primeiro evento real para comprovar a conexão.";
  if (row.status === "connected") return "Acompanhar freshness, cobertura e qualidade dos eventos.";
  return "Escolher um método de conexão e concluir a configuração.";
}

function serializeConnector(
  row: ConnectorRow,
  setup?: { apiKey: string; endpoint: string },
) {
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    status: row.status,
    mode: row.mode,
    health: row.health,
    agentsDiscovered: row.agentsDiscovered,
    category: row.category,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    nextAction: nextConnectorAction(row),
    ...(setup
      ? { setupApiKey: setup.apiKey, setupEndpoint: setup.endpoint }
      : {}),
  };
}

function modeForPlatform(platform: string): ConnectorMode {
  return platform === "kubernetes-otel" ? "runtime" : "universal";
}

const CAPABILITY_ALIASES: Record<string, string> = {
  "zendesk-ai": "zendesk",
  "salesforce-agentforce": "agentforce",
  "openai-assistants": "openai-agents",
  "github-copilot": "openai-agents",
};

router.get("/connectors", requireAuth, requireOrg, async (req, res) => {
  const rows = await db
    .select()
    .from(connectors)
    .where(ofOrg(connectors, req.orgId!));

  const existingPlatforms = new Set(rows.map((r) => r.platform));
  const catalogExtras = PLATFORM_CATALOG.filter(
    (p) => !existingPlatforms.has(p.platform),
  ).map((p) => ({
    id: `catalog_${p.platform}`,
    platform: p.platform,
    name: p.name,
    status: "available" as const,
    mode: "universal" as const,
    health: "unverified" as const,
    agentsDiscovered: 0,
    category: p.category,
    lastSyncAt: null,
    lastTestedAt: null,
    lastEventAt: null,
    nextAction: "Configurar uma integração real antes de coletar dados.",
  }));

  const data = ListConnectorsResponse.parse([
    ...rows.map((row) => serializeConnector(row)),
    ...catalogExtras,
  ]);

  res.json(data);
});

router.post(
  "/connectors",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const body = ConnectPlatformBody.parse(req.body);
    const capabilityKey = CAPABILITY_ALIASES[body.platform] ?? body.platform;
    const capability = connectorCapabilities().find(
      (entry) => entry.platform === capabilityKey,
    );
    if (!capability || capability.mode === "planned") {
      res.status(422).json({
        error: "Esta plataforma ainda não possui um caminho operacional de integração.",
      });
      return;
    }
    if (body.platform === "github") {
      res.status(422).json({
        error: "GitHub usa adapter nativo. Configure a credencial no fluxo GitHub.",
      });
      return;
    }
    if (!capability.capabilities.collectTelemetry && !capability.capabilities.collectMetrics) {
      res.status(422).json({
        error: "Esta plataforma ainda não pode enviar telemetria ou métricas ao Muster.",
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(connectors)
      .where(
        and(
          eq(connectors.platform, body.platform),
          ofOrg(connectors, req.orgId!),
        ),
      );

    const generated = generateConnectorApiKey();
    const configured = await db.transaction(async (transaction) => {
      let row: ConnectorRow;
      if (existing) {
        const [updated] = await transaction
          .update(connectors)
          .set({
            name: body.name?.trim() || existing.name,
            status: "configured",
            mode: modeForPlatform(body.platform),
            health: "unverified",
            category: capability.mode === "live" ? "Ingestão operacional" : "Contrato universal",
            lastTestedAt: null,
            lastEventAt: null,
          })
          .where(
            and(eq(connectors.id, existing.id), ofOrg(connectors, req.orgId!)),
          )
          .returning();
        row = updated!;
        await transaction
          .update(connectorApiKeys)
          .set({ revokedAt: new Date() })
          .where(eq(connectorApiKeys.connectorId, existing.id));
      } else {
        const [created] = await transaction
          .insert(connectors)
          .values({
            orgId: req.orgId!,
            platform: body.platform,
            name: body.name?.trim() || capability.label,
            category: capability.mode === "live" ? "Ingestão operacional" : "Contrato universal",
            status: "configured",
            mode: modeForPlatform(body.platform),
            health: "unverified",
          })
          .returning();
        row = created!;
      }

      await transaction.insert(connectorApiKeys).values({
        orgId: req.orgId!,
        connectorId: row.id,
        label: "Ingestão principal",
        prefix: generated.prefix,
        keyHash: generated.keyHash,
        createdBy: req.userId ?? null,
      });
      return row;
    });

    res.status(201).json(
      serializeConnector(configured, {
        apiKey: generated.plaintext,
        endpoint: "/api/integrations/agent-events",
      }),
    );
  },
);

// ── R3: real connector registration ─────────────────────────────────────────

async function loadCredential(
  connectorId: string,
  onLegacyMigrated?: () => void,
): Promise<{ token: string | null }> {
  const [row] = await db
    .select()
    .from(connectorCredentials)
    .where(eq(connectorCredentials.connectorId, connectorId))
    .limit(1);
  if (!row) return { token: null };

  const token = await materializeConnectorCredentialForAdapter({
    storedCredential: row.credential,
    connectorId,
    migrateLegacy: row.credential
      ? async (encryptedCredential) => {
          const updated = await db
            .update(connectorCredentials)
            .set({
              credential: encryptedCredential,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(connectorCredentials.id, row.id),
                eq(connectorCredentials.credential, row.credential!),
              ),
            )
            .returning({ id: connectorCredentials.id });
          if (updated.length === 1) onLegacyMigrated?.();
          return updated.length === 1;
        }
      : undefined,
  });
  return { token };
}

function sendCredentialError(res: Response, error: unknown): boolean {
  if (!(error instanceof ConnectorCredentialError)) return false;
  const status =
    error.code === "connector_legacy_credential_blocked" ||
    error.code === "connector_credential_corrupted"
      ? 409
      : 503;
  res.status(status).json({ error: error.message, code: error.code });
  return true;
}

router.post(
  "/connectors/:connectorId/pre-assess",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const { connectorId } = DiscoverAgentsParams.parse(req.params);
    const body = PreAssessAgentSourceBody.parse(req.body);
    const [connector] = await db
      .select()
      .from(connectors)
      .where(and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)))
      .limit(1);
    if (!connector) {
      res.status(404).json({ error: "Conector não encontrado." });
      return;
    }

    try {
      const credential = await loadCredential(connector.id);
      const fetched = await fetchAgentSourceFromUrl(body.url, {
        githubToken: connector.platform === "github" ? credential.token : null,
      });
      const result = preAssess(fetched.content, body.nameHint);
      res.json(PreAssessAgentSourceResponse.parse(result));
    } catch (error) {
      if (sendCredentialError(res, error)) return;
      if (error instanceof FetchSourceError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      req.log.error(
        redactConnectorMetadata({ err: error, connectorId, platform: connector.platform }),
        "Connector pre-assessment failed",
      );
      res.status(502).json({ error: "Não foi possível pré-avaliar o repositório." });
    }
  },
);

router.post(
  "/connectors/register",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const body = RegisterConnectorBody.parse(req.body);

    const impl = getConnectorImpl(body.platform);
    if (!impl) {
      res.status(422).json({
        error: `Plataforma "${body.platform}" ainda não tem conector real. Disponível: github.`,
      });
      return;
    }

    const token = body.token?.trim() || null;
    let encryptionKey: Buffer | null = null;
    if (token) {
      try {
        encryptionKey = connectorCredentialEncryptionKey();
      } catch (error) {
        if (sendCredentialError(res, error)) return;
        throw error;
      }
    }

    const test = await impl.testConnection({ token });
    const connector = await db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(connectors)
        .values({
          orgId: req.orgId!,
          platform: body.platform,
          name: body.name,
          status: test.ok ? "connected" : "error",
          mode: "native",
          health: test.ok ? "healthy" : "error",
          category: "Adapter nativo",
          agentsDiscovered: 0,
          lastTestedAt: new Date(),
        })
        .returning();

      await transaction.insert(connectorCredentials).values({
        connectorId: created!.id,
        authMethod: token ? "token" : "env",
        credential:
          token && encryptionKey
            ? encryptConnectorCredential(token, created!.id, encryptionKey)
            : null,
      });
      return created!;
    });

    res.status(201).json({
      connector: serializeConnector(connector),
      test,
    });
  },
);

router.post(
  "/connectors/:connectorId/test",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const connectorId = req.params.connectorId as string;
    const [connector] = await db
      .select()
      .from(connectors)
      .where(and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)))
      .limit(1);
    if (!connector) {
      res.status(404).json({ error: "Conector não encontrado." });
      return;
    }
    const impl = getConnectorImpl(connector.platform);
    if (!impl) {
      const testedAt = new Date();
      const [activeKey] = await db
        .select({ id: connectorApiKeys.id })
        .from(connectorApiKeys)
        .where(
          and(
            eq(connectorApiKeys.connectorId, connectorId),
            isNull(connectorApiKeys.revokedAt),
          ),
        )
        .limit(1);
      if (!activeKey) {
        await db
          .update(connectors)
          .set({ lastTestedAt: testedAt, status: "error", health: "error" })
          .where(and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)));
        res.json(
          TestConnectorResponse.parse({
            ok: false,
            message: "A configuração não possui chave de ingestão ativa. Gere uma nova chave para continuar.",
          }),
        );
        return;
      }
      const hasEvents = connector.lastEventAt !== null;
      await db
        .update(connectors)
        .set({
          lastTestedAt: testedAt,
          status: hasEvents ? "connected" : "configured",
          health: hasEvents ? "healthy" : "unverified",
        })
        .where(and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)));
      res.json(
        TestConnectorResponse.parse({
          ok: true,
          message: hasEvents
            ? "Credencial de ingestão válida e eventos reais recebidos pelo Muster."
            : "Endpoint e credencial preparados. Aguardando o primeiro evento real para confirmar a conexão.",
        }),
      );
      return;
    }
    let cred: Awaited<ReturnType<typeof loadCredential>>;
    try {
      cred = await loadCredential(connectorId, () => {
        req.log.info(
          redactConnectorMetadata({
            connectorId,
            platform: connector.platform,
          }),
          "Legacy connector credential migrated",
        );
      });
    } catch (error) {
      if (sendCredentialError(res, error)) return;
      throw error;
    }
    const result = await impl.testConnection(cred);
    await db
      .update(connectors)
      .set({
        status: result.ok ? "connected" : "error",
        health: result.ok ? "healthy" : "error",
        lastTestedAt: new Date(),
      })
      .where(and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)));
    res.json(TestConnectorResponse.parse(result));
  },
);

router.post(
  "/connectors/:connectorId/discover",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const { connectorId } = DiscoverAgentsParams.parse(req.params);

    const [connector] = await db
      .select()
      .from(connectors)
      .where(
        and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)),
      );

    if (!connector) {
      res.status(404).json({ error: "Conector não encontrado." });
      return;
    }
    const platformKey = connector.platform;

    // Real implementation first: live discovery on the platform.
    const impl = getConnectorImpl(platformKey);
    if (impl) {
      let cred: Awaited<ReturnType<typeof loadCredential>>;
      try {
        cred = await loadCredential(connector.id, () => {
          req.log.info(
            redactConnectorMetadata({
              connectorId: connector.id,
              platform: connector.platform,
            }),
            "Legacy connector credential migrated",
          );
        });
      } catch (error) {
        if (sendCredentialError(res, error)) return;
        throw error;
      }
      const candidates = await impl.discoverAgents(cred);

      const importedExternalIds = new Set(
        (
          await db
            .select({ externalId: agents.externalId })
            .from(agents)
            .where(ofOrg(agents, req.orgId!))
        )
          .map((r) => r.externalId)
          .filter((x): x is string => Boolean(x)),
      );

      const discoveredAgents = candidates.map((c) => {
        // Real candidates carry detection signals, not KPI signals — frame a
        // full 5-layer metric proposal from the catalog defaults instead.
        const proposedMetrics = proposedMetricsFromDraft(c.externalId, []);
        const scored = scoreEvaluation(c.externalId, proposedMetrics);
        return {
          externalId: c.externalId,
          name: c.name,
          role: c.description || c.stack || "Agente descoberto",
          platform: platformKey,
          sourceUrl: c.url,
          signals: c.signals,
          proposedMetrics,
          proposedVerdict: scored.verdict,
          confidence: c.confidence,
          alreadyImported: importedExternalIds.has(c.externalId),
        };
      });

      await db
        .update(connectors)
        .set({
          status: "connected",
          agentsDiscovered: discoveredAgents.length,
          lastSyncAt: new Date(),
        })
        .where(
          and(eq(connectors.id, connector.id), ofOrg(connectors, req.orgId!)),
        );

      res.json(
        DiscoverAgentsResponse.parse({
          connectorId,
          platform: platformKey,
          discoveredAt: new Date().toISOString(),
          agentsFound: discoveredAgents.length,
          agents: discoveredAgents,
          coverageNote: `Descoberta REAL via ${impl.displayName}: ${discoveredAgents.length} candidato(s) a agente encontrados. Métricas iniciais enquadradas pelo catálogo — refine no pré-assessment.`,
        }),
      );
      return;
    }
    res.status(422).json({
      error: "Este conector recebe telemetria, mas não implementa discovery nativo. Admita o agente com o mesmo externalId usado no envelope.",
    });
  },
);

router.post(
  "/connectors/:connectorId/import",
  requireAuth,
  requireOrg,
  requireOrgAdmin,
  async (req, res) => {
    const { connectorId } = ImportDiscoveredAgentsParams.parse(req.params);
    const body = ImportDiscoveredAgentsBody.parse(req.body);

    const [connector] = await db
      .select()
      .from(connectors)
      .where(
        and(eq(connectors.id, connectorId), ofOrg(connectors, req.orgId!)),
      );
    if (!connector) {
      res.status(404).json({ error: "Conector não encontrado." });
      return;
    }
    const platformKey = connector.platform;
    const catalog = PLATFORM_CATALOG.find((p) => p.platform === platformKey);
    const impl = getConnectorImpl(platformKey);
    if (!impl) {
      res.status(422).json({
        error: "Este conector não possui importação automática. Admita o agente e use o mesmo externalId do envelope de telemetria.",
      });
      return;
    }
    let realCandidates: Awaited<
      ReturnType<NonNullable<typeof impl>["discoverAgents"]>
    > = [];
    if (connector) {
      let credential: Awaited<ReturnType<typeof loadCredential>>;
      try {
        credential = await loadCredential(connector.id, () => {
          req.log.info(
            redactConnectorMetadata({
              connectorId: connector.id,
              platform: connector.platform,
            }),
            "Legacy connector credential migrated",
          );
        });
      } catch (error) {
        if (sendCredentialError(res, error)) return;
        throw error;
      }
      realCandidates = await impl.discoverAgents(credential);
    }
    const realCandidatesById = new Map(
      realCandidates.map((candidate) => [candidate.externalId, candidate]),
    );

    const existing = await db
      .select({ externalId: agents.externalId })
      .from(agents)
      .where(
        and(
          inArray(agents.externalId, body.externalIds),
          ofOrg(agents, req.orgId!),
        ),
      );
    const alreadyImported = new Set(
      existing.map((r) => r.externalId).filter((x): x is string => Boolean(x)),
    );

    const created: (typeof agents.$inferSelect)[] = [];

    for (const externalId of body.externalIds) {
      if (alreadyImported.has(externalId)) continue;
      const realCandidate = realCandidatesById.get(externalId);
      const catalogCandidate = catalog?.discovered.find(
        (d) => d.externalId === externalId,
      );
      const source = resolveImportSource(realCandidate, catalogCandidate);
      if (!source) continue;

      const platformName = catalog?.name ?? impl?.displayName ?? platformKey;
      let discoveredDraft: ReturnType<typeof preAssess>["draft"] | null = null;
      if (source.isReal && source.url) {
        try {
          const fetched = await fetchAgentSourceFromUrl(source.url);
          discoveredDraft = preAssess(fetched.content, source.name).draft;
        } catch (err) {
          // A connector import should remain usable when a repository becomes
          // private or rate-limited between discovery and import. The fallback
          // still creates an observable agent and the user can pre-assess it later.
          if (!(err instanceof FetchSourceError)) {
            req.log.warn(
              redactConnectorMetadata({ err, externalId }),
              "Source enrichment failed during import",
            );
          }
        }
      }
      const proposed = discoveredDraft
        ? proposedMetricsFromDraft(
            source.externalId,
            discoveredDraft.proposedMetrics,
          )
        : source.isReal
          ? proposedMetricsFromDraft(source.externalId, [])
          : buildProposedMetrics(source.externalId, source.signals);
      const scored = scoreEvaluation(source.externalId, proposed);

      let slug = slugify(source.name);
      const [clash] = await db
        .select()
        .from(agents)
        // Slug é único por organização: a checagem de colisão precisa do mesmo
        // escopo, senão inventaria sufixo por causa de agente de outro cliente.
        .where(and(eq(agents.slug, slug), ofOrg(agents, req.orgId!)));
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;

      const now = Date.now();
      const agent = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(agents)
          .values({
            orgId: req.orgId!,
            externalId: source.externalId,
            name: source.name,
            slug,
            role: discoveredDraft?.role || source.role,
            platform: platformKey,
            version: "1.0.0",
            status: "observation",
            bio:
              discoveredDraft?.bio || `Importado via conector ${platformName}.`,
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
          bio:
            discoveredDraft?.bio || `Importado via conector ${platformName}.`,
          shouldDo: discoveredDraft?.shouldDo ?? [],
          shouldNotDo: discoveredDraft?.shouldNotDo ?? [],
          autonomyLevel: discoveredDraft?.autonomyLevel ?? "escalates",
          autonomyNotes: discoveredDraft?.autonomyNotes,
          limits: discoveredDraft?.limits ?? [],
          businessCase: discoveredDraft
            ? { ...discoveredDraft.businessCase, actualPayback: "—" }
            : {
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

    res.status(201).json(created.map((a) => toAgentSummary(a)));
  },
);

export default router;
