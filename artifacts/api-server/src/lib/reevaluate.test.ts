import { describe, expect, it } from "vitest";
import type { KpiLayer } from "@workspace/db";
import {
  hasDeclaredBaseline,
  metricsFromLayers,
} from "./evaluation-metrics";

describe("hasDeclaredBaseline", () => {
  it("recognizes a baseline declared in the agent work record", () => {
    expect(
      hasDeclaredBaseline({ baseline: "30 execuções no período de controle" }),
    ).toBe(true);
  });

  it("rejects missing or blank baseline declarations", () => {
    expect(hasDeclaredBaseline(undefined)).toBe(false);
    expect(hasDeclaredBaseline({ baseline: "   " })).toBe(false);
    expect(hasDeclaredBaseline({ baseline: 30 })).toBe(false);
  });
});

describe("metricsFromLayers", () => {
  it("retains telemetry source signal and evidence for a later reevaluation", () => {
    const layers = [
      {
        key: "efficacy",
        label: "Eficácia",
        score: 90,
        severity: "stable",
        metrics: [
          {
            label: "Sucesso na primeira passada",
            value: 95,
            unit: "%",
            trend: 0,
            direction: "flat",
            target: "≥ 90%",
            sourceSignal: "task_success",
            contractKey: "engenharia-sucesso-primeira-passada",
            status: "on-target",
            eligibleForDecision: true,
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
          },
        ],
      },
    ] as unknown as KpiLayer[];
    const metrics = metricsFromLayers(layers);

    expect(metrics[0]).toMatchObject({
      sourceSignal: "task_success",
      contractKey: "engenharia-sucesso-primeira-passada",
      evidence: {
        kind: "observed",
        confidence: 90,
        sampleSize: 30,
      },
    });
  });

  it("falls back to the label for evaluations persisted before the contract metadata", () => {
    const metrics = metricsFromLayers([
      {
        key: "value",
        label: "Valor",
        score: 50,
        severity: "medium",
        metrics: [{ label: "Custo total", value: 10, unit: "R$", trend: 0 }],
      },
    ]);

    expect(metrics[0]?.sourceSignal).toBe("Custo total");
    expect(metrics[0]?.evidence).toBeUndefined();
  });
});
