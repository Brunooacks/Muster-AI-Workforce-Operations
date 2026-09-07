export interface CenyraRunMetrics {
  records_discovered: number;
  links_discovered: number;
  price_coverage: number;
  ranking_coverage: number;
  author_coverage: number;
  enrichment_coverage: number;
  translation_coverage: number;
  business_detail_coverage: number;
  market_research_coverage: number;
  analysis_quality: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  llm_used: boolean;
  source_hash: string;
  degraded_reason: string | null;
}

export interface CenyraRun {
  id: string;
  agent_name: string;
  framework: string;
  source: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  metrics: CenyraRunMetrics;
  error: string | null;
}

export interface CenyraReport {
  report_date: string;
  generated_at: string;
  opportunity_count: number;
  total_links: number;
  agent_health: Array<Record<string, unknown>>;
}

export interface CenyraProfession {
  source: string;
  sourceUrl: string;
  name: string;
  role: string;
  platform: string;
  purpose: string;
  shouldDo: string[];
}

export const CENYRA_PROFESSIONS: Record<string, CenyraProfession> = {
  melhorlance: {
    source: "melhorlance",
    sourceUrl: "https://www.melhorlance.dev/",
    name: "Cenyra · Radar Melhor Lance",
    role: "Analista de sinais de produtos brasileiros",
    platform: "langchain-local",
    purpose: "Documentar produtos, links, ranking, atenção paga e padrões de demanda no mercado brasileiro.",
    shouldDo: ["Coletar a fonte pública diariamente", "Preservar links e ranking", "Explicitar degradações da análise"],
  },
  outbid: {
    source: "outbid",
    sourceUrl: "https://outbid.lol/",
    name: "Cenyra · Outbid Global Scout",
    role: "Pesquisador de sinais globais de mercado",
    platform: "crewai-local",
    purpose: "Detectar categorias, produtos e narrativas globais com contexto traduzido e evidência rastreável.",
    shouldDo: ["Coletar ranking e valor publicado", "Traduzir contexto internacional", "Preservar referências de origem"],
  },
  "yc-rfs": {
    source: "yc-rfs",
    sourceUrl: "https://www.ycombinator.com/rfs",
    name: "Cenyra · YC RFS Opportunity Miner",
    role: "Pesquisador de problemas e teses de inovação",
    platform: "agno-local",
    purpose: "Transformar Requests for Startups em problemas comparáveis por estação, autoria, retorno e complexidade.",
    shouldDo: ["Coletar estações e autoria", "Comparar teses e alternativas", "Ranquear potencial e complexidade"],
  },
  synthesis: {
    source: "synthesis",
    sourceUrl: "http://localhost:8095/api/report",
    name: "Cenyra · Portfolio Synthesizer",
    role: "Editor executivo de inteligência de mercado",
    platform: "deterministic-orchestrator-local",
    purpose: "Consolidar os coletores em um portfólio diário auditável e orientado a experimentos.",
    shouldDo: ["Normalizar sinais heterogêneos", "Publicar relatório diário", "Preservar cobertura e freshness"],
  },
};

export interface CenyraEvidenceProfile {
  collectionKind: "observed" | "derived" | "failed";
  analysisKind: "llm" | "heuristic" | "deterministic";
  actualRuntime: string;
  decisionGrade: boolean;
  reasons: string[];
}

export function isCenyraCollectionObserved(run: CenyraRun): boolean {
  return run.source !== "synthesis"
    && run.status === "completed"
    && run.metrics.records_discovered > 0
    && run.metrics.source_hash.trim().length >= 16;
}

export function cenyraEvidenceProfile(run: CenyraRun): CenyraEvidenceProfile {
  if (run.source === "synthesis") {
    const completed = run.status === "completed" && run.metrics.records_discovered > 0;
    return {
      collectionKind: completed ? "derived" : "failed",
      analysisKind: "deterministic",
      actualRuntime: "Python deterministic orchestrator",
      decisionGrade: false,
      reasons: completed
        ? ["Relatório derivado de coletores; não é uma observação primária."]
        : [run.error ?? "Relatório consolidado vazio."],
    };
  }

  const observed = isCenyraCollectionObserved(run);
  const llmUsed = run.metrics.llm_used;
  const reasons: string[] = [];
  if (!observed) reasons.push("Coleta sem status concluído, registros ou hash de origem.");
  if (!llmUsed) reasons.push("Framework de IA declarado, mas nenhuma execução de LLM foi comprovada.");
  if (run.metrics.degraded_reason) reasons.push(run.metrics.degraded_reason);
  if (run.metrics.analysis_quality < 0.75) reasons.push("Qualidade de análise abaixo de 75%.");

  return {
    collectionKind: observed ? "observed" : "failed",
    analysisKind: llmUsed ? "llm" : "heuristic",
    actualRuntime: llmUsed
      ? `${run.framework} + LLM`
      : "Python HTTPX + BeautifulSoup + análise heurística",
    decisionGrade:
      observed
      && llmUsed
      && !run.metrics.degraded_reason
      && run.metrics.analysis_quality >= 0.75,
    reasons,
  };
}

export function isCenyraRunHealthy(run: CenyraRun): boolean {
  return run.status === "completed" && !run.metrics.degraded_reason;
}

export function latestCenyraRuns(runs: CenyraRun[]): Map<string, CenyraRun> {
  const latest = new Map<string, CenyraRun>();
  for (const run of [...runs].sort((left, right) => right.started_at.localeCompare(left.started_at))) {
    if (!latest.has(run.source)) latest.set(run.source, run);
  }
  return latest;
}

export function synthesisRun(report: CenyraReport): CenyraRun {
  return {
    id: `report:${report.report_date}`,
    agent_name: CENYRA_PROFESSIONS.synthesis!.name,
    framework: "deterministic-orchestrator",
    source: "synthesis",
    status: report.opportunity_count > 0 ? "completed" : "failed",
    started_at: report.generated_at,
    completed_at: report.generated_at,
    metrics: {
      records_discovered: report.opportunity_count,
      links_discovered: report.total_links,
      price_coverage: 0,
      ranking_coverage: 0,
      author_coverage: 0,
      enrichment_coverage: 1,
      translation_coverage: 1,
      business_detail_coverage: 1,
      market_research_coverage: 0,
      analysis_quality: report.opportunity_count > 0 ? 1 : 0,
      duration_ms: 0,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      llm_used: false,
      source_hash: report.report_date,
      degraded_reason: report.opportunity_count > 0 ? null : "Relatório sem oportunidades.",
    },
    error: report.opportunity_count > 0 ? null : "Relatório vazio.",
  };
}
