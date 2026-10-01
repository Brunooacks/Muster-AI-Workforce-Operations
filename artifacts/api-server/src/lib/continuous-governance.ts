import type {
  GovernanceAssessmentStatus,
  HallucinationAssessmentStatus,
} from "@workspace/db";
import {
  assessAgentRegression,
  type RegressionAssessment,
  type RegressionWindow,
} from "./agent-regression";
import {
  summarizeEvents,
  type AgentEventRow,
  type TelemetrySummary,
} from "./telemetry";

export interface ContinuousGovernanceInput {
  events: AgentEventRow[];
  summary: TelemetrySummary;
  agentVersion: string;
  hasPurpose: boolean;
  hasOwner: boolean;
  hasMetricContracts: boolean;
  evidenceCount: number;
}

export interface ContinuousGovernanceAssessment {
  status: GovernanceAssessmentStatus;
  directionScore: number;
  protectionScore: number;
  proofScore: number;
  contextHealthScore: number | null;
  hallucinationStatus: HallucinationAssessmentStatus;
  groundedOutputRate: number | null;
  hallucinationFlags: number;
  auditedOutputs: number;
  regression: RegressionAssessment;
  recommendations: string[];
  sourceEventCount: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nestedRecord(
  record: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  return record ? asRecord(record[key]) : null;
}

function stringValue(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function booleanValue(
  record: Record<string, unknown> | null,
  ...keys: string[]
): boolean | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function musterMetadata(event: AgentEventRow): Record<string, unknown> | null {
  return nestedRecord(event.metadata, "muster");
}

function releaseId(event: AgentEventRow, fallback: string): string {
  const muster = musterMetadata(event);
  return (
    stringValue(nestedRecord(muster, "release"), "releaseId") ??
    stringValue(muster, "releaseId") ??
    fallback
  );
}

function inputClass(event: AgentEventRow): string {
  const input = nestedRecord(musterMetadata(event), "input");
  return [
    stringValue(input, "taskClass", "class") ?? "unclassified",
    stringValue(input, "domain") ?? "unknown-domain",
    stringValue(input, "language") ?? "unknown-language",
  ].join("|");
}

function inputProfile(events: AgentEventRow[]): Record<string, number> {
  const profile: Record<string, number> = {};
  for (const event of events.filter((candidate) => candidate.kind === "execution")) {
    const input = nestedRecord(musterMetadata(event), "input");
    const key = stringValue(input, "complexity", "taskClass", "class") ?? "unclassified";
    profile[key] = (profile[key] ?? 0) + 1;
  }
  return profile;
}

function dominantComparisonKey(events: AgentEventRow[]): string {
  const counts = new Map<string, number>();
  for (const event of events.filter((candidate) => candidate.kind === "execution")) {
    const key = inputClass(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    ([leftKey, leftCount], [rightKey, rightCount]) =>
      rightCount - leftCount || leftKey.localeCompare(rightKey),
  )[0]?.[0] ?? "unclassified|unknown-domain|unknown-language";
}

function regressionWindows(
  events: AgentEventRow[],
  agentVersion: string,
): [RegressionWindow, RegressionWindow] {
  const byRelease = new Map<string, AgentEventRow[]>();
  for (const event of events) {
    const id = releaseId(event, agentVersion);
    const rows = byRelease.get(id) ?? [];
    rows.push(event);
    byRelease.set(id, rows);
  }
  const releases = [...byRelease.entries()].sort((left, right) => {
    const leftLatest = Math.max(...left[1].map((event) => event.ts.getTime()));
    const rightLatest = Math.max(...right[1].map((event) => event.ts.getTime()));
    return leftLatest - rightLatest;
  });

  if (releases.length >= 2) {
    const [baselineId, baselineEvents] = releases.at(-2)!;
    const [currentId, currentEvents] = releases.at(-1)!;
    return [
      {
        comparisonKey: dominantComparisonKey(baselineEvents),
        releaseId: baselineId,
        summary: summarizeEvents(baselineEvents, 15),
        inputProfile: inputProfile(baselineEvents),
      },
      {
        comparisonKey: dominantComparisonKey(currentEvents),
        releaseId: currentId,
        summary: summarizeEvents(currentEvents, 15),
        inputProfile: inputProfile(currentEvents),
      },
    ];
  }

  const ordered = [...events].sort((left, right) => left.ts.getTime() - right.ts.getTime());
  const executionTimes = ordered
    .filter((event) => event.kind === "execution")
    .map((event) => event.ts.getTime());
  const splitTimestamp = executionTimes[Math.floor(executionTimes.length / 2)] ?? Date.now();
  const baselineEvents = ordered.filter((event) => event.ts.getTime() < splitTimestamp);
  const currentEvents = ordered.filter((event) => event.ts.getTime() >= splitTimestamp);
  const comparisonKey = dominantComparisonKey(ordered);
  return [
    {
      comparisonKey,
      releaseId: agentVersion,
      summary: summarizeEvents(baselineEvents, 15),
      inputProfile: inputProfile(baselineEvents),
    },
    {
      comparisonKey,
      releaseId: agentVersion,
      summary: summarizeEvents(currentEvents, 15),
      inputProfile: inputProfile(currentEvents),
    },
  ];
}

function contextScore(event: AgentEventRow): number | null {
  const context = nestedRecord(musterMetadata(event), "context");
  if (!context) return null;

  const freshness = stringValue(context, "freshness");
  if (freshness) {
    return freshness === "fresh"
      ? 100
      : freshness === "aging"
        ? 70
        : freshness === "stale"
          ? 35
          : 15;
  }

  const sources = Array.isArray(context.sources) ? context.sources : [];
  const sourceScores = sources.flatMap((source) => {
    const status = stringValue(asRecord(source), "status");
    if (!status) return [];
    if (status === "available") return [100];
    if (status === "stale" || status === "truncated") return [50];
    return [0];
  });
  if (sourceScores.length > 0) {
    return Math.round(
      sourceScores.reduce((sum, score) => sum + score, 0) / sourceScores.length,
    );
  }

  const requiredSources = Array.isArray(context.requiredSources)
    ? context.requiredSources
    : Array.isArray(context.required)
      ? context.required
      : [];
  return requiredSources.length > 0 ? 70 : null;
}

function hallucinationEvidence(events: AgentEventRow[]) {
  let auditedOutputs = 0;
  let hallucinationFlags = 0;
  let groundedOutputs = 0;

  for (const event of events) {
    const muster = musterMetadata(event);
    const evaluation = nestedRecord(muster, "evaluation");
    const reason = stringValue(event.metadata, "reason")?.toLowerCase() ?? "";
    const explicitFlag =
      booleanValue(evaluation, "hallucinationFlag", "hallucination") ??
      booleanValue(event.metadata, "hallucinationFlag", "hallucination");
    const grounded =
      booleanValue(evaluation, "grounded", "groundedOutput") ??
      booleanValue(event.metadata, "grounded", "groundedOutput");
    const inferredFlag = reason.includes("not-grounded") || reason.includes("hallucination");
    if (explicitFlag === null && grounded === null && !inferredFlag) continue;

    auditedOutputs += 1;
    const flagged = explicitFlag === true || grounded === false || inferredFlag;
    if (flagged) hallucinationFlags += 1;
    else if (grounded === true || explicitFlag === false) groundedOutputs += 1;
  }

  const groundedOutputRate =
    auditedOutputs > 0 ? groundedOutputs / auditedOutputs : null;
  const flagRate =
    auditedOutputs > 0 ? hallucinationFlags / auditedOutputs : null;
  const status: HallucinationAssessmentStatus =
    auditedOutputs < 10
      ? "not_measured"
      : (flagRate ?? 0) > 0.05 || (groundedOutputRate ?? 1) < 0.9
        ? "critical"
        : (flagRate ?? 0) > 0.01 || (groundedOutputRate ?? 1) < 0.95
          ? "warning"
          : "healthy";

  return { auditedOutputs, hallucinationFlags, groundedOutputRate, status };
}

function clamp(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

export function assessContinuousGovernance(
  input: ContinuousGovernanceInput,
): ContinuousGovernanceAssessment {
  const [baselineWindow, currentWindow] = regressionWindows(
    input.events,
    input.agentVersion,
  );
  const regression = assessAgentRegression(baselineWindow, currentWindow);
  const hallucination = hallucinationEvidence(input.events);
  const contextScores = input.events
    .filter((event) => event.kind === "execution")
    .map(contextScore)
    .filter((score): score is number => score !== null);
  const contextHealthScore =
    contextScores.length > 0
      ? clamp(
          contextScores.reduce((sum, score) => sum + score, 0) /
            contextScores.length,
        )
      : null;

  const directionScore = clamp(
    (input.hasPurpose ? 30 : 0) +
      (input.hasOwner ? 20 : 0) +
      (input.hasMetricContracts ? 30 : 0) +
      (dominantComparisonKey(input.events).startsWith("unclassified") ? 0 : 20),
  );
  let protectionScore = clamp(
    100 -
      (input.summary.errorRate ?? 0) * 250 -
      (input.summary.escalationRate ?? 0) * 100,
  );
  if (hallucination.status === "critical") protectionScore = Math.min(protectionScore, 40);
  if (contextHealthScore !== null) {
    protectionScore = clamp(protectionScore * 0.7 + contextHealthScore * 0.3);
  }
  const proofScore = clamp(
    Math.min(1, input.summary.totalExecutions / 20) * 30 +
      Math.min(1, input.evidenceCount / 5) * 20 +
      (hallucination.groundedOutputRate ?? 0) * 50,
  );

  const recommendations: string[] = [];
  if (!input.hasPurpose || !input.hasMetricContracts) {
    recommendations.push("Formalizar propósito, contrato de KPI e baseline antes de ampliar autonomia.");
  }
  if (hallucination.status === "critical" || hallucination.status === "warning") {
    recommendations.push("Restringir ações irreversíveis e revisar saídas sem evidência fundamentada.");
  } else if (hallucination.status === "not_measured") {
    recommendations.push("Instrumentar avaliação de fundamentação em cada saída relevante.");
  }
  if (regression.status === "regression" && regression.attributable) {
    recommendations.push("Interromper promoção da release e executar rollback ou canário controlado.");
  } else if (regression.status === "drift") {
    recommendations.push("Recalibrar a baseline para o novo perfil de entradas antes de atribuir culpa ao agente.");
  } else if (regression.status === "warning") {
    recommendations.push("Abrir plano de mentoria e comparar a próxima janela antes de promover.");
  }
  if (contextHealthScore === null || contextHealthScore < 70) {
    recommendations.push("Corrigir completude, autorização e frescor das fontes de contexto.");
  }

  const status: GovernanceAssessmentStatus =
    regression.status === "regression" || hallucination.status === "critical"
      ? "critical"
      : regression.status === "warning" ||
          regression.status === "drift" ||
          hallucination.status === "warning" ||
          (contextHealthScore !== null && contextHealthScore < 70)
        ? "attention"
        : input.summary.totalExecutions < 10 || proofScore < 50
          ? "insufficient_data"
          : "healthy";

  return {
    status,
    directionScore,
    protectionScore,
    proofScore,
    contextHealthScore,
    hallucinationStatus: hallucination.status,
    groundedOutputRate: hallucination.groundedOutputRate,
    hallucinationFlags: hallucination.hallucinationFlags,
    auditedOutputs: hallucination.auditedOutputs,
    regression,
    recommendations: Array.from(new Set(recommendations)),
    sourceEventCount: input.events.length,
  };
}
