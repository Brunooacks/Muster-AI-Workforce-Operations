import { describe, it, expect } from "vitest";
import {
  scoreEvaluation,
  buildProposedMetrics,
  proposedMetricsFromDraft,
  valueForUnit,
  metricTargetStatus,
  LAYER_ORDER,
  DEFAULT_LAYER_METRIC,
  type ProposedMetric,
} from "./discovery";

const VERDICTS = new Set(["promote", "mentor", "observation", "retire"]);
const SEVERITIES = new Set(["critical", "high", "medium", "stable"]);

// A small, representative set of real SIGNAL_MAP keys (all resolve to metrics).
const REAL_SIGNALS = ["resolution_rate", "routing_accuracy"];

describe("metricTargetStatus", () => {
  it("handles 'higher is better' targets", () => {
    expect(metricTargetStatus(90, "≥ 85%")).toBe("on");
    expect(metricTargetStatus(80, "≥ 85%")).toBe("off");
  });

  it("handles 'lower is better' targets", () => {
    expect(metricTargetStatus(50, "< 60s")).toBe("on");
    expect(metricTargetStatus(70, "< 60s")).toBe("off");
  });

  it("treats a bare number as an upper bound", () => {
    expect(metricTargetStatus(0, "0")).toBe("on");
    expect(metricTargetStatus(1, "0")).toBe("off");
  });

  it("handles pt-BR decimal ranges", () => {
    expect(metricTargetStatus(0.3, "R$ 0,10–0,40")).toBe("on");
    expect(metricTargetStatus(0.5, "R$ 0,10–0,40")).toBe("off");
  });

  it("returns null for non-comparable targets", () => {
    expect(metricTargetStatus(10, undefined)).toBeNull();
    expect(metricTargetStatus(10, "—")).toBeNull();
    expect(metricTargetStatus(10, "baseline +20%")).toBeNull();
    expect(metricTargetStatus(10, "algo textual")).toBeNull();
  });
});

describe("valueForUnit", () => {
  const min = () => 0;
  const max = () => 0.999999;

  it("keeps percentages within [45, 95]", () => {
    expect(valueForUnit(min, "%")).toBe(45);
    expect(valueForUnit(max, "%")).toBeLessThanOrEqual(95);
    expect(valueForUnit(max, "%")).toBeGreaterThanOrEqual(94);
  });

  it("keeps seconds within [20, 200]", () => {
    expect(valueForUnit(min, "s")).toBe(20);
    expect(valueForUnit(max, "s")).toBeLessThanOrEqual(200);
  });

  it("keeps R$ within [0.05, 0.65]", () => {
    expect(valueForUnit(min, "R$")).toBeCloseTo(0.05, 5);
    expect(valueForUnit(max, "R$")).toBeLessThanOrEqual(0.65);
  });

  it("keeps /5 ratings within [3.5, 5.0]", () => {
    expect(valueForUnit(min, "/5")).toBeCloseTo(3.5, 5);
    expect(valueForUnit(max, "/5")).toBeLessThanOrEqual(5);
  });

  it("uses the default band for unknown units", () => {
    expect(valueForUnit(min, "widgets")).toBe(40);
    expect(valueForUnit(max, "widgets")).toBeLessThanOrEqual(95);
  });
});

describe("buildProposedMetrics", () => {
  it("is deterministic for the same externalId", () => {
    const a = buildProposedMetrics("agent-x", REAL_SIGNALS);
    const b = buildProposedMetrics("agent-x", REAL_SIGNALS);
    expect(a).toEqual(b);
  });

  it("emits one metric per known signal and drops unknown signals", () => {
    const metrics = buildProposedMetrics("agent-x", [
      ...REAL_SIGNALS,
      "totally_unknown_signal",
    ]);
    expect(metrics).toHaveLength(REAL_SIGNALS.length);
    for (const m of metrics) {
      expect(REAL_SIGNALS).toContain(m.sourceSignal);
    }
  });

  it("keeps confidence within [70, 98]", () => {
    const metrics = buildProposedMetrics("agent-y", REAL_SIGNALS);
    for (const m of metrics) {
      expect(m.confidence).toBeGreaterThanOrEqual(70);
      expect(m.confidence).toBeLessThanOrEqual(98);
    }
  });

  it("honors reference values when a seeded agent provides overrides", () => {
    const metrics = buildProposedMetrics(
      "julia",
      ["acuracia_decisoes", "retorno_investimento"],
      {
        acuracia_decisoes: 72,
        retorno_investimento: 12,
      },
    );
    expect(metrics.map((metric) => metric.value)).toEqual([72, 12]);
  });
});

describe("proposedMetricsFromDraft", () => {
  it("always covers all 5 layers even from an empty draft", () => {
    const metrics = proposedMetricsFromDraft("agent-z", []);
    const layers = new Set(metrics.map((m) => m.layer));
    for (const layer of LAYER_ORDER) {
      expect(layers.has(layer)).toBe(true);
    }
  });

  it("honors a reviewer-supplied value instead of the seeded one", () => {
    const metrics = proposedMetricsFromDraft("agent-z", [
      {
        layer: "efficacy",
        label: DEFAULT_LAYER_METRIC.efficacy.label,
        unit: "%",
        value: 42,
      },
    ]);
    const efficacy = metrics.find((m) => m.layer === "efficacy");
    expect(efficacy?.value).toBe(42);
  });

  it("is deterministic for the same externalId", () => {
    const a = proposedMetricsFromDraft("agent-z", []);
    const b = proposedMetricsFromDraft("agent-z", []);
    expect(a).toEqual(b);
  });
});

describe("scoreEvaluation", () => {
  const metrics: ProposedMetric[] = buildProposedMetrics("agent-eval", [
    "resolution_rate",
  ]);

  it("is fully reproducible for the same inputs", () => {
    const a = scoreEvaluation("agent-eval", metrics);
    const b = scoreEvaluation("agent-eval", metrics);
    expect(a).toEqual(b);
  });

  it("returns exactly the 5 layers in canonical order", () => {
    const result = scoreEvaluation("agent-eval", metrics);
    expect(result.layers.map((l) => l.key)).toEqual(LAYER_ORDER);
  });

  it("produces a bounded, self-consistent verdict", () => {
    const result = scoreEvaluation("agent-eval", metrics);
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(VERDICTS.has(result.verdict)).toBe(true);
    expect(SEVERITIES.has(result.severity)).toBe(true);

    // Verdict must follow the documented thresholds off healthScore.
    const h = result.healthScore;
    const expected =
      h >= 78
        ? "promote"
        : h >= 62
          ? "mentor"
          : h >= 50
            ? "observation"
            : "retire";
    expect(result.verdict).toBe(expected);
  });

  it("keeps every per-layer score within [0, 100]", () => {
    const result = scoreEvaluation("agent-eval", metrics);
    for (const layer of result.layers) {
      expect(layer.score).toBeGreaterThanOrEqual(0);
      expect(layer.score).toBeLessThanOrEqual(100);
    }
  });

  it("preserves source signal and evaluates a matched KPI contract", () => {
    const result = scoreEvaluation("contract-agent", [
      {
        layer: "efficacy",
        label: "Sucesso na primeira passada",
        sourceSignal: "task_success",
        value: 95,
        unit: "%",
        confidence: 90,
        target: "≥ 90%",
        evidence: {
          metricKey: "task_success",
          label: "Sucesso na primeira passada",
          value: 95,
          unit: "%",
          capturedAt: "2026-08-11T00:00:00.000Z",
          kind: "observed",
          source: { type: "telemetry", name: "agent_events" },
          lineage: [{ stage: "aggregate", name: "telemetry_30d" }],
          confidence: 90,
          sampleSize: 30,
          qualityFlags: [],
        },
        baselineAvailable: true,
      },
    ]);
    const metric = result.layers.find((layer) => layer.key === "efficacy")
      ?.metrics[0] as
      | ((typeof result.layers)[number]["metrics"][number] & {
          sourceSignal?: string;
          contractKey?: string;
          status?: string;
          eligibleForDecision?: boolean;
        })
      | undefined;

    expect(metric).toMatchObject({
      sourceSignal: "task_success",
      contractKey: "engenharia-sucesso-primeira-passada",
      status: "on-target",
      eligibleForDecision: true,
    });
    expect(result.evidence).toEqual({
      insufficientEvidence: 0,
      notComparable: 0,
      comparable: 1,
    });
  });

  it("marks contract metrics as insufficient-evidence instead of scoring them as on-target", () => {
    const result = scoreEvaluation("weak-evidence", [
      {
        layer: "efficacy",
        label: "Sucesso na primeira passada",
        sourceSignal: "task_success",
        value: 99,
        unit: "%",
        confidence: 99,
        target: "≥ 90%",
      },
    ]);
    const metric = result.layers.find((layer) => layer.key === "efficacy")
      ?.metrics[0] as
      | {
          status?: string;
          eligibleForDecision?: boolean;
          evidenceReasons?: string[];
        }
      | undefined;

    expect(metric).toMatchObject({
      status: "insufficient-evidence",
      eligibleForDecision: false,
    });
    expect(metric?.evidenceReasons).toEqual(
      expect.arrayContaining([
        "amostra abaixo do mínimo do contrato",
        "baseline obrigatório ausente",
      ]),
    );
    expect(result.evidence.insufficientEvidence).toBe(1);
  });

  it("keeps legacy metrics compatible when no contract is available", () => {
    const result = scoreEvaluation("legacy-agent", [
      {
        layer: "efficacy",
        label: "Métrica legada",
        sourceSignal: "Métrica legada",
        value: 90,
        unit: "%",
        confidence: 0,
        target: "≥ 85%",
      },
    ]);
    const metric = result.layers.find((layer) => layer.key === "efficacy")
      ?.metrics[0] as
      | { status?: string; eligibleForDecision?: boolean }
      | undefined;
    expect(metric).toMatchObject({
      status: "on-target",
      eligibleForDecision: true,
    });
    expect(result.evidence.insufficientEvidence).toBe(0);
  });
});
