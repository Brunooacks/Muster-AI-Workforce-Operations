import { createHash } from "node:crypto";

export type Currency = "BRL" | "USD";

// TODO(MUS-171): trocar pelos tipos gerados de @workspace/api-zod quando o envelope v2 entrar na main.
export interface EnvelopeV2 {
  contractVersion: "muster.agent-ingestion.v2";
  eventId?: string;
  source: { platform: string; tenant?: string; connectorId?: string; environment?: string; reference?: string };
  agent: { externalId: string; name: string; version?: string; runtime?: string; url?: string; metadata?: Record<string, unknown> };
  execution?: { taskRunId: string; currency?: Currency; id?: string; startedAt?: string; completedAt?: string;
    status?: "success" | "error" | "escalated" | "running"; durationMs?: number; costCents?: number;
    tokensIn?: number; tokensOut?: number; metadata?: Record<string, unknown> };
  observations?: Array<{ metricKey: string; label: string; value: number; unit: string; kind?: "observed" | "inferred" | "synthetic"; confidence?: number; capturedAt?: string; lineage?: Array<{ stage: string; name: string; ref?: string }> }>;
  feedback?: { taskRunId: string; kind: "positive" | "negative" | "correction" | "escalation"; score?: number; comment?: string; currency?: Currency;
    metadata?: Record<string, unknown>;
    validation: { status: "validated" | "rejected" | "unvalidated"; source: "human_review" | "connector" | "self_reported"; reviewerRef?: string } };
}

export interface LangfuseObservationV2 {
  id: string;
  traceId: string;
  startTime: string;
  endTime?: string;
  parentObservationId?: string;
  type: "GENERATION" | "SPAN" | "EVENT" | "AGENT" | "TOOL" | "CHAIN" | "RETRIEVER" | "EVALUATOR" | "EMBEDDING" | "GUARDRAIL";
  isRootObservation?: boolean;
  name?: string;
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
  statusMessage?: string;
  version?: string;
  environment?: string;
  userId?: string;
  sessionId?: string;
  model?: string;
  usageDetails?: Record<string, number>;
  costDetails?: Record<string, number>;
  totalCost?: number;
  latency?: number;
  traceName?: string;
}

export interface LangfuseScoreV3 {
  id: string;
  name: string;
  source: "ANNOTATION" | "API" | "EVAL";
  dataType: "NUMERIC" | "BOOLEAN" | "CATEGORICAL" | "TEXT" | "CORRECTION";
  value: number | boolean | string;
  timestamp?: string;
  environment?: string;
  comment?: string;
  authorUserId?: string;
  subject: { kind: "trace" | "observation" | "session" | "experiment"; id: string; traceId?: string };
}

export interface MapOptions {
  connectorId?: string;
  projectId: string;
  agentKey?: "traceName" | "rootObservationName";
  validation: {
    scoreName: string;
    numericPassThreshold?: number;
    categoricalPass?: string[];
    categoricalReject?: string[];
  };
  fx?: { usdToBrl: number; rateDate: string; source: string };
}

export function mapLangfuseToEnvelopeV2(
  input: { traceId: string; observations: LangfuseObservationV2[]; scores: LangfuseScoreV3[] },
  options: MapOptions,
): { envelopes: EnvelopeV2[]; warnings: string[] } {
  const warnings = new Set<string>();
  const observations = [...input.observations].sort(compareByTimeAndId);
  const scores = [...input.scores].sort(compareScores);
  const root = observations.find((observation) => observation.isRootObservation);
  const traceName = observations.find((observation) => hasText(observation.traceName))?.traceName;
  const rootName = root?.name;
  const agentName = options.agentKey === "rootObservationName"
    ? rootName ?? traceName
    : traceName ?? rootName;

  if (!hasText(agentName)) {
    return { envelopes: [], warnings: ["missing_agent_name"] };
  }

  const taskRunId = `langfuse:${options.projectId}:${input.traceId}`;
  const environment = observations.find((observation) => hasText(observation.environment))?.environment;
  const models = unique(observations.map((observation) => observation.model).filter(hasText));
  const execution = buildExecution(observations, taskRunId, input.traceId, options, warnings);
  const evaluationEvidence = buildEvaluationEvidence(scores, input.traceId, warnings);

  const executionEnvelope: EnvelopeV2 = {
    contractVersion: "muster.agent-ingestion.v2",
    eventId: `${taskRunId}:execution`,
    source: {
      platform: "langfuse",
      ...(options.connectorId ? { connectorId: options.connectorId } : {}),
      ...(environment ? { environment } : {}),
      reference: options.projectId,
    },
    agent: {
      externalId: `langfuse:${options.projectId}:${agentName}`,
      name: agentName,
      metadata: {
        source: "langfuse",
        projectId: options.projectId,
        ...(environment ? { environment } : {}),
        models,
      },
    },
    execution,
    ...(evaluationEvidence.length > 0 ? { observations: evaluationEvidence } : {}),
  };

  const envelopes = [executionEnvelope];
  const annotation = selectValidationAnnotation(scores, input.traceId, options.validation.scoreName);
  if (!annotation) {
    warnings.add("insufficient_evidence:no_validation_score");
  } else {
    const validation = classifyAnnotation(annotation, options.validation);
    if (validation.status === "unvalidated") {
      warnings.add("insufficient_evidence:annotation_not_conclusive");
    } else {
      envelopes.push({
        contractVersion: "muster.agent-ingestion.v2",
        eventId: `${taskRunId}:feedback`,
        source: executionEnvelope.source,
        agent: executionEnvelope.agent,
        feedback: {
          taskRunId,
          kind: validation.status === "validated" ? "positive" : "negative",
          ...(validation.score !== undefined ? { score: validation.score } : {}),
          ...(annotation.comment ? { metadata: { hasComment: true } } : {}),
          validation: {
            status: validation.status,
            source: "human_review",
            ...(annotation.authorUserId ? { reviewerRef: annotation.authorUserId } : {}),
          },
        },
      });
    }
  }

  return { envelopes, warnings: [...warnings] };
}

function buildExecution(
  observations: LangfuseObservationV2[],
  taskRunId: string,
  traceId: string,
  options: MapOptions,
  warnings: Set<string>,
): NonNullable<EnvelopeV2["execution"]> {
  const startedAt = observations[0]?.startTime;
  const hasOpenObservation = observations.some((observation) => !hasText(observation.endTime));
  const endedObservations = observations.filter((observation) => hasText(observation.endTime));
  const completedAt = hasOpenObservation
    ? undefined
    : endedObservations.reduce<string | undefined>(
      (latest, observation) => !latest || observation.endTime! > latest ? observation.endTime : latest,
      undefined,
    );
  const generationObservations = observations.filter((observation) => observation.type === "GENERATION");
  const tokenObservations = observations.filter((observation) => observation.type === "GENERATION" || observation.type === "EMBEDDING");
  const usdCosts = observations
    .map((observation) => observation.totalCost)
    .filter((cost): cost is number => typeof cost === "number" && Number.isFinite(cost));
  const totalUsd = usdCosts.reduce((total, cost) => total + cost, 0);
  const sessionId = observations.find((observation) => hasText(observation.sessionId))?.sessionId;
  const metadata: Record<string, unknown> = {
    langfuse: {
      traceId,
      observationCount: observations.length,
      generationCount: generationObservations.length,
      toolCount: observations.filter((observation) => observation.type === "TOOL").length,
      errorCount: observations.filter((observation) => observation.level === "ERROR").length,
      ...(sessionId ? { sessionIdHash: sha256Truncated(sessionId) } : {}),
    },
  };

  const execution: NonNullable<EnvelopeV2["execution"]> = {
    taskRunId,
    ...(startedAt ? { startedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
    status: hasOpenObservation
      ? "running"
      : observations.some((observation) => observation.level === "ERROR")
        ? "error"
        : "success",
    ...(startedAt && completedAt ? { durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()) } : {}),
    ...(sumUsage(tokenObservations, "input") !== undefined ? { tokensIn: sumUsage(tokenObservations, "input") } : {}),
    ...(sumUsage(tokenObservations, "output") !== undefined ? { tokensOut: sumUsage(tokenObservations, "output") } : {}),
    metadata,
  };

  if (usdCosts.length > 0) {
    if (options.fx) {
      execution.currency = "BRL";
      execution.costCents = roundHalfUp(totalUsd * options.fx.usdToBrl * 100);
      metadata.fx = {
        fromCurrency: "USD",
        rate: options.fx.usdToBrl,
        rateDate: options.fx.rateDate,
        source: options.fx.source,
        originalAmountUsd: totalUsd,
      };
    } else {
      execution.currency = "USD";
      execution.costCents = roundHalfUp(totalUsd * 100);
      warnings.add("missing_fx_rate");
    }
  }

  return execution;
}

function buildEvaluationEvidence(
  scores: LangfuseScoreV3[],
  traceId: string,
  warnings: Set<string>,
): NonNullable<EnvelopeV2["observations"]> {
  const evidence: NonNullable<EnvelopeV2["observations"]> = [];
  for (const score of scores) {
    if ((score.source !== "EVAL" && score.source !== "API") || !belongsToTrace(score, traceId)) continue;
    const value = score.dataType === "NUMERIC" && typeof score.value === "number"
      ? score.value
      : score.dataType === "BOOLEAN" && typeof score.value === "boolean"
        ? Number(score.value)
        : undefined;
    if (value === undefined) {
      warnings.add("eval_non_numeric");
      continue;
    }
    evidence.push({
      metricKey: `langfuse.eval.${score.name}`,
      label: score.name,
      value,
      unit: "score",
      kind: "inferred",
      confidence: 0.5,
      ...(score.timestamp ? { capturedAt: score.timestamp } : {}),
      lineage: [{ stage: "source", name: "langfuse_eval", ref: score.id }],
    });
  }
  return evidence;
}

function selectValidationAnnotation(
  scores: LangfuseScoreV3[],
  traceId: string,
  scoreName: string,
): LangfuseScoreV3 | undefined {
  const candidates = scores.filter((score) =>
    score.source === "ANNOTATION" && score.name === scoreName && belongsToTrace(score, traceId),
  );
  // Entre anotações no mesmo instante, a rejeição vence de forma conservadora.
  return candidates.sort((left, right) => {
    const timeDifference = scoreTime(right) - scoreTime(left);
    if (timeDifference !== 0) return timeDifference;
    const leftRejected = isRejectedAnnotation(left);
    const rightRejected = isRejectedAnnotation(right);
    if (leftRejected !== rightRejected) return leftRejected ? -1 : 1;
    return left.id.localeCompare(right.id);
  })[0];
}

function classifyAnnotation(
  score: LangfuseScoreV3,
  validation: MapOptions["validation"],
): { status: "validated" | "rejected" | "unvalidated"; score?: number } {
  if (score.dataType === "BOOLEAN" && typeof score.value === "boolean") {
    return { status: score.value ? "validated" : "rejected", score: Number(score.value) };
  }
  if (score.dataType === "NUMERIC" && typeof score.value === "number") {
    return { status: score.value >= (validation.numericPassThreshold ?? 0.5) ? "validated" : "rejected", score: score.value };
  }
  if (score.dataType === "CATEGORICAL" && typeof score.value === "string") {
    if (validation.categoricalPass?.includes(score.value)) return { status: "validated" };
    if (validation.categoricalReject?.includes(score.value)) return { status: "rejected" };
  }
  return { status: "unvalidated" };
}

function isRejectedAnnotation(score: LangfuseScoreV3): boolean {
  return (score.dataType === "BOOLEAN" && score.value === false) ||
    (score.dataType === "NUMERIC" && typeof score.value === "number" && score.value < 0.5);
}

function belongsToTrace(score: LangfuseScoreV3, traceId: string): boolean {
  return (score.subject.kind === "trace" && score.subject.id === traceId) ||
    (score.subject.kind === "observation" && score.subject.traceId === traceId);
}

function sumUsage(observations: LangfuseObservationV2[], key: "input" | "output"): number | undefined {
  const values = observations
    .map((observation) => observation.usageDetails?.[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

function compareByTimeAndId(left: LangfuseObservationV2, right: LangfuseObservationV2): number {
  return left.startTime.localeCompare(right.startTime) || left.id.localeCompare(right.id);
}

function compareScores(left: LangfuseScoreV3, right: LangfuseScoreV3): number {
  return scoreTime(left) - scoreTime(right) || left.id.localeCompare(right.id);
}

function scoreTime(score: LangfuseScoreV3): number {
  return score.timestamp ? new Date(score.timestamp).getTime() : 0;
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + Number.EPSILON);
}

function sha256Truncated(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
