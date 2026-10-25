import { parseDecimal } from "./agent-contract-form";

/**
 * Formulários de custo-hora e custos fora da fatura (cunha · C3.2). O usuário
 * digita em reais/dólares; a API recebe centavos inteiros. Sem valor padrão:
 * campo vazio é erro, nunca zero.
 */

/** "90,50" → 9050; vazio/texto/negativo → null. */
export function toCents(raw: string): number | null {
  const n = parseDecimal(raw);
  if (n === null || Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatCents(cents: number, currency: "BRL" | "USD"): string {
  return (cents / 100).toLocaleString(currency === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency });
}

export interface RoleRateForm {
  role: string;
  areaId: string;
  hourly: string;
  currency: "BRL" | "USD";
  validFrom: string;
  validTo: string;
}

export function roleRateBody(form: RoleRateForm) {
  const hourlyCostCents = toCents(form.hourly);
  const errors: string[] = [];
  if (!form.role.trim()) errors.push("Informe o papel.");
  if (hourlyCostCents === null) errors.push("Custo-hora precisa ser um número ≥ 0.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.validFrom)) errors.push("Informe o início da vigência.");
  if (form.validTo && form.validTo < form.validFrom) errors.push("Fim da vigência antes do início.");
  if (errors.length > 0) return { errors, body: null };
  return {
    errors,
    body: {
      role: form.role.trim(),
      areaId: form.areaId || null,
      hourlyCostCents: hourlyCostCents!,
      currency: form.currency,
      validFrom: form.validFrom,
      validTo: form.validTo || null,
    },
  };
}
