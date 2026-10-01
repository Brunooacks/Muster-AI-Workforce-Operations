export type OperationalTone = "stable" | "attention" | "critical" | "neutral";

export type DueState = {
  label: string;
  tone: OperationalTone;
  overdue: boolean;
};

export function relativeAge(
  value: string | number | Date | null | undefined,
  now = Date.now(),
): string {
  if (value == null) return "sem atualização";
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "horário indisponível";

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return "agora";
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}
export function dueState(
  dueAt: string | null | undefined,
  now = Date.now(),
): DueState {
  if (!dueAt) return { label: "sem prazo", tone: "neutral", overdue: false };
  const timestamp = new Date(dueAt).getTime();
  if (Number.isNaN(timestamp)) {
    return { label: "prazo inválido", tone: "attention", overdue: false };
  }

  const differenceMinutes = Math.ceil((timestamp - now) / 60_000);
  if (differenceMinutes < 0) {
    const elapsed = Math.max(1, Math.abs(differenceMinutes));
    return {
      label: elapsed < 60 ? `vencido há ${elapsed}min` : `vencido há ${Math.ceil(elapsed / 60)}h`,
      tone: "critical",
      overdue: true,
    };
  }
  if (differenceMinutes <= 60) {
    return { label: `vence em ${Math.max(1, differenceMinutes)}min`, tone: "attention", overdue: false };
  }
  if (differenceMinutes <= 24 * 60) {
    return { label: `vence em ${Math.ceil(differenceMinutes / 60)}h`, tone: "attention", overdue: false };
  }
  return { label: `vence em ${Math.ceil(differenceMinutes / 1440)}d`, tone: "stable", overdue: false };
}

export function metricContractReadiness(metric: {
  target?: string | null;
  description?: string | null;
  rationale?: string | null;
}): { label: string; tone: OperationalTone; missing: string[] } {
  const missing: string[] = [];
  if (!metric.target?.trim() || metric.target.trim() === "—") missing.push("meta");
  if (!metric.description?.trim()) missing.push("definição");
  if (!metric.rationale?.trim()) missing.push("racional");

  if (missing.length === 0) return { label: "Contrato pronto", tone: "stable", missing };
  if (missing.length === 1) return { label: "Revisar contrato", tone: "attention", missing };
  return { label: "Contrato incompleto", tone: "critical", missing };
}

export function classifyScenarioSource(text: string): "synthetic" | "unclassified" {
  return /sint[eé]tic|demo|seed|valida[cç][aã]o/i.test(text) ? "synthetic" : "unclassified";
}
