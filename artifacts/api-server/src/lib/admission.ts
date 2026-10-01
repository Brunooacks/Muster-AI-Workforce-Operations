import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  agents,
  connectors,
  agentConnectorLinks,
  agentIdentities,
  agentOwners,
  catalogMetrics,
  evaluations,
  verdicts,
  verdictActions,
  type NextAction,
  metricPoints,
  type AutonomyLevel,
} from "@workspace/db";
import {
  buildProposedMetrics,
  proposedMetricsFromDraft,
  scoreEvaluation,
  type DraftMetricInput,
} from "./discovery";
import {
  noEvidenceEvaluation,
  seededEvaluationsAllowed,
} from "./evaluation-policy";

// Default signals used to seed an initial evaluation when no proposed metrics
// are supplied at admission.
const DEFAULT_SIGNALS = [
  "resolution_rate",
  "handle_time",
  "adoption_rate",
  "policy_violations",
  "value_generated",
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Raised when admitting an agent whose externalId (or slug) is already in the
// fleet, so callers (e.g. draft approval) can surface a 409 instead of a 500.
export class AlreadyAdmittedError extends Error {
  constructor(public externalId: string) {
    super(`Agent already admitted: ${externalId}`);
    this.name = "AlreadyAdmittedError";
  }
}

export class InvalidAdmissionConnectorError extends Error {
  constructor(public connectorId: string) {
    super(`Connector is not available in this organization: ${connectorId}`);
    this.name = "InvalidAdmissionConnectorError";
  }
}

export class MissingConnectorExternalIdError extends Error {
  constructor() {
    super("An externalId is required when admission is linked to a connector");
    this.name = "MissingConnectorExternalIdError";
  }
}

export class InvalidAdmissionCatalogMetricError extends Error {
  constructor(public metricKey: string) {
    super(`Catalog metric is not available in this organization: ${metricKey}`);
    this.name = "InvalidAdmissionCatalogMetricError";
  }
}

// Drizzle transaction executor type (same surface as `db` for our usage).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export interface AdmitAgentInput {
  /** Organização dona do agente. Obrigatório: sem tenant não há admissão. */
  orgId: string;
  /**
   * Área responsável dentro da organização. Opcional: um agente descoberto por
   * varredura chega sem dono declarado, e recusar a admissão por isso apenas
   * deixaria o agente invisível — que é o problema que a plataforma existe para
   * resolver. Ele entra como "sem área" e a atribuição vira pendência visível.
   */
  areaId?: string | null;
  name: string;
  role: string;
  platform: string;
  bio: string;
  version?: string;
  tagline?: string;
  shouldDo?: string[];
  shouldNotDo?: string[];
  autonomyLevel?: AutonomyLevel;
  autonomyNotes?: string;
  limits?: string[];
  businessOwner?: string;
  technicalOwner?: string;
  governanceSponsor?: string;
  baseline?: string;
  targetPayback?: string;
  businessCaseDescription?: string;
  proposedMetrics?: DraftMetricInput[];
  // When provided, keep the platform-native id (e.g. from a connector/draft);
  // otherwise a unique manual id is generated. A clash throws AlreadyAdmitted.
  externalId?: string;
  /** Origem autenticada escolhida na admissão para discovery e telemetria. */
  connectorId?: string;
  initialEvaluationRationale?: string;
  initialVerdictRationale?: string;
  suggestedSponsor?: string;
}

// Single source of truth for admitting an agent into the fleet: builds a seeded
// 5-layer evaluation, then atomically inserts the agent, Carteira de Trabalho
// (identity), owners, initial evaluation, pending verdict and 14d of metric
// points. Reused by manual admission and mass-discovery draft approval.
// Transaction-scoped admission, so callers (e.g. draft approval) can run the
// admission and their own bookkeeping atomically in a single transaction. A
// unique-constraint conflict (externalId/slug) is surfaced as AlreadyAdmitted.
/** Plano de ação com que todo agente recém-admitido nasce. */
const NEXT_ACTIONS_INICIAIS: NextAction[] = [
  {
    action: "Coletar 30 dias de métricas reais via conector",
    owner: "Dono técnico",
    due: "30 dias",
  },
];

export async function admitAgentTx(
  tx: Tx,
  input: AdmitAgentInput,
): Promise<string> {
  const externalId =
    input.externalId ?? `manual_${slugify(input.name)}_${Date.now()}`;

  if (input.connectorId) {
    if (!input.externalId) throw new MissingConnectorExternalIdError();
    const [connector] = await tx
      .select({ id: connectors.id })
      .from(connectors)
      .where(and(eq(connectors.id, input.connectorId), eq(connectors.orgId, input.orgId)))
      .limit(1);
    if (!connector) throw new InvalidAdmissionConnectorError(input.connectorId);
  }

  const referencedMetricKeys = [
    ...new Set(
      (input.proposedMetrics ?? [])
        .map((metric) => metric.catalogMetricKey)
        .filter((key): key is string => Boolean(key)),
    ),
  ];
  if (referencedMetricKeys.length > 0) {
    const availableMetrics = await tx
      .select({ key: catalogMetrics.key })
      .from(catalogMetrics)
      .where(
        and(
          eq(catalogMetrics.orgId, input.orgId),
          inArray(catalogMetrics.key, referencedMetricKeys),
        ),
      );
    const availableKeys = new Set(availableMetrics.map((metric) => metric.key));
    const missingMetricKey = referencedMetricKeys.find(
      (key) => !availableKeys.has(key),
    );
    if (missingMetricKey) {
      throw new InvalidAdmissionCatalogMetricError(missingMetricKey);
    }
  }

  // As duas conferências abaixo são POR ORGANIZAÇÃO porque a unicidade também é
  // (índices compostos, migração 0009). Sem o filtro, admitir "Triagem" numa
  // empresa falharia porque outra empresa já tem um agente com esse nome — um
  // 409 que revela a existência de dado alheio e ainda impede o cadastro.
  if (input.externalId) {
    const [existingExt] = await tx
      .select()
      .from(agents)
      .where(and(eq(agents.externalId, externalId), eq(agents.orgId, input.orgId)));
    if (existingExt) throw new AlreadyAdmittedError(externalId);
  }

  const allowSeeded = seededEvaluationsAllowed();
  const scored = allowSeeded
    ? scoreEvaluation(
        externalId,
        input.proposedMetrics && input.proposedMetrics.length > 0
          ? proposedMetricsFromDraft(externalId, input.proposedMetrics)
          : buildProposedMetrics(externalId, DEFAULT_SIGNALS),
      )
    : noEvidenceEvaluation();

  let slug = slugify(input.name);
  const [clash] = await tx
    .select()
    .from(agents)
    .where(and(eq(agents.slug, slug), eq(agents.orgId, input.orgId)));
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  const now = Date.now();
  try {
    const [agent] = await tx
      .insert(agents)
      .values({
        orgId: input.orgId,
        areaId: input.areaId ?? null,
        externalId,
        name: input.name,
        slug,
        role: input.role,
        platform: input.platform,
        version: input.version ?? "1.0.0",
        status: "observation",
        bio: input.bio,
        tagline: input.tagline ?? "",
        currentVerdict: "observation",
        verdictConfidence: scored.verdictConfidence,
        severity: scored.severity,
        healthScore: scored.healthScore,
        activeAlerts: 0,
        monthlyValue: 0,
        monthlyCost: 0,
      })
      .returning();
    if (!agent) throw new Error("Failed to create agent");

    await tx.insert(agentIdentities).values({
      agentId: agent.id,
      bio: input.bio,
      shouldDo: input.shouldDo ?? [],
      shouldNotDo: input.shouldNotDo ?? [],
      autonomyLevel: input.autonomyLevel ?? "escalates",
      autonomyNotes: input.autonomyNotes,
      limits: input.limits ?? [],
      businessCase: {
        baseline: input.baseline ?? "",
        targetPayback: input.targetPayback ?? "",
        actualPayback: "—",
        description: input.businessCaseDescription ?? "",
        metricContracts: (input.proposedMetrics ?? []).map((metric) => ({
          ...(metric.catalogMetricKey
            ? { catalogMetricKey: metric.catalogMetricKey }
            : {}),
          layer: metric.layer,
          label: metric.label,
          unit: metric.unit,
          ...(metric.target ? { target: metric.target } : {}),
          ...(metric.rationale ? { rationale: metric.rationale } : {}),
        })),
      },
      version: 1,
    });

    await tx.insert(agentOwners).values({
      agentId: agent.id,
      businessOwner: input.businessOwner ?? "",
      technicalOwner: input.technicalOwner ?? "",
      governanceSponsor: input.governanceSponsor ?? "",
    });

    if (input.connectorId) {
      await tx.insert(agentConnectorLinks).values({
        orgId: input.orgId,
        agentId: agent.id,
        connectorId: input.connectorId,
        externalId,
        role: "primary",
      });
    }

    await tx.insert(evaluations).values({
      agentId: agent.id,
      window: "30d",
      layers: scored.layers,
      verdict: "observation",
      verdictConfidence: scored.verdictConfidence,
      rationale:
        input.initialEvaluationRationale ??
        (allowSeeded
          ? "Avaliação inicial de demonstração; manter em observação até consolidar dados reais."
          : "Sem evidência observada; conecte a telemetria para calcular as cinco camadas."),
    });

    await tx.insert(verdicts).values({
      agentId: agent.id,
      verdict: "observation",
      confidence: scored.verdictConfidence,
      executionWindow: "60 dias",
      suggestedSponsor:
        input.suggestedSponsor ?? input.governanceSponsor ?? "Comitê",
      nextActions: NEXT_ACTIONS_INICIAIS,
      rationale:
        input.initialVerdictRationale ??
        "Agente recém-admitido; aguardando dados suficientes para um veredito conclusivo.",
      decision: "pending",
    }).returning({ id: verdicts.id }).then(async ([created]) => {
      // O plano de ação nasce rastreável: sem isto, a tela mostraria as ações
      // do agente recém-admitido sem status, quebrando o ciclo de revisão.
      if (!created) return;
      await tx.insert(verdictActions).values(
        NEXT_ACTIONS_INICIAIS.map((a, i) => ({
          verdictId: created.id, agentId: agent.id, sequence: i + 1,
          action: a.action, owner: a.owner, due: a.due,
        })),
      );
    });

    if (allowSeeded) {
      await tx.insert(metricPoints).values(
        Array.from({ length: 14 }, (_, idx) => {
          const daysAgo = 13 - idx;
          const layerScore = (layerIndex: number) =>
            Math.max(
              5,
              Math.min(
                99,
                Math.round(scored.layers[layerIndex]!.score - daysAgo / 2),
              ),
            );
          return {
            agentId: agent.id,
            timestamp: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
            efficacy: layerScore(0),
            efficiency: layerScore(1),
            adoption: layerScore(2),
            governance: layerScore(3),
            value: layerScore(4),
          };
        }),
      );
    }

    return agent.id;
  } catch (err) {
    // Concurrent admission of the same externalId/slug — deterministic 409.
    if (isUniqueViolation(err)) throw new AlreadyAdmittedError(externalId);
    throw err;
  }
}

export async function admitAgent(input: AdmitAgentInput): Promise<string> {
  return db.transaction((tx) => admitAgentTx(tx, input));
}
