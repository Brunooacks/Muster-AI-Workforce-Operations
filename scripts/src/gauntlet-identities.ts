import type { GauntletProfile } from "./gauntlet-workloads";

const PROFILE_LABELS: Record<GauntletProfile, string> = {
  baseline: "Operação saudável",
  stress: "Carga alta",
  chaos: "Falha controlada",
};

export function gauntletAgentName(
  agentName: string,
  profile: GauntletProfile,
): string {
  return `[gauntlet-real] v3 · ${agentName} · ${PROFILE_LABELS[profile]}`;
}

export function gauntletExternalId(
  scenarioId: string,
  profile: GauntletProfile,
): string {
  return `local:gauntlet:v3:${scenarioId}:${profile}`;
}

export function gauntletRuntimeStatus(
  profile: GauntletProfile,
): "healthy" | "degraded" {
  return profile === "chaos" ? "degraded" : "healthy";
}
