import { describe, expect, it } from "vitest";
import { compareBeforeAfter, loadMetricEvidence, prepareBaselinePlan } from ".";
import type { EvidenceSourceType, LineageStage, MetricEvidence } from "./types";

const INTERVENTION_AT = "2026-08-10T00:00:00Z";

function evidence(
  value: number,
  capturedAt: string,
  confidence = 90,
): MetricEvidence {
  return loadMetricEvidence({
    metricKey: "resolution_rate",
    label: "Taxa de resolução",
    value,
    unit: "%",
    capturedAt,
    confidence,
    source: { type: "telemetry", name: "runner local", ref: "run-1" },
    lineage: [{ stage: "source", name: "execution events", ref: "events-1" }],
  });
}

function evidenceFor(input: {
  metricKey: string;
  unit: string;
  value: number;
  capturedAt: string;
}): MetricEvidence {
  return loadMetricEvidence({
    metricKey: input.metricKey,
    label: input.metricKey,
    value: input.value,
    unit: input.unit,
    capturedAt: input.capturedAt,
    confidence: 90,
    source: { type: "telemetry", name: "runner local" },
    lineage: [{ stage: "source", name: "execution events" }],
  });
}

describe("prepareBaselinePlan com entradas inválidas", () => {
  it("rejeita interventionAt que não é uma data válida", () => {
    expect(() =>
      prepareBaselinePlan({
        metricKey: "resolution_rate",
        interventionAt: "not-a-date",
      }),
    ).toThrow("interventionAt deve ser uma data válida");
  });

  it("rejeita beforeDays zero e beforeDays fracionário", () => {
    expect(() =>
      prepareBaselinePlan({
        metricKey: "resolution_rate",
        interventionAt: INTERVENTION_AT,
        beforeDays: 0,
      }),
    ).toThrow("beforeDays deve ser um inteiro positivo");
    expect(() =>
      prepareBaselinePlan({
        metricKey: "resolution_rate",
        interventionAt: INTERVENTION_AT,
        beforeDays: 1.5,
      }),
    ).toThrow("beforeDays deve ser um inteiro positivo");
  });

  it("rejeita afterDays zero e afterDays negativo", () => {
    expect(() =>
      prepareBaselinePlan({
        metricKey: "resolution_rate",
        interventionAt: INTERVENTION_AT,
        afterDays: 0,
      }),
    ).toThrow("afterDays deve ser um inteiro positivo");
    expect(() =>
      prepareBaselinePlan({
        metricKey: "resolution_rate",
        interventionAt: INTERVENTION_AT,
        afterDays: -5,
      }),
    ).toThrow("afterDays deve ser um inteiro positivo");
  });

  it("exige metricKey preenchida, seja vazia ou só com espaços", () => {
    expect(() =>
      prepareBaselinePlan({ metricKey: "", interventionAt: INTERVENTION_AT }),
    ).toThrow("metricKey é obrigatório");
    expect(() =>
      prepareBaselinePlan({
        metricKey: "   ",
        interventionAt: INTERVENTION_AT,
      }),
    ).toThrow("metricKey é obrigatório");
  });
});

describe("prepareBaselinePlan com entradas normalizáveis", () => {
  it("apara metricKey e usa 14 dias de janela quando as durações são omitidas", () => {
    const plan = prepareBaselinePlan({
      metricKey: "  resolution_rate  ",
      interventionAt: INTERVENTION_AT,
    });

    expect(plan.metricKey).toBe("resolution_rate");
    expect(plan.interventionAt).toBe("2026-08-10T00:00:00.000Z");
    expect(plan.before).toEqual({
      kind: "before",
      from: "2026-07-27T00:00:00.000Z",
      to: "2026-08-10T00:00:00.000Z",
      durationDays: 14,
      status: "ready",
    });
    expect(plan.after).toEqual({
      kind: "after",
      from: "2026-08-10T00:00:00.000Z",
      to: "2026-08-24T00:00:00.000Z",
      durationDays: 14,
      status: "pending",
    });
  });

  it("aceita Date em interventionAt e serializa em ISO", () => {
    const plan = prepareBaselinePlan({
      metricKey: "resolution_rate",
      interventionAt: new Date("2026-08-10T12:00:00Z"),
    });

    expect(plan.interventionAt).toBe("2026-08-10T12:00:00.000Z");
    expect(plan.before.from).toBe("2026-07-27T12:00:00.000Z");
    expect(plan.after.from).toBe("2026-08-10T12:00:00.000Z");
    expect(plan.after.to).toBe("2026-08-24T12:00:00.000Z");
  });
});

describe("compareBeforeAfter exige amostras comparáveis", () => {
  it("rejeita quando as evidências têm métricas diferentes", () => {
    const before = [evidence(70, "2026-08-01T00:00:00Z")];
    const after = [
      evidenceFor({
        metricKey: "tempo_medio_resolucao",
        unit: "%",
        value: 55,
        capturedAt: "2026-08-11T00:00:00Z",
      }),
    ];

    expect(() => compareBeforeAfter(before, after)).toThrow(
      "As evidências precisam usar a mesma métrica e unidade",
    );
  });

  it("rejeita quando as evidências têm unidades diferentes", () => {
    const before = [evidence(70, "2026-08-01T00:00:00Z")];
    const after = [
      evidenceFor({
        metricKey: "resolution_rate",
        unit: "min",
        value: 55,
        capturedAt: "2026-08-11T00:00:00Z",
      }),
    ];

    expect(() => compareBeforeAfter(before, after)).toThrow(
      "As evidências precisam usar a mesma métrica e unidade",
    );
  });
});

describe("compareBeforeAfter respeita a direção declarada", () => {
  it("trata queda como improved em lower_is_better", () => {
    const result = compareBeforeAfter(
      [evidence(80, "2026-08-01T00:00:00Z")],
      [evidence(60, "2026-08-11T00:00:00Z")],
      { direction: "lower_is_better" },
    );

    expect(result).toMatchObject({
      direction: "lower_is_better",
      status: "improved",
      delta: -20,
      deltaPercent: -25,
    });
  });

  it("trata alta como declined em lower_is_better", () => {
    const result = compareBeforeAfter(
      [evidence(60, "2026-08-01T00:00:00Z")],
      [evidence(80, "2026-08-11T00:00:00Z")],
      { direction: "lower_is_better" },
    );

    expect(result).toMatchObject({
      direction: "lower_is_better",
      status: "declined",
      delta: 20,
      deltaPercent: 33.333,
    });
  });
});

describe("compareBeforeAfter aplica o limiar de estabilidade", () => {
  it("declara stable para variação dentro do limiar padrão de 5%", () => {
    const result = compareBeforeAfter(
      [evidence(100, "2026-08-01T00:00:00Z")],
      [evidence(104, "2026-08-11T00:00:00Z")],
    );

    expect(result).toMatchObject({
      status: "stable",
      delta: 4,
      deltaPercent: 4,
    });
  });

  it("usa stabilityThresholdPercent customizado como corte", () => {
    const before = [evidence(100, "2026-08-01T00:00:00Z")];
    const after = [evidence(115, "2026-08-11T00:00:00Z")];

    expect(compareBeforeAfter(before, after).status).toBe("improved");
    expect(
      compareBeforeAfter(before, after, { stabilityThresholdPercent: 20 })
        .status,
    ).toBe("stable");
  });

  it("declara stable quando a variação cai exatamente no limiar", () => {
    const result = compareBeforeAfter(
      [evidence(100, "2026-08-01T00:00:00Z")],
      [evidence(105, "2026-08-11T00:00:00Z")],
      { stabilityThresholdPercent: 5 },
    );

    expect(result).toMatchObject({ status: "stable", deltaPercent: 5 });
  });
});

describe("compareBeforeAfter com bordas numéricas", () => {
  it("devolve insufficient_evidence com reason zero_baseline quando a média antes é zero", () => {
    const result = compareBeforeAfter(
      [evidence(0, "2026-08-01T00:00:00Z")],
      [evidence(10, "2026-08-11T00:00:00Z")],
    );

    expect(result).toMatchObject({
      status: "insufficient_evidence",
      reason: "zero_baseline",
      delta: 10,
      deltaPercent: null,
    });
    expect(result.before.mean).toBe(0);
  });

  it("mantém stable quando antes e depois são zero", () => {
    const result = compareBeforeAfter(
      [evidence(0, "2026-08-01T00:00:00Z")],
      [evidence(0, "2026-08-11T00:00:00Z")],
    );

    expect(result).toMatchObject({
      status: "stable",
      delta: 0,
      deltaPercent: 0,
    });
    expect(result.reason).toBeUndefined();
  });

  it("devolve insufficient_evidence sem métrica quando ambas as listas estão vazias", () => {
    const result = compareBeforeAfter([], []);

    expect(result).toMatchObject({
      metricKey: "",
      unit: "",
      status: "insufficient_evidence",
      delta: null,
      deltaPercent: null,
      confidence: 0,
    });
    expect(result.reason).toBeUndefined();
    expect(result.before).toEqual({
      sampleSize: 0,
      mean: null,
      confidence: 0,
      kinds: [],
    });
    expect(result.after).toEqual({
      sampleSize: 0,
      mean: null,
      confidence: 0,
      kinds: [],
    });
  });
});

describe("loadMetricEvidence normaliza a fonte", () => {
  it("degrada source.type desconhecido para unknown e sinaliza missing_source", () => {
    const metric = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      confidence: 90,
      source: {
        type: "foo" as EvidenceSourceType,
        name: "  provedor externo  ",
      },
      lineage: [{ stage: "source", name: "execution events" }],
    });

    expect(metric.source.type).toBe("unknown");
    expect(metric.source.name).toBe("provedor externo");
    expect(metric.kind).toBe("inferred");
    expect(metric.qualityFlags).toEqual(
      expect.arrayContaining(["missing_source", "inferred_value"]),
    );
  });

  it("usa 'Fonte não informada' quando a evidência não traz source", () => {
    const metric = loadMetricEvidence({
      metricKey: "custo_por_conversa",
      label: "Custo por conversa",
      value: 3.5,
      unit: "BRL",
      capturedAt: INTERVENTION_AT,
      confidence: 90,
      lineage: [{ stage: "source", name: "billing export" }],
    });

    expect(metric.source).toEqual({
      type: "unknown",
      name: "Fonte não informada",
    });
    expect(metric.qualityFlags).toContain("missing_source");
  });
});

describe("loadMetricEvidence valida a linhagem", () => {
  it("descarta passos com stage inválido ou name vazio e sinaliza missing_lineage", () => {
    const metric = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      confidence: 90,
      source: { type: "telemetry", name: "runner local" },
      lineage: [
        { stage: "invalid" as LineageStage, name: "etapa desconhecida" },
        { stage: "source", name: "   " },
        { stage: "aggregate", name: "  agregação diária  ", ref: "  run-7  " },
      ],
    });

    expect(metric.lineage).toEqual([
      { stage: "aggregate", name: "agregação diária", ref: "run-7" },
    ]);
    expect(metric.qualityFlags).toContain("missing_lineage");
  });

  it("não sinaliza missing_lineage quando todos os passos são válidos", () => {
    const metric = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      confidence: 90,
      source: { type: "telemetry", name: "runner local" },
      lineage: [
        {
          stage: "source",
          name: " execution events ",
          inputRefs: ["events-1"],
        },
        { stage: "aggregate", name: "agregação diária" },
      ],
    });

    expect(metric.lineage).toHaveLength(2);
    expect(metric.lineage[0]).toEqual({
      stage: "source",
      name: "execution events",
      inputRefs: ["events-1"],
    });
    expect(metric.qualityFlags).toEqual([]);
  });
});

describe("loadMetricEvidence trata a confiança como borda", () => {
  it("zera confidence NaN e sinaliza low_confidence", () => {
    const metric = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      confidence: Number.NaN,
      source: { type: "telemetry", name: "runner local" },
      lineage: [{ stage: "source", name: "execution events" }],
    });

    expect(metric.confidence).toBe(0);
    expect(metric.qualityFlags).toContain("low_confidence");
  });

  it("zera confidence negativa em vez de aceitar valor impossível", () => {
    const metric = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      confidence: -20,
      source: { type: "telemetry", name: "runner local" },
      lineage: [{ stage: "source", name: "execution events" }],
    });

    expect(metric.confidence).toBe(0);
    expect(metric.qualityFlags).toContain("low_confidence");
  });

  it("arredonda confidence para uma casa decimal", () => {
    const metric = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      confidence: 66.66,
      source: { type: "telemetry", name: "runner local" },
      lineage: [{ stage: "source", name: "execution events" }],
    });

    expect(metric.confidence).toBe(66.7);
    expect(metric.qualityFlags).not.toContain("low_confidence");
  });

  it("usa o confidence padrão de cada kind quando a confiança não vem", () => {
    const observed = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      source: { type: "telemetry", name: "runner local" },
      lineage: [{ stage: "source", name: "execution events" }],
    });
    const inferred = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      source: { type: "model_inference", name: "avaliador" },
      lineage: [{ stage: "model", name: "judge-v1" }],
    });
    const synthetic = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.8,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      source: { type: "simulation", name: "cenário base" },
      lineage: [{ stage: "model", name: "gerador-v1" }],
    });

    expect(observed).toMatchObject({ kind: "observed", confidence: 70 });
    expect(inferred).toMatchObject({ kind: "inferred", confidence: 45 });
    expect(synthetic).toMatchObject({ kind: "synthetic", confidence: 20 });
    expect(observed.qualityFlags).not.toContain("low_confidence");
    expect(inferred.qualityFlags).toContain("low_confidence");
    expect(synthetic.qualityFlags).toContain("low_confidence");
  });
});

describe("loadMetricEvidence deriva metricKey e valida o candidato", () => {
  it("gera metricKey a partir de label acentuado sem chave explícita", () => {
    const metric = loadMetricEvidence({
      label: "Taxa de Resolução",
      value: 0.82,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      confidence: 90,
      source: { type: "telemetry", name: "runner local" },
      lineage: [{ stage: "source", name: "execution events" }],
    });

    expect(metric.metricKey).toBe("taxa_de_resolucao");
  });

  it("rejeita label que só contém símbolos e não gera metricKey", () => {
    expect(() =>
      loadMetricEvidence({
        label: "!!!",
        value: 0.82,
        unit: "%",
        capturedAt: INTERVENTION_AT,
        source: { type: "telemetry", name: "runner local" },
      }),
    ).toThrow("A métrica precisa de uma chave ou label válida");
  });

  it("rejeita capturedAt inválido", () => {
    expect(() =>
      loadMetricEvidence({
        metricKey: "resolution_rate",
        label: "Taxa de resolução",
        value: 0.82,
        unit: "%",
        capturedAt: "ontem",
        source: { type: "telemetry", name: "runner local" },
      }),
    ).toThrow("capturedAt deve ser uma data válida");
  });

  it("rejeita valor não finito (Infinity e NaN)", () => {
    const candidate = {
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      unit: "%",
      capturedAt: INTERVENTION_AT,
      source: { type: "telemetry" as const, name: "runner local" },
    };

    expect(() =>
      loadMetricEvidence({ ...candidate, value: Number.POSITIVE_INFINITY }),
    ).toThrow("O valor da métrica precisa ser finito");
    expect(() =>
      loadMetricEvidence({ ...candidate, value: Number.NaN }),
    ).toThrow("O valor da métrica precisa ser finito");
  });

  it("rejeita unit vazia ou só com espaços", () => {
    const candidate = {
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.82,
      capturedAt: INTERVENTION_AT,
      source: { type: "telemetry" as const, name: "runner local" },
    };

    expect(() => loadMetricEvidence({ ...candidate, unit: "" })).toThrow(
      "A métrica precisa de uma unidade",
    );
    expect(() => loadMetricEvidence({ ...candidate, unit: "   " })).toThrow(
      "A métrica precisa de uma unidade",
    );
  });

  it("rejeita label vazio ou só com espaços", () => {
    const candidate = {
      metricKey: "resolution_rate",
      value: 0.82,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      source: { type: "telemetry" as const, name: "runner local" },
    };

    expect(() => loadMetricEvidence({ ...candidate, label: "" })).toThrow(
      "A métrica precisa de um label",
    );
    expect(() => loadMetricEvidence({ ...candidate, label: "   " })).toThrow(
      "A métrica precisa de um label",
    );
  });

  it("deixa evidenceKind explícito vencer o tipo da fonte", () => {
    const metric = loadMetricEvidence({
      metricKey: "resolution_rate",
      label: "Taxa de resolução",
      value: 0.82,
      unit: "%",
      capturedAt: INTERVENTION_AT,
      source: { type: "telemetry", name: "runner local" },
      lineage: [{ stage: "source", name: "execution events" }],
      evidenceKind: "synthetic",
    });

    expect(metric.kind).toBe("synthetic");
    expect(metric.qualityFlags).toContain("synthetic_value");
    expect(metric.qualityFlags).not.toContain("inferred_value");
    expect(metric.confidence).toBe(20);
  });
});
