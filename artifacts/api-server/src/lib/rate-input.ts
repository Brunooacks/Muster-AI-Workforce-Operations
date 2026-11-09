import type { OffInvoiceAllocation, OffInvoiceCategory, RateCurrency } from "@workspace/db/schema";

/**
 * Regras sem banco de custo-hora e custos fora da fatura (cunha · C3.1/C3.2).
 * Sem default em lugar nenhum (R4): sem linha vigente o custo-hora é `null` e
 * o chamador mostra "indisponível".
 */

export interface RoleRateInput {
  areaId?: string | null;
  role: string;
  hourlyCostCents: number;
  currency: RateCurrency;
  validFrom: string;
  validTo?: string | null;
}

export interface OffInvoiceInput {
  projectId?: string | null;
  agentId?: string | null;
  category: OffInvoiceCategory;
  amountCents: number;
  currency: RateCurrency;
  periodStart: string;
  periodEnd: string;
  allocation: OffInvoiceAllocation;
  description?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const data = (s: unknown): s is string => typeof s === "string" && ISO_DATE.test(s) && !Number.isNaN(Date.parse(s));
const centavos = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

export function roleRateProblems(input: Partial<RoleRateInput>): string[] {
  const p: string[] = [];
  if (!input.role?.trim()) p.push("role é obrigatório.");
  if (!centavos(input.hourlyCostCents)) p.push("hourlyCostCents precisa ser inteiro ≥ 0.");
  if (input.currency !== "BRL" && input.currency !== "USD") p.push("currency deve ser BRL ou USD.");
  if (!data(input.validFrom)) p.push("validFrom deve ser YYYY-MM-DD.");
  if (input.validTo != null && (!data(input.validTo) || (data(input.validFrom) && input.validTo < input.validFrom))) {
    p.push("validTo deve ser YYYY-MM-DD e não anterior a validFrom.");
  }
  return p;
}

export function offInvoiceProblems(input: Partial<OffInvoiceInput>): string[] {
  const p: string[] = [];
  if (!["license", "infra", "integration", "other"].includes(input.category as string)) {
    p.push("category deve ser license, infra, integration ou other.");
  }
  if (!centavos(input.amountCents)) p.push("amountCents precisa ser inteiro ≥ 0.");
  if (input.currency !== "BRL" && input.currency !== "USD") p.push("currency deve ser BRL ou USD.");
  if (!data(input.periodStart) || !data(input.periodEnd) || input.periodEnd! < input.periodStart!) {
    p.push("periodStart/periodEnd devem ser YYYY-MM-DD com fim ≥ início.");
  }
  if (input.allocation === "agent" && !input.agentId) p.push("allocation agent exige agentId.");
  else if (input.allocation === "project" && !input.projectId) p.push("allocation project exige projectId.");
  else if (!["agent", "project", "per_task"].includes(input.allocation as string)) {
    p.push("allocation deve ser agent, project ou per_task.");
  }
  return p;
}

/** Duas vigências [a, b] e [c, d] (fim nulo = aberto) se cruzam? */
export function periodsOverlap(aFrom: string, aTo: string | null, bFrom: string, bTo: string | null): boolean {
  return (aTo === null || bFrom <= aTo) && (bTo === null || aFrom <= bTo);
}

export interface RateRow {
  areaId: string | null;
  role: string;
  hourlyCostCents: number;
  currency: RateCurrency;
  validFrom: string;
  validTo: string | null;
}

/**
 * Custo-hora vigente em `day` para o papel: a linha da área vence a da conta.
 * Sem linha vigente → `null` (nunca um default).
 */
export function resolveHourlyRate<T extends RateRow>(
  rates: readonly T[],
  input: { role: string; areaId?: string | null; day: string },
): T | null {
  const vigentes = rates.filter(
    (r) => r.role === input.role && r.validFrom <= input.day && (r.validTo === null || input.day <= r.validTo),
  );
  const daArea = input.areaId ? vigentes.filter((r) => r.areaId === input.areaId) : [];
  const daConta = vigentes.filter((r) => r.areaId === null);
  const candidatas = daArea.length > 0 ? daArea : daConta;
  return [...candidatas].sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
}
