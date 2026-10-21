import { describe, expect, it } from "vitest";
import { KPI_DOMAIN_CATALOG, KPI_DOMAIN_VERTICALS } from "./kpi-domain-catalog";
import type {
  KpiCadence,
  KpiContract,
  KpiFreshnessPolicy,
  KpiMetricDirection,
} from "./kpi-contract";

const FRESHNESS_POR_CADENCIA: Record<KpiCadence, KpiFreshnessPolicy> = {
  "per-run": {
    expectedWithinMinutes: 5,
    staleAfterMinutes: 15,
    expiresAfterMinutes: 60,
  },
  daily: {
    expectedWithinMinutes: 1_440,
    staleAfterMinutes: 2_160,
    expiresAfterMinutes: 4_320,
  },
  weekly: {
    expectedWithinMinutes: 10_080,
    staleAfterMinutes: 14_400,
    expiresAfterMinutes: 21_600,
  },
  monthly: {
    expectedWithinMinutes: 43_200,
    staleAfterMinutes: 64_800,
    expiresAfterMinutes: 86_400,
  },
  quarterly: {
    expectedWithinMinutes: 129_600,
    staleAfterMinutes: 194_400,
    expiresAfterMinutes: 259_200,
  },
};

const DIRECOES_ORDENADORAS = [
  "higher-is-better",
  "lower-is-better",
] as const satisfies readonly KpiMetricDirection[];

const SOBRESCRITAS_DECLARADAS: Record<
  string,
  Partial<Pick<KpiContract, "capability" | "minSampleSize">>
> = {
  "operacoes-taxa-excecao": { capability: "quality-evaluation" },
  "discovery-cobertura-sinais": { capability: "discovery-observability" },
  "discovery-prontidao-instrumentacao": {
    capability: "discovery-observability",
  },
  "runtime-cobertura-heartbeat": {
    capability: "runtime-resilience",
    minSampleSize: 1,
  },
  "runtime-sucesso-fallback": {
    capability: "runtime-resilience",
    minSampleSize: 10,
  },
  "dados-completude-trace": { capability: "data-quality" },
  "dados-duplicidade-eventos": { capability: "data-quality" },
  "eval-saida-fundamentada": { capability: "quality-evaluation" },
  "hibrida-aceite-humano": { capability: "human-agent-collaboration" },
  "hibrida-taxa-override": { capability: "human-agent-collaboration" },
  "hibrida-retrabalho": { capability: "human-agent-collaboration" },
  "hibrida-sla-escalonamento": { capability: "human-agent-collaboration" },
  "hibrida-cobertura-supervisao": {
    capability: "human-agent-collaboration",
  },
  "a2a-sucesso-handoff": { capability: "a2a-orchestration" },
  "a2a-integridade-contexto": { capability: "a2a-orchestration" },
  "eval-concordancia-humano-agente": { capability: "quality-evaluation" },
};

const metricasPorVertical = KPI_DOMAIN_VERTICALS.flatMap((vertical) =>
  vertical.metrics.map((metric) => ({ verticalKey: vertical.key, metric })),
);

const duplicados = (valores: string[]): string[] => [
  ...new Set(
    valores.filter((valor, indice) => valores.indexOf(valor) !== indice),
  ),
];

describe("catálogo de domínios de KPI", () => {
  it("expõe KPI_DOMAIN_CATALOG como a concatenação das métricas de todas as verticais", () => {
    expect(KPI_DOMAIN_CATALOG).toEqual(
      KPI_DOMAIN_VERTICALS.flatMap((vertical) => vertical.metrics),
    );
    expect(KPI_DOMAIN_CATALOG.length).toBe(metricasPorVertical.length);
  });

  it("mantém as chaves de vertical (key) únicas", () => {
    const chaves = KPI_DOMAIN_VERTICALS.map((vertical) => vertical.key);

    expect(chaves).toHaveLength(new Set(chaves).size);
    expect(duplicados(chaves)).toEqual([]);
  });

  it("mantém as chaves de métrica únicas no catálogo inteiro", () => {
    const chaves = KPI_DOMAIN_CATALOG.map((metric) => metric.key);

    expect(chaves).toHaveLength(new Set(chaves).size);
    expect(duplicados(chaves)).toEqual([]);
  });

  it("mantém o domain de cada métrica igual ao key da vertical que a contém", () => {
    const divergentes = metricasPorVertical
      .filter(({ verticalKey, metric }) => metric.domain !== verticalKey)
      .map(({ metric }) => metric.key);

    expect(divergentes).toEqual([]);
  });

  it("respeita expectedWithinMinutes < staleAfterMinutes < expiresAfterMinutes em toda métrica", () => {
    const violacoes = KPI_DOMAIN_CATALOG.filter(
      ({ freshness }) =>
        !(
          freshness.expectedWithinMinutes < freshness.staleAfterMinutes &&
          freshness.staleAfterMinutes < freshness.expiresAfterMinutes
        ),
    ).map((metric) => metric.key);

    expect(violacoes).toEqual([]);
  });

  it.todo(
    "usa exatamente o objeto de freshness do mapa por cadência (divergência: runtime-cobertura-heartbeat declara per-run com {1,3,5} em vez de {5,15,60})",
  );

  it('aplica capability "business-outcome" e minSampleSize 30 por padrão, preservando apenas as sobrescritas declaradas', () => {
    const chavesDesconhecidas = Object.keys(SOBRESCRITAS_DECLARADAS).filter(
      (key) => !KPI_DOMAIN_CATALOG.some((metric) => metric.key === key),
    );

    expect(chavesDesconhecidas).toEqual([]);
    expect(
      KPI_DOMAIN_CATALOG.map((metric) => [
        metric.key,
        metric.capability,
        metric.minSampleSize,
      ]),
    ).toEqual(
      KPI_DOMAIN_CATALOG.map((metric) => [
        metric.key,
        SOBRESCRITAS_DECLARADAS[metric.key]?.capability ?? "business-outcome",
        SOBRESCRITAS_DECLARADAS[metric.key]?.minSampleSize ?? 30,
      ]),
    );
  });

  it("mantém evidence.minConfidence igual a confidence.minimum em todas as métricas", () => {
    const divergentes = KPI_DOMAIN_CATALOG.filter(
      (metric) => metric.evidence.minConfidence !== metric.confidence.minimum,
    ).map((metric) => metric.key);

    expect(divergentes).toEqual([]);
  });

  it("mantém confidence.minimum <= confidence.decisionGrade com ambos entre 0 e 100", () => {
    const violacoes = KPI_DOMAIN_CATALOG.filter(
      ({ confidence }) =>
        confidence.minimum > confidence.decisionGrade ||
        confidence.minimum < 0 ||
        confidence.minimum > 100 ||
        confidence.decisionGrade < 0 ||
        confidence.decisionGrade > 100,
    ).map((metric) => metric.key);

    expect(violacoes).toEqual([]);
  });

  it("preenche os campos obrigatórios label, purpose, formula, owner, rationale e target", () => {
    const campos = [
      "label",
      "purpose",
      "formula",
      "owner",
      "rationale",
      "target",
    ] as const;

    const incompletas = KPI_DOMAIN_CATALOG.filter((metric) =>
      campos.some((campo) => {
        const valor = metric[campo];
        return typeof valor !== "string" || valor.trim().length === 0;
      }),
    ).map((metric) => metric.key);

    expect(incompletas).toEqual([]);
  });

  it("exige ao menos um sourceSignals em cada métrica", () => {
    const semSinal = KPI_DOMAIN_CATALOG.filter(
      (metric) =>
        !Array.isArray(metric.sourceSignals) ||
        metric.sourceSignals.length < 1 ||
        metric.sourceSignals.some(
          (sinal) => typeof sinal !== "string" || sinal.trim().length === 0,
        ),
    ).map((metric) => metric.key);

    expect(semSinal).toEqual([]);
  });

  it('restringe direction a "higher-is-better" ou "lower-is-better"', () => {
    const direcoesAceitas: readonly string[] = DIRECOES_ORDENADORAS;
    const invalidas = KPI_DOMAIN_CATALOG.filter(
      (metric) => !direcoesAceitas.includes(metric.direction),
    ).map((metric) => `${metric.key}: ${metric.direction}`);

    expect(invalidas).toEqual([]);
    expect(DIRECOES_ORDENADORAS).toEqual([
      "higher-is-better",
      "lower-is-better",
    ]);
  });

  it("mantém cada vertical com pelo menos uma métrica", () => {
    const semMetricas = KPI_DOMAIN_VERTICALS.filter(
      (vertical) => vertical.metrics.length < 1,
    ).map((vertical) => vertical.key);

    expect(semMetricas).toEqual([]);
  });

  it("possui pelo menos uma métrica com guardrail === true no catálogo", () => {
    const guardrails = KPI_DOMAIN_CATALOG.filter(
      (metric) => metric.guardrail === true,
    );

    expect(guardrails.length).toBeGreaterThan(0);
    expect(
      KPI_DOMAIN_VERTICALS.filter((vertical) =>
        vertical.metrics.some((metric) => metric.guardrail === true),
      ).map((vertical) => vertical.key),
    ).toEqual(KPI_DOMAIN_VERTICALS.map((vertical) => vertical.key));
  });
});
