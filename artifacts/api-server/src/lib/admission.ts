import { eq } from "drizzle-orm";
import {
  db,
  agents,
  agentIdentities,
  agentOwners,
  evaluations,
  verdicts,
  metricPoints,
  type AutonomyLevel,
} from "@workspace/db";
import {
  buildProposedMetrics,
  proposedMetricsFromDraft,
  scoreEvaluation,
  type DraftMetricInput,
} from "./discovery";

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
export async function admitAgentTx(
  tx: Tx,
  input: AdmitAgentInput,
): Promise<string> {
  const externalId =
    input.externalId ?? `manual_${slugify(input.name)}_${Date.now()}`;

  if (input.externalId) {
    const [existingExt] = await tx
      .select()
      .from(agents)
      .where(eq(agents.externalId, externalId));
    if (existingExt) throw new AlreadyAdmittedError(externalId);
  }

  const proposed =
    input.proposedMetrics && input.proposedMetrics.length > 0
      ? proposedMetricsFromDraft(externalId, input.proposedMetrics)
      : buildProposedMetrics(externalId, DEFAULT_SIGNALS);
  const scored = scoreEvaluation(externalId, proposed);

  let slug = slugify(input.name);
  const [clash] = await tx.select().from(agents).where(eq(agents.slug, slug));
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  const now = Date.now();
  try {
    const [agent] = await tx
      .insert(agents)
      .values({
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
      },
      version: 1,
    });

    await tx.insert(agentOwners).values({
      agentId: agent.id,
      businessOwner: input.businessOwner ?? "",
      technicalOwner: input.technicalOwner ?? "",
      governanceSponsor: input.governanceSponsor ?? "",
    });

    await tx.insert(evaluations).values({
      agentId: agent.id,
      window: "30d",
      layers: scored.layers,
      verdict: "observation",
      verdictConfidence: scored.verdictConfidence,
      rationale:
        input.initialEvaluationRationale ??
        "Avaliação inicial gerada na admissão; manter em observação até consolidar dados reais.",
    });

    await tx.insert(verdicts).values({
      agentId: agent.id,
      verdict: "observation",
      confidence: scored.verdictConfidence,
      executionWindow: "60 dias",
      suggestedSponsor:
        input.suggestedSponsor ?? input.governanceSponsor ?? "Comitê",
      nextActions: [
        {
          action: "Coletar 30 dias de métricas reais via conector",
          owner: "Dono técnico",
          due: "30 dias",
        },
      ],
      rationale:
        input.initialVerdictRationale ??
        "Agente recém-admitido; aguardando dados suficientes para um veredito conclusivo.",
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
          agentId: agent.id,
          timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
          efficacy: score(0),
          efficiency: score(1),
          adoption: score(2),
          governance: score(3),
          value: score(4),
        };
      }),
    );

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
