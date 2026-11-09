import type {
  ExecutiveLayerComparison,
  ExecutiveMetricComparison,
  ExecutiveReport,
} from "@workspace/api-client-react";

export type AbaRelatorio = "resumo" | "detalhes";

export const ABAS_RELATORIO: ReadonlyArray<{ id: AbaRelatorio; label: string }> = [
  { id: "resumo", label: "Resumo do mês" },
  { id: "detalhes", label: "Detalhes (indicadores)" },
];

/**
 * Aceita só um relatório completo. Resposta vazia, HTML da rota e objetos pela
 * metade viram null — era isso que derrubava a tela em "reading 'filter'".
 */
export function relatorioValido(data: unknown): ExecutiveReport | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const relatorio = data as Partial<ExecutiveReport>;
  if (!Array.isArray(relatorio.sections) || !Array.isArray(relatorio.insights)) return null;
  if (typeof relatorio.title !== "string" || typeof relatorio.period !== "string") return null;
  if (!relatorio.metrics || typeof relatorio.metrics !== "object") return null;
  if (!relatorio.layerComparison || typeof relatorio.layerComparison !== "object") return null;
  if (!relatorio.portfolio || typeof relatorio.portfolio !== "object") return null;
  if (!relatorio.quality || typeof relatorio.quality !== "object") return null;
  if (typeof relatorio.quality.decisionReady !== "boolean") return null;
  if (typeof relatorio.executiveSummary !== "string") return null;
  return relatorio as ExecutiveReport;
}

export function copyRelatorioVazio(dias = 7): string {
  return `Nenhum relatório ainda. O primeiro é gerado após ${dias} dias de dados.`;
}

/** Seções do modelo escolhido, sem quebrar quando o relatório não tem sections. */
export function secoesDoModelo(
  relatorio: ExecutiveReport | null,
  chavesModelo: string[],
): ExecutiveReport["sections"] {
  if (!relatorio || !Array.isArray(relatorio.sections)) return [];
  return relatorio.sections.filter((secao) => chavesModelo.includes(secao.key));
}

function comparacao(
  current: number,
  previous: number,
  unit: string,
  direction: ExecutiveMetricComparison["direction"],
): ExecutiveMetricComparison {
  return {
    current,
    previous,
    delta: current - previous,
    deltaPercent: previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
    unit,
    direction,
  };
}

const METRICAS_DEMO: ExecutiveReport["metrics"] = {
  operationalScore: comparacao(88, 84, "%", "higher-is-better"),
  executionCount: comparacao(312, 268, "execuções", "higher-is-better"),
  successRate: comparacao(92, 89, "%", "higher-is-better"),
  averageDurationMs: comparacao(4200, 4900, "ms", "lower-is-better"),
  costPerExecutionCents: comparacao(24, 29, "centavos", "lower-is-better"),
  escalationRate: comparacao(7, 9, "%", "lower-is-better"),
  errorRate: comparacao(3, 5, "%", "lower-is-better"),
};

const CAMADAS_DEMO: ExecutiveLayerComparison = {
  efficacy: comparacao(92, 88, "%", "higher-is-better"),
  efficiency: comparacao(76, 71, "%", "higher-is-better"),
  adoption: comparacao(64, 58, "%", "higher-is-better"),
  governance: comparacao(91, 90, "%", "higher-is-better"),
  value: comparacao(81, 77, "%", "higher-is-better"),
};

export const RELATORIO_DEMO: ExecutiveReport = {
  id: "relatorio-demo-out-2026",
  period: "2026-10",
  previousPeriod: "2026-09",
  version: 3,
  status: "published",
  title: "Fechamento de outubro de 2026",
  executiveSummary:
    "312 entregas em outubro, 287 aceitas (92%). O gasto ficou em R$ 68,90 dos R$ 96,00 orçados, com R$ 0,24 por entrega aceita contra a meta de R$ 0,30. Dora é o único agente fora do combinado; as pendências abertas são de revisão humana, não de capacidade da operação.",
  generatedAt: "2026-11-01T09:10:00.000Z",
  narrativeSource: "deterministic",
  aiInsight: "unavailable",
  metrics: METRICAS_DEMO,
  layerComparison: CAMADAS_DEMO,
  portfolio: {
    totalAgents: 6,
    activeAgents: 6,
    newAgents: 1,
    agentsWithExecution: 6,
    activeAlerts: 3,
    criticalAlerts: 1,
    verdicts: { promote: 2, mentor: 3, retire: 1, observation: 4 },
  },
  quality: {
    score: 88,
    dataCoverage: 86,
    evaluationConfidence: 84,
    decisionReady: true,
    limitations: [
      "Dora tem cobertura aberta: 0 das 2 metas com prova registrada no período.",
      "3 entregas aguardam prova na origem antes de entrar no cálculo de aceitas.",
    ],
  },
  sections: [
    {
      key: "outcomes",
      title: "Entregas e resultado",
      summary:
        "287 de 312 entregas aceitas, com custo por entrega aceita de R$ 0,24 — dentro da meta de R$ 0,30.",
      highlights: [
        "Sofia concentra 236 entregas com R$ 0,21 cada e 4,2 de nota em 14 respostas.",
        "Téo fechou a revisão de pull requests com 1 de 2 metas cumpridas e 5 entregas no período.",
        "A percepção de quem recebeu caiu para 4,1 de 5 com 6 respostas negativas.",
      ],
      evidenceRefs: ["zendesk · out/26", "erp · lote 2026-10-23", "github · pull request 1183"],
    },
    {
      key: "workforce",
      title: "Portfólio de agentes",
      summary:
        "6 agentes ativos: 2 dentro do combinado, 2 precisam de atenção e 2 estão fora do combinado.",
      highlights: [
        "Cobertura: 2 fechada, 3 parcial e 1 aberta no período.",
        "Maia e Vega cumprem 2 de 2 metas sem pendência aberta.",
        "Dora perdeu a cobertura de prova e é a candidata a revisão de escopo.",
      ],
      evidenceRefs: ["out/26 · 6 agentes"],
    },
    {
      key: "risk-governance",
      title: "Risco e governança",
      summary:
        "1 pendência crítica de decisão humana e 3 pendências no total, todas com prazo marcado.",
      highlights: [
        "Exceção de conciliação acima do limite aguarda decisão do responsável.",
        "Toda entrega aceita traz prova com origem, horário e fonte.",
        "2 métricas seguem sem meta definida e aparecem como estimado.",
      ],
      evidenceRefs: ["pendencias · out/26"],
    },
    {
      key: "decisions",
      title: "Decisões do período",
      summary:
        "Duas decisões registradas e uma revisão humana marcada para a próxima semana.",
      highlights: [
        "Manter Sofia no atual escopo até a próxima revisão (Hoje, 14:30).",
        "Reduzir o escopo de Dora e repetir o período de experiência.",
        "Definir meta para as duas métricas estimadas antes do fechamento de novembro.",
      ],
      evidenceRefs: ["plano · out/26"],
    },
    {
      key: "outlook",
      title: "Próximo período",
      summary:
        "Novembro entra com a mesma base de medição e uma meta nova de custo por entrega.",
      highlights: [
        "Orçamento de novembro: R$ 96,00, mantendo a meta de R$ 0,30 por entrega aceita.",
        "Cobertura fechada para Dora antes de ampliar volume.",
      ],
      evidenceRefs: ["orçamento · nov/26"],
    },
  ],
  insights: [
    {
      id: "insight-cobertura-dora",
      category: "qualidade",
      title: "Cobertura aberta em Dora segura a prova das metas",
      narrative:
        "Dora tem 4 entregas no período e nenhuma com prova registrada na origem, o que derruba a cobertura de 2 metas para aberta.",
      recommendation:
        "Instrumentar a origem da prova antes de aumentar o volume de conciliação.",
      severity: "high",
      confidence: 86,
      evidenceRefs: ["erp · lote 2026-10-23"],
    },
    {
      id: "insight-custo",
      category: "custo",
      title: "Custo por entrega aceita segue abaixo da meta",
      narrative:
        "R$ 0,24 por entrega aceita contra a meta de R$ 0,30, com 72% do orçamento do período usado.",
      recommendation: "Manter o teto mensal e revisar só se a meta de custo mudar.",
      severity: "positive",
      confidence: 92,
      evidenceRefs: ["financeiro · out/26"],
    },
  ],
};
