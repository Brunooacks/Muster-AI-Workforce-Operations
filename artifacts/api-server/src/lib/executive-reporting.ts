import type {
  AgentEventKind,
  AgentStatus,
  ExecutiveMetricComparison,
  ExecutiveReportQuality,
  ExecutiveReportSection,
  LayerKey,
  Severity,
  VerdictType,
} from "@workspace/db";

const LAYERS: LayerKey[] = ["efficacy", "efficiency", "adoption", "governance", "value"];
const LAYER_LABELS: Record<LayerKey, string> = {
  efficacy: "Eficácia",
  efficiency: "Eficiência",
  adoption: "Adoção",
  governance: "Governança",
  value: "Valor",
};

export const EXECUTIVE_REPORT_TEMPLATES = [
  {
    id: "board-brief",
    label: "Board Brief",
    audience: "Conselho e C-level",
    purpose: "Decisões, risco, evolução e pedidos objetivos ao board.",
    sections: ["executive-summary", "outcomes", "risk-governance", "decisions", "outlook"],
  },
  {
    id: "performance-review",
    label: "Performance Review",
    audience: "Gestores de áreas e workforce",
    purpose: "Comparar propósito, qualidade, eficiência, adoção e evolução dos agentes.",
    sections: ["executive-summary", "outcomes", "workforce", "decisions"],
  },
  {
    id: "risk-governance",
    label: "Risk & Governance",
    audience: "Risco, auditoria e comitês",
    purpose: "Concentrar evidências, guardrails, confiança e decisões pendentes.",
    sections: ["executive-summary", "risk-governance", "decisions", "outlook"],
  },
] as const;

export interface ExecutiveAgentInput {
  id: string;
  name: string;
  platform: string;
  status: AgentStatus;
  currentVerdict: VerdictType;
  severity: Severity;
  healthScore: number;
  admittedAt: Date;
}

export interface ExecutiveEventInput {
  id: string;
  agentId: string;
  ts: Date;
  kind: AgentEventKind;
  durationMs: number | null;
  costCents: number | null;
  success: number | null;
}

export interface ExecutiveMetricPointInput {
  id: string;
  agentId: string;
  timestamp: Date;
  efficacy: number;
  efficiency: number;
  adoption: number;
  governance: number;
  value: number;
}

export interface ExecutiveEvaluationInput {
  id: string;
  agentId: string;
  evaluatedAt: Date;
  verdict: VerdictType;
  verdictConfidence: number;
}

export interface ExecutiveAlertInput {
  id: string;
  agentId: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  severity: "critical" | "high" | "medium" | "antecedent";
}

export interface ExecutiveInsightDraft {
  id: string;
  category: string;
  title: string;
  narrative: string;
  recommendation: string;
  severity: "critical" | "high" | "medium" | "low" | "positive";
  confidence: number;
  evidenceRefs: string[];
}

export interface ExecutiveMonthlyReport {
  period: string;
  previousPeriod: string;
  title: string;
  executiveSummary: string;
  generatedAt: string;
  sourceWatermark: string | null;
  narrativeSource: "deterministic" | "ai-assisted";
  aiInsight?: "available" | "unavailable";
  narrativeModel?: string | null;
  promptVersion?: string | null;
  metrics: Record<string, ExecutiveMetricComparison>;
  layerComparison: Record<LayerKey, ExecutiveMetricComparison>;
  portfolio: {
    totalAgents: number;
    activeAgents: number;
    newAgents: number;
    agentsWithExecution: number;
    activeAlerts: number;
    criticalAlerts: number;
    verdicts: Record<VerdictType, number>;
  };
  quality: ExecutiveReportQuality;
  sections: ExecutiveReportSection[];
  insights: ExecutiveInsightDraft[];
}

export interface BuildExecutiveMonthlyReportInput {
  period?: string;
  now?: Date;
  agents: ExecutiveAgentInput[];
  events: ExecutiveEventInput[];
  points: ExecutiveMetricPointInput[];
  evaluations: ExecutiveEvaluationInput[];
  alerts: ExecutiveAlertInput[];
}

export interface ExecutivePeriodBounds {
  period: string;
  previousPeriod: string;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

type WindowAggregate = {
  executionCount: number;
  successRate: number | null;
  averageDurationMs: number | null;
  totalCostCents: number;
  costPerExecutionCents: number | null;
  escalationRate: number | null;
  errorRate: number | null;
  layers: Record<LayerKey, number | null>;
  operationalScore: number | null;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function executivePeriodBounds(period?: string, now = new Date()): ExecutivePeriodBounds {
  const normalized = period ?? monthKey(now);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    throw new Error("Período inválido. Use YYYY-MM.");
  }
  const [yearText, monthText] = normalized.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const previousStart = new Date(Date.UTC(year, monthIndex - 1, 1));
  return {
    period: normalized,
    previousPeriod: monthKey(previousStart),
    start,
    end,
    previousStart,
    previousEnd: start,
  };
}

function inWindow(value: Date, start: Date, end: Date): boolean {
  const timestamp = value.getTime();
  return timestamp >= start.getTime() && timestamp < end.getTime();
}

function average(values: number[]): number | null {
  return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function aggregateWindow(
  events: ExecutiveEventInput[],
  points: ExecutiveMetricPointInput[],
  start: Date,
  end: Date,
): WindowAggregate {
  const windowEvents = events.filter((event) => inWindow(event.ts, start, end));
  const executions = windowEvents.filter((event) => event.kind === "execution");
  const successSamples = executions.filter((event) => event.success === 0 || event.success === 1);
  const durations = executions.flatMap((event) => event.durationMs === null ? [] : [event.durationMs]);
  const totalCostCents = executions.reduce((sum, event) => sum + Math.max(0, event.costCents ?? 0), 0);
  const windowPoints = points.filter((point) => inWindow(point.timestamp, start, end));
  const layers = Object.fromEntries(
    LAYERS.map((layer) => [layer, average(windowPoints.map((point) => point[layer]))]),
  ) as Record<LayerKey, number | null>;
  const layerValues = LAYERS.flatMap((layer) => layers[layer] === null ? [] : [layers[layer]!]);

  return {
    executionCount: executions.length,
    successRate: successSamples.length
      ? round1((successSamples.filter((event) => event.success === 1).length / successSamples.length) * 100)
      : null,
    averageDurationMs: average(durations),
    totalCostCents,
    costPerExecutionCents: executions.length ? round1(totalCostCents / executions.length) : null,
    escalationRate: executions.length
      ? round1((windowEvents.filter((event) => event.kind === "escalation").length / executions.length) * 100)
      : null,
    errorRate: executions.length
      ? round1((windowEvents.filter((event) => event.kind === "error").length / executions.length) * 100)
      : null,
    layers,
    operationalScore: average(layerValues),
  };
}

function comparison(
  current: number | null,
  previous: number | null,
  unit: string,
  direction: ExecutiveMetricComparison["direction"],
): ExecutiveMetricComparison {
  const delta = current === null || previous === null ? null : round1(current - previous);
  const deltaPercent = delta === null || previous === null || previous === 0
    ? null
    : round1((delta / Math.abs(previous)) * 100);
  return { current, previous, delta, deltaPercent, unit, direction };
}

function latestEvaluations(
  evaluations: ExecutiveEvaluationInput[],
  start: Date,
  end: Date,
): Map<string, ExecutiveEvaluationInput> {
  const latest = new Map<string, ExecutiveEvaluationInput>();
  for (const evaluation of evaluations
    .filter((item) => inWindow(item.evaluatedAt, start, end))
    .sort((left, right) => right.evaluatedAt.getTime() - left.evaluatedAt.getTime())) {
    if (!latest.has(evaluation.agentId)) latest.set(evaluation.agentId, evaluation);
  }
  return latest;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year!, month! - 1, 1)));
}

function signed(value: number | null, suffix = ""): string {
  if (value === null) return "sem comparação";
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export function buildExecutiveMonthlyReport(input: BuildExecutiveMonthlyReportInput): ExecutiveMonthlyReport {
  const now = input.now ?? new Date();
  const bounds = executivePeriodBounds(input.period, now);
  const current = aggregateWindow(input.events, input.points, bounds.start, bounds.end);
  const previous = aggregateWindow(input.events, input.points, bounds.previousStart, bounds.previousEnd);
  const activeAgents = input.agents.filter(
    (agent) => agent.admittedAt < bounds.end && agent.status !== "retired",
  );
  const newAgents = activeAgents.filter((agent) => inWindow(agent.admittedAt, bounds.start, bounds.end)).length;
  const agentsWithExecution = new Set(
    input.events
      .filter((event) => event.kind === "execution" && inWindow(event.ts, bounds.start, bounds.end))
      .map((event) => event.agentId),
  ).size;
  const currentEvaluations = latestEvaluations(input.evaluations, bounds.start, bounds.end);
  const verdicts: Record<VerdictType, number> = { promote: 0, mentor: 0, retire: 0, observation: 0 };
  for (const evaluation of currentEvaluations.values()) verdicts[evaluation.verdict] += 1;

  const activeAlerts = input.alerts.filter(
    (alert) => alert.detectedAt < bounds.end && (!alert.resolvedAt || alert.resolvedAt >= bounds.end),
  );
  const criticalAlerts = activeAlerts.filter(
    (alert) => alert.severity === "critical" || alert.severity === "high",
  ).length;
  const dataCoverage = activeAgents.length ? round1((agentsWithExecution / activeAgents.length) * 100) : 0;
  const evaluationConfidence = average(
    [...currentEvaluations.values()].map((evaluation) => evaluation.verdictConfidence),
  ) ?? 0;
  const qualityScore = round1(dataCoverage * 0.6 + evaluationConfidence * 0.4);
  const limitations: string[] = [];
  if (dataCoverage < 70) limitations.push("menos de 70% dos agentes ativos reportaram execuções no período");
  if (evaluationConfidence < 70) limitations.push("confiança média das avaliações abaixo de 70%");
  if (current.executionCount < 30) limitations.push("amostra inferior a 30 execuções");
  const quality: ExecutiveReportQuality = {
    score: qualityScore,
    dataCoverage,
    evaluationConfidence,
    decisionReady: limitations.length === 0,
    limitations,
  };

  const metrics: Record<string, ExecutiveMetricComparison> = {
    operationalScore: comparison(current.operationalScore, previous.operationalScore, "pontos", "higher-is-better"),
    executionCount: comparison(current.executionCount, previous.executionCount, "execuções", "informational"),
    successRate: comparison(current.successRate, previous.successRate, "%", "higher-is-better"),
    averageDurationMs: comparison(current.averageDurationMs, previous.averageDurationMs, "ms", "lower-is-better"),
    costPerExecutionCents: comparison(current.costPerExecutionCents, previous.costPerExecutionCents, "centavos", "lower-is-better"),
    escalationRate: comparison(current.escalationRate, previous.escalationRate, "%", "lower-is-better"),
    errorRate: comparison(current.errorRate, previous.errorRate, "%", "lower-is-better"),
  };
  const layerComparison = Object.fromEntries(
    LAYERS.map((layer) => [layer, comparison(current.layers[layer], previous.layers[layer], "pontos", "higher-is-better")]),
  ) as Record<LayerKey, ExecutiveMetricComparison>;

  const lowestLayer = [...LAYERS].sort(
    (left, right) => (current.layers[left] ?? 101) - (current.layers[right] ?? 101),
  )[0]!;
  const strongestLayer = [...LAYERS].sort(
    (left, right) => (current.layers[right] ?? -1) - (current.layers[left] ?? -1),
  )[0]!;
  const insights: ExecutiveInsightDraft[] = [];
  const operationalDelta = metrics.operationalScore.delta;
  if (operationalDelta !== null && Math.abs(operationalDelta) >= 2) {
    insights.push({
      id: `${bounds.period}:operational-score`,
      category: "performance",
      title: operationalDelta > 0 ? "Evolução operacional consistente" : "Deterioração operacional no mês",
      narrative: `O score operacional variou ${signed(operationalDelta, " pontos")} contra ${bounds.previousPeriod}.`,
      recommendation: operationalDelta > 0
        ? "Validar quais práticas explicam a melhora antes de ampliar autonomia ou volume."
        : `Priorizar ${LAYER_LABELS[lowestLayer]} e revisar os agentes com maior contribuição para a queda.`,
      severity: operationalDelta > 0 ? "positive" : operationalDelta <= -5 ? "high" : "medium",
      confidence: qualityScore,
      evidenceRefs: [`metric_points:${bounds.period}`, `metric_points:${bounds.previousPeriod}`],
    });
  }
  if (current.successRate !== null && previous.successRate !== null && current.successRate < previous.successRate - 3) {
    insights.push({
      id: `${bounds.period}:success-rate`,
      category: "reliability",
      title: "Queda relevante na taxa de sucesso",
      narrative: `A taxa de sucesso caiu ${Math.abs(metrics.successRate.delta ?? 0)} pontos percentuais no mês.`,
      recommendation: "Comparar versões, workloads, fallback e causas de erro antes de alterar metas.",
      severity: "high",
      confidence: dataCoverage,
      evidenceRefs: [`agent_events:${bounds.period}:execution`, `agent_events:${bounds.period}:error`],
    });
  }
  if ((current.layers.governance ?? 100) < 65 || criticalAlerts > 0) {
    insights.push({
      id: `${bounds.period}:governance`,
      category: "governance",
      title: "Governança requer decisão executiva",
      narrative: `${criticalAlerts} alertas críticos ou altos permanecem abertos; governança está em ${current.layers.governance ?? 0} pontos.`,
      recommendation: "Conter autonomia nos casos críticos, atribuir owners e acompanhar prazo de correção.",
      severity: criticalAlerts > 0 ? "critical" : "high",
      confidence: Math.max(evaluationConfidence, 50),
      evidenceRefs: [`alerts:active:${bounds.period}`, `metric_points:${bounds.period}:governance`],
    });
  }
  if (!quality.decisionReady) {
    insights.push({
      id: `${bounds.period}:data-quality`,
      category: "data-quality",
      title: "Relatório ainda não está pronto para decisão material",
      narrative: limitations.join("; ") || "A cobertura ainda é insuficiente.",
      recommendation: "Corrigir cobertura, confiança e amostra antes de promover decisões irreversíveis.",
      severity: "medium",
      confidence: 100,
      evidenceRefs: [`report-quality:${bounds.period}`],
    });
  }

  const executionText = current.executionCount.toLocaleString("pt-BR");
  const scoreText = current.operationalScore === null ? "sem score consolidado" : `${current.operationalScore} pontos`;
  const executiveSummary = current.executionCount === 0
    ? `Em ${formatPeriod(bounds.period)}, ainda não há execução suficiente para uma leitura executiva confiável.`
    : `Em ${formatPeriod(bounds.period)}, a força de trabalho registrou ${executionText} execuções e score operacional de ${scoreText}, com variação de ${signed(operationalDelta, " pontos")} frente ao mês anterior. ${quality.decisionReady ? "A qualidade dos dados permite decisões no período." : "As conclusões devem respeitar as limitações de cobertura indicadas."}`;
  const sections: ExecutiveReportSection[] = [
    {
      key: "outcomes",
      title: "Desempenho e propósito",
      summary: `${LAYER_LABELS[strongestLayer]} é a dimensão mais forte; ${LAYER_LABELS[lowestLayer]} concentra a maior oportunidade de evolução.`,
      highlights: LAYERS.map((layer) => `${LAYER_LABELS[layer]}: ${current.layers[layer] ?? "sem dado"} (${signed(layerComparison[layer].delta, " pp")})`),
      evidenceRefs: [`metric_points:${bounds.period}`, `metric_points:${bounds.previousPeriod}`],
    },
    {
      key: "workforce",
      title: "Escala e confiabilidade",
      summary: `${executionText} execuções, sucesso de ${current.successRate ?? "—"}% e ${agentsWithExecution} agentes reportando atividade.`,
      highlights: [
        `Tempo médio: ${current.averageDurationMs ?? "—"} ms`,
        `Custo por execução: ${current.costPerExecutionCents ?? "—"} centavos`,
        `Escalonamentos: ${current.escalationRate ?? "—"}%`,
      ],
      evidenceRefs: [`agent_events:${bounds.period}`],
    },
    {
      key: "risk-governance",
      title: "Risco e governança",
      summary: `${activeAlerts.length} alertas permanecem ativos, sendo ${criticalAlerts} críticos ou altos.`,
      highlights: [
        `Governança: ${current.layers.governance ?? "—"} pontos`,
        `Confiança de avaliação: ${evaluationConfidence}%`,
        `Cobertura de dados: ${dataCoverage}%`,
      ],
      evidenceRefs: [`alerts:active:${bounds.period}`, `evaluations:${bounds.period}`],
    },
    {
      key: "decisions",
      title: "Decisões solicitadas",
      summary: insights.length ? `${insights.length} temas requerem validação ou acompanhamento.` : "Nenhuma decisão extraordinária foi sugerida pelas regras.",
      highlights: insights.map((insight) => insight.recommendation),
      evidenceRefs: insights.flatMap((insight) => insight.evidenceRefs),
    },
    {
      key: "outlook",
      title: "Próximo ciclo",
      summary: `O próximo mês deve preservar a rastreabilidade e elevar ${LAYER_LABELS[lowestLayer]} sem comprometer guardrails.`,
      highlights: [
        "Confirmar owners para todos os planos de ação.",
        "Revisar métricas com baixa cobertura antes da reunião executiva.",
        "Usar IA para síntese e hipóteses, nunca para substituir os fatos calculados.",
      ],
      evidenceRefs: [`report-quality:${bounds.period}`],
    },
  ];

  const timestamps = [
    ...input.events.map((event) => event.ts),
    ...input.points.map((point) => point.timestamp),
    ...input.evaluations.map((evaluation) => evaluation.evaluatedAt),
    ...input.alerts.map((alert) => alert.detectedAt),
  ].filter((timestamp) => timestamp < bounds.end);
  const sourceWatermark = timestamps.length
    ? new Date(Math.max(...timestamps.map((timestamp) => timestamp.getTime()))).toISOString()
    : null;

  return {
    period: bounds.period,
    previousPeriod: bounds.previousPeriod,
    title: `Relatório executivo · ${formatPeriod(bounds.period)}`,
    executiveSummary,
    generatedAt: now.toISOString(),
    sourceWatermark,
    narrativeSource: "deterministic",
    metrics,
    layerComparison,
    portfolio: {
      totalAgents: input.agents.filter((agent) => agent.admittedAt < bounds.end).length,
      activeAgents: activeAgents.length,
      newAgents,
      agentsWithExecution,
      activeAlerts: activeAlerts.length,
      criticalAlerts,
      verdicts,
    },
    quality,
    sections,
    insights,
  };
}
