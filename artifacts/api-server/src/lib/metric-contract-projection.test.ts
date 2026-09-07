import { describe, expect, it } from "vitest";
import type { DraftMetricInput, ProposedMetric } from "./discovery";
import {
  declaredMetricContractsFromBusinessCase,
  projectTelemetryToDeclaredContracts,
} from "./metric-contract-projection";

const declared: DraftMetricInput[] = [
  { layer: "efficacy", label: "Trabalho conforme contrato", unit: "%", target: "≥ 90%" },
  { layer: "governance", label: "Cobertura de evidências", unit: "%", target: "100%" },
];

const telemetry: ProposedMetric[] = [
  { layer: "efficacy", label: "Taxa de sucesso", sourceSignal: "success_rate", value: 94, unit: "%", confidence: 90, target: "≥ 90%" },
  { layer: "governance", label: "Taxa de erro", sourceSignal: "error_rate", value: 2, unit: "%", confidence: 90, target: "≤ 5%" },
  { layer: "governance", label: "Escalonamento", sourceSignal: "escalation_rate", value: 8, unit: "%", confidence: 90, target: "≤ 20%" },
];

describe("metric contract projection", () => {
  it("lê somente contratos válidos do business case", () => {
    expect(declaredMetricContractsFromBusinessCase({ metricContracts: [...declared, { layer: "invalid" }] })).toEqual(declared);
  });

  it("renomeia sinal compatível sem inventar correspondência ambígua", () => {
    const result = projectTelemetryToDeclaredContracts(declared, telemetry);
    expect(result.find((metric) => metric.layer === "efficacy")?.label).toBe("Trabalho conforme contrato");
    expect(result.some((metric) => metric.label === "Cobertura de evidências")).toBe(false);
    expect(result.filter((metric) => metric.layer === "governance").map((metric) => metric.label)).toEqual([
      "Taxa de erro",
      "Escalonamento",
    ]);
  });
});
