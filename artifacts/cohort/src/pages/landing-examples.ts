import type { Lang } from "@/lib/i18n";

/**
 * Números ilustrativos da landing (cunha · C14.1, MUS-179). Não são dados de
 * cliente nem estatística de mercado: são exemplos de como o Muster mostra um
 * fechamento, e a landing os exibe sempre com o selo "Exemplo". Nenhum número
 * novo entra aqui sem fonte pública verificada em docs/fontes.md (regra R6);
 * o teste landing-scan.test.ts recusa número literal de card de métrica fora
 * deste arquivo.
 */

export const EXAMPLE_LABEL: Record<Lang, string> = {
  pt: "Exemplo",
  en: "Example",
  es: "Ejemplo",
};

export const EXAMPLE_HINT: Record<Lang, string> = {
  pt: "Valores ilustrativos, não são dados de clientes.",
  en: "Illustrative values, not customer data.",
  es: "Valores ilustrativos, no son datos de clientes.",
};

export interface ExampleMetric {
  value: number;
  delta: string;
}

/** Board Brief (topo): três cards na ordem de `reportMetrics`. */
export const BRIEF_EXAMPLE: { metrics: [ExampleMetric, ExampleMetric, ExampleMetric]; status: string } = {
  metrics: [
    { value: 92, delta: "+4 pp" },
    { value: 86, delta: "+2 pp" },
    { value: 94, delta: "+7 pp" },
  ],
  status: "decision ready",
};

/** Fechamento mensal (seção de relatório): quatro cards. */
export const MONTHLY_CLOSE_EXAMPLE = {
  month: { pt: "Agosto 2026", en: "August 2026", es: "Agosto 2026" } as Record<Lang, string>,
  status: "decision ready",
  metrics: [
    { value: 92, delta: "+4 pp" },
    { value: 86, delta: "+2 pp" },
    { value: 94, delta: "+7 pp" },
    { value: 78, delta: "-3 pp" },
  ] as ExampleMetric[],
  governanceLabel: { pt: "Governança", en: "Governance", es: "Gobernanza" } as Record<Lang, string>,
  insight: {
    pt: "insight priorizado · 91% confiança",
    en: "prioritized insight · 91% confidence",
    es: "insight priorizado · 91% confianza",
  } as Record<Lang, string>,
};

/** Ticker de vereditos: [tom, etiqueta, quem, valor] por idioma. */
export const TICKER_EXAMPLE: Record<Lang, Array<[string, string, string, string]>> = {
  pt: [
    ["text-chart-1", "● CONTRATO CUMPRIDO", "Vega · entrega contínua", "91%"],
    ["text-chart-2-text", "◆ REVIEW NECESSÁRIO", "Sofia · suporte N1", "42 min"],
    ["text-chart-1", "↗ JORNADA A2A", "Entrega contínua segura", "94% e2e"],
    ["text-chart-1", "● EVIDÊNCIA", "traces correlacionados", "97%"],
    ["text-chart-2-text", "◆ BENCHMARK", "Revisor PR · pares equivalentes", "mediana"],
    ["text-chart-1", "● EQUIPE MISTA", "7 pessoas · 4 agentes", "saudável"],
    ["text-chart-3-text", "▼ GUARDRAIL", "mudança fora do escopo", "bloqueada"],
    ["text-chart-1", "● CLOUD + LOCAL", "fallback por política", "pronto"],
  ],
  en: [
    ["text-chart-1", "● CONTRACT FULFILLED", "Vega · continuous delivery", "91%"],
    ["text-chart-2-text", "◆ REVIEW REQUIRED", "Sofia · tier-1 support", "42 min"],
    ["text-chart-1", "↗ A2A JOURNEY", "Safe continuous delivery", "94% e2e"],
    ["text-chart-1", "● EVIDENCE", "correlated traces", "97%"],
    ["text-chart-2-text", "◆ BENCHMARK", "PR Reviewer · equivalent peers", "median"],
    ["text-chart-1", "● MIXED TEAM", "7 people · 4 agents", "healthy"],
    ["text-chart-3-text", "▼ GUARDRAIL", "out-of-scope change", "blocked"],
    ["text-chart-1", "● CLOUD + LOCAL", "policy-based fallback", "ready"],
  ],
  es: [
    ["text-chart-1", "● CONTRATO CUMPLIDO", "Vega · entrega continua", "91%"],
    ["text-chart-2-text", "◆ REVISIÓN NECESARIA", "Sofia · soporte N1", "42 min"],
    ["text-chart-1", "↗ JORNADA A2A", "Entrega continua segura", "94% e2e"],
    ["text-chart-1", "● EVIDENCIA", "traces correlacionados", "97%"],
    ["text-chart-2-text", "◆ BENCHMARK", "Revisor PR · pares equivalentes", "mediana"],
    ["text-chart-1", "● EQUIPO MIXTO", "7 personas · 4 agentes", "saludable"],
    ["text-chart-3-text", "▼ GUARDRAIL", "cambio fuera de alcance", "bloqueado"],
    ["text-chart-1", "● CLOUD + LOCAL", "fallback por política", "listo"],
  ],
};

/** Visão geral (WorkforceOverview): os dois números do diagrama. */
export const OVERVIEW_EXAMPLE = {
  evidenceCoverage: "100%",
  journey: "94% end-to-end · p95 42 min",
};
