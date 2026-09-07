import type { LayerKey } from "@workspace/db";
import type { DraftMetricInput, ProposedMetric } from "./discovery";

const LAYERS = new Set<LayerKey>([
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
]);

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

export function declaredMetricContractsFromBusinessCase(
  businessCase: unknown,
): DraftMetricInput[] {
  if (!businessCase || typeof businessCase !== "object") return [];
  const metricContracts = (businessCase as { metricContracts?: unknown }).metricContracts;
  if (!Array.isArray(metricContracts)) return [];

  return metricContracts.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const contract = candidate as Record<string, unknown>;
    if (
      typeof contract.layer !== "string" ||
      !LAYERS.has(contract.layer as LayerKey) ||
      typeof contract.label !== "string" ||
      !contract.label.trim() ||
      typeof contract.unit !== "string" ||
      !contract.unit.trim()
    ) {
      return [];
    }
    return [{
      layer: contract.layer as LayerKey,
      label: contract.label.trim(),
      unit: contract.unit.trim(),
      ...(typeof contract.target === "string" && contract.target.trim()
        ? { target: contract.target.trim() }
        : {}),
      ...(typeof contract.rationale === "string" && contract.rationale.trim()
        ? { rationale: contract.rationale.trim() }
        : {}),
    }];
  });
}

export function projectTelemetryToDeclaredContracts(
  declared: DraftMetricInput[],
  telemetry: ProposedMetric[],
): ProposedMetric[] {
  if (declared.length === 0) return telemetry;

  const remainingTelemetry = new Set(telemetry.map((_, index) => index));
  const projected: ProposedMetric[] = [];

  for (const contract of declared) {
    const candidates = [...remainingTelemetry].filter(
      (index) => telemetry[index]?.layer === contract.layer,
    );
    const exact = candidates.find((index) => {
      const observation = telemetry[index]!;
      return normalized(observation.label) === normalized(contract.label) ||
        normalized(observation.sourceSignal) === normalized(contract.label);
    });
    const sameUnit = candidates.filter(
      (index) => normalized(telemetry[index]!.unit) === normalized(contract.unit),
    );
    const competingContracts = declared.filter(
      (candidate) => candidate.layer === contract.layer && normalized(candidate.unit) === normalized(contract.unit),
    );
    const matchedIndex = exact ?? (
      sameUnit.length === 1 && competingContracts.length === 1
        ? sameUnit[0]
        : undefined
    );
    if (matchedIndex === undefined) continue;

    const observation = telemetry[matchedIndex]!;
    remainingTelemetry.delete(matchedIndex);
    projected.push({
      ...observation,
      label: contract.label,
      unit: contract.unit,
      ...(contract.target ? { target: contract.target } : {}),
      ...(contract.rationale ? { rationale: contract.rationale } : {}),
    });
  }

  return [
    ...projected,
    ...[...remainingTelemetry].map((index) => telemetry[index]!),
  ];
}
