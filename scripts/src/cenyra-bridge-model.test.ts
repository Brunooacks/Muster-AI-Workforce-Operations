import { describe, expect, it } from "vitest";
import {
  cenyraEvidenceProfile,
  isCenyraCollectionObserved,
  isCenyraRunHealthy,
  latestCenyraRuns,
  synthesisRun,
  type CenyraRun,
} from "./cenyra-bridge-model";

function run(overrides: Partial<CenyraRun> = {}): CenyraRun {
  return {
    id: "run-1",
    agent_name: "Radar",
    framework: "LangChain",
    source: "melhorlance",
    status: "completed",
    started_at: "2026-09-02T10:00:00.000Z",
    completed_at: "2026-09-02T10:00:01.000Z",
    metrics: {
      records_discovered: 10,
      links_discovered: 20,
      price_coverage: 1,
      ranking_coverage: 1,
      author_coverage: 0,
      enrichment_coverage: 1,
      translation_coverage: 1,
      business_detail_coverage: 1,
      market_research_coverage: 0,
      analysis_quality: 0.8,
      duration_ms: 1000,
      input_tokens: 10,
      output_tokens: 20,
      estimated_cost_usd: 0.01,
      llm_used: true,
      source_hash: "8eb2e78f78b98db6e14be92f791121ab46520c1d6b87e01c10feda29f136de58",
      degraded_reason: null,
    },
    error: null,
    ...overrides,
  };
}

describe("Cenyra bridge model", () => {
  it("não esconde uma execução concluída em modo degradado", () => {
    const degraded = run({
      metrics: { ...run().metrics, degraded_reason: "LLM indisponível" },
    });
    expect(isCenyraRunHealthy(degraded)).toBe(false);
  });

  it("seleciona a execução mais recente por fonte", () => {
    const latest = latestCenyraRuns([
      run({ id: "old", started_at: "2026-09-01T10:00:00.000Z" }),
      run({ id: "new", started_at: "2026-09-02T10:00:00.000Z" }),
    ]);
    expect(latest.get("melhorlance")?.id).toBe("new");
  });

  it("transforma o relatório consolidado em execução mensurável", () => {
    const result = synthesisRun({
      report_date: "2026-09-02",
      generated_at: "2026-09-02T11:00:00.000Z",
      opportunity_count: 177,
      total_links: 368,
      agent_health: [],
    });
    expect(result.status).toBe("completed");
    expect(result.metrics.records_discovered).toBe(177);
    expect(result.metrics.links_discovered).toBe(368);
  });

  it("separa coleta real de análise heurística", () => {
    const execution = run({
      metrics: {
        ...run().metrics,
        llm_used: false,
        degraded_reason: "LLM indisponível",
      },
    });
    expect(isCenyraCollectionObserved(execution)).toBe(true);
    expect(cenyraEvidenceProfile(execution)).toMatchObject({
      collectionKind: "observed",
      analysisKind: "heuristic",
      decisionGrade: false,
    });
  });

  it("só libera grau de decisão com fonte, LLM e qualidade comprovados", () => {
    expect(cenyraEvidenceProfile(run()).decisionGrade).toBe(true);
    expect(cenyraEvidenceProfile(run({
      metrics: { ...run().metrics, source_hash: "" },
    })).decisionGrade).toBe(false);
  });
});
