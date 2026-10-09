import { describe, expect, it } from "vitest";
import type { KpiLayer } from "@workspace/db";
import { hasDeclaredBaseline, metricsFromLayers } from "./evaluation-metrics";
import type { MetricEvidence } from "./evidence/types";

type StoredMetric = KpiLayer["metrics"][number];

interface StoredMetricExtras {
  sourceSignal?: string;
  contractKey?: string;
  evidence?: MetricEvidence;
  baselineAvailable?: boolean;
  confidence?: number;
}

type StoredMetricInput = Partial<StoredMetric> & StoredMetricExtras;

function storedMetric(input: StoredMetricInput = {}): StoredMetric {
  const base: StoredMetric = {
    label: "Métrica sem campos extras",
    value: 1,
    unit: "%",
    trend: 0,
  };
  return { ...base, ...input } as StoredMetric;
}

function kpiLayer(key: KpiLayer["key"], metrics: StoredMetric[]): KpiLayer {
  return {
    key,
    label: `Camada ${key}`,
    score: 80,
    severity: "stable",
    metrics,
  };
}

function buildEvidence(
  overrides: Partial<MetricEvidence> = {},
): MetricEvidence {
  const base: MetricEvidence = {
    metricKey: "tickets_resolved",
    label: "Tickets resolvidos",
    value: 12,
    unit: "tickets/turno",
    capturedAt: "2026-02-01T12:00:00.000Z",
    kind: "observed",
    source: { type: "telemetry", name: "helpdesk", ref: "helpdesk/tickets" },
    lineage: [{ stage: "source", name: "carga incremental" }],
    confidence: 92,
    qualityFlags: [],
  };
  return { ...base, ...overrides };
}

describe("hasDeclaredBaseline", () => {
  it("retorna false para null, undefined, número, string e array vazio", () => {
    expect(hasDeclaredBaseline(null)).toBe(false);
    expect(hasDeclaredBaseline(undefined)).toBe(false);
    expect(hasDeclaredBaseline(12)).toBe(false);
    expect(hasDeclaredBaseline("12 tickets/turno")).toBe(false);
    expect(hasDeclaredBaseline([])).toBe(false);
  });

  it("retorna false quando o baseline está ausente ou não é texto", () => {
    expect(hasDeclaredBaseline({})).toBe(false);
    expect(hasDeclaredBaseline({ objective: "aumentar throughput" })).toBe(
      false,
    );
    expect(hasDeclaredBaseline({ baseline: 12 })).toBe(false);
    expect(hasDeclaredBaseline({ baseline: null })).toBe(false);
  });

  it("retorna false para baseline vazio ou composto apenas de espaços", () => {
    expect(hasDeclaredBaseline({ baseline: "" })).toBe(false);
    expect(hasDeclaredBaseline({ baseline: "   " })).toBe(false);
  });

  it("retorna true para baseline textual com conteúdo, ignorando espaços nas pontas", () => {
    expect(hasDeclaredBaseline({ baseline: "12 tickets/turno" })).toBe(true);
    expect(hasDeclaredBaseline({ baseline: "  4h  " })).toBe(true);
  });
});

describe("metricsFromLayers", () => {
  it("retorna lista vazia para entrada vazia e para layer sem métricas", () => {
    expect(metricsFromLayers([])).toEqual([]);
    expect(metricsFromLayers([kpiLayer("efficacy", [])])).toEqual([]);
  });

  it("achata as layers preservando ordem de layer e de métrica com o layer de origem", () => {
    const metrics = metricsFromLayers([
      kpiLayer("efficacy", [
        storedMetric({ label: "Taxa de sucesso", value: 94, unit: "%" }),
        storedMetric({ label: "Taxa de erro", value: 2, unit: "%" }),
      ]),
      kpiLayer("value", [
        storedMetric({ label: "Economia mensal", value: 4200, unit: "BRL" }),
      ]),
    ]);

    expect(metrics).toHaveLength(3);
    expect(metrics.map((metric) => [metric.layer, metric.label])).toEqual([
      ["efficacy", "Taxa de sucesso"],
      ["efficacy", "Taxa de erro"],
      ["value", "Economia mensal"],
    ]);
  });

  it("usa o sourceSignal guardado e cai para o label quando ele não existe", () => {
    const metrics = metricsFromLayers([
      kpiLayer("efficacy", [
        storedMetric({
          label: "Taxa de sucesso",
          sourceSignal: "success_rate",
        }),
        storedMetric({ label: "Tempo médio de resolução" }),
      ]),
    ]);

    expect(metrics.map((metric) => metric.sourceSignal)).toEqual([
      "success_rate",
      "Tempo médio de resolução",
    ]);
  });

  it("força confidence igual a 0 mesmo que a métrica guardada traga outro valor", () => {
    const metrics = metricsFromLayers([
      kpiLayer("governance", [
        storedMetric({ label: "Cobertura de evidências", confidence: 95 }),
      ]),
    ]);

    expect(metrics[0]?.confidence).toBe(0);
  });

  it("gera apenas as chaves layer, label, sourceSignal, value, unit e confidence na métrica mínima", () => {
    const metrics = metricsFromLayers([
      kpiLayer("efficiency", [
        storedMetric({
          label: "Custo por atendimento",
          value: 3.5,
          unit: "BRL",
          trend: 5,
          direction: "up",
        }),
      ]),
    ]);

    expect(Object.keys(metrics[0] as object).sort()).toEqual([
      "confidence",
      "label",
      "layer",
      "sourceSignal",
      "unit",
      "value",
    ]);
    expect(metrics[0]).not.toHaveProperty("target");
    expect(metrics[0]).not.toHaveProperty("rationale");
    expect(metrics[0]).not.toHaveProperty("contractKey");
    expect(metrics[0]).not.toHaveProperty("evidence");
    expect(metrics[0]).not.toHaveProperty("baselineAvailable");
    expect(metrics[0]).not.toHaveProperty("trend");
    expect(metrics[0]).not.toHaveProperty("direction");
    expect(metrics[0]).toEqual({
      layer: "efficiency",
      label: "Custo por atendimento",
      sourceSignal: "Custo por atendimento",
      value: 3.5,
      unit: "BRL",
      confidence: 0,
    });
  });

  it("copia todos os campos da métrica completa e preserva a referência da evidência", () => {
    const evidence = buildEvidence();
    const metrics = metricsFromLayers([
      kpiLayer("value", [
        storedMetric({
          label: "Tickets resolvidos",
          value: 12,
          unit: "tickets/turno",
          trend: -3,
          target: "≥ 10 tickets/turno",
          rationale: "Capacidade da operação de suporte",
          contractKey: "support_tickets_resolved",
          evidence,
          baselineAvailable: true,
        }),
      ]),
    ]);

    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toEqual({
      layer: "value",
      label: "Tickets resolvidos",
      sourceSignal: "Tickets resolvidos",
      value: 12,
      unit: "tickets/turno",
      confidence: 0,
      target: "≥ 10 tickets/turno",
      rationale: "Capacidade da operação de suporte",
      contractKey: "support_tickets_resolved",
      evidence,
      baselineAvailable: true,
    });
    expect(metrics[0]?.evidence).toBe(evidence);
  });

  it("mantém baselineAvailable false como propriedade explícita", () => {
    const metrics = metricsFromLayers([
      kpiLayer("adoption", [
        storedMetric({ label: "Usuários ativos", baselineAvailable: false }),
      ]),
    ]);

    expect(metrics[0]).toHaveProperty("baselineAvailable", false);
  });

  it("omite target e rationale vazios porque a cópia usa checagem truthy", () => {
    const metrics = metricsFromLayers([
      kpiLayer("governance", [
        storedMetric({
          label: "Auditorias realizadas",
          target: "",
          rationale: "",
          contractKey: "",
          baselineAvailable: false,
        }),
      ]),
    ]);

    expect(Object.keys(metrics[0] as object).sort()).toEqual([
      "baselineAvailable",
      "confidence",
      "label",
      "layer",
      "sourceSignal",
      "unit",
      "value",
    ]);
    expect(metrics[0]).not.toHaveProperty("target");
    expect(metrics[0]).not.toHaveProperty("rationale");
    expect(metrics[0]).not.toHaveProperty("contractKey");
  });
});
