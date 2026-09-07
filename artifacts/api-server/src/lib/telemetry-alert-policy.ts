export interface TelemetryAlertInput {
  verdict: "promote" | "mentor" | "retire" | "observation";
  healthScore: number;
  rationale: string;
  evaluatedAt: Date;
}
export interface TelemetryAlertPlan {
  pattern: string;
  patternType: "telemetry-performance";
  severity: "medium" | "high" | "critical";
  hypothesis: string;
  recommendation: string;
  dueAt: Date;
}

export function telemetryAlertPlan(
  input: TelemetryAlertInput,
): TelemetryAlertPlan | null {
  if (input.verdict !== "mentor" && input.verdict !== "retire") return null;

  const retire = input.verdict === "retire";
  const dueInDays = retire ? 1 : 7;
  return {
    pattern: retire
      ? "Risco crítico exige revisão da função"
      : "Desempenho abaixo do contrato exige mentoria",
    patternType: "telemetry-performance",
    severity: retire
      ? "critical"
      : input.healthScore < 60
        ? "high"
        : "medium",
    hypothesis: input.rationale,
    recommendation: retire
      ? "Conter autonomia, preservar evidências e decidir suspensão ou aposentadoria com o owner."
      : "Executar o plano de desenvolvimento, acompanhar dois ciclos comparáveis e manter autonomia supervisionada.",
    dueAt: new Date(input.evaluatedAt.getTime() + dueInDays * 86_400_000),
  };
}
