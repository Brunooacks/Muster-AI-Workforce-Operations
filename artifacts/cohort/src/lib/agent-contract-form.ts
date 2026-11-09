/**
 * Formulário do contrato numérico (cunha · C2.2). Texto do usuário → corpo do
 * POST /agents/:id/contracts. Números aceitam vírgula decimal; nada é
 * convertido do business case antigo (que fica só como referência).
 */

export interface ContractFormState {
  metricKey: string;
  unit: string;
  direction: "up" | "down";
  baseline: string;
  target: string;
  limit: string;
  deadline: string;
  ownerMemberId: string;
  referenceHumanMinutes: string;
  requireHumanAccept: boolean;
  referenceModel: string;
}

export interface ContractBody {
  metricKey: string;
  unit: string;
  direction: "up" | "down";
  baseline: number;
  target: number;
  limit: number | null;
  deadline: string;
  ownerMemberId: string;
  referenceHumanMinutes: number | null;
  requireHumanAccept: boolean;
  referenceModel: string | null;
}

export const EMPTY_CONTRACT_FORM: ContractFormState = {
  metricKey: "",
  unit: "",
  direction: "down",
  baseline: "",
  target: "",
  limit: "",
  deadline: "",
  ownerMemberId: "",
  referenceHumanMinutes: "",
  requireHumanAccept: false,
  referenceModel: "",
};

/** "12,5" → 12.5; vazio → null; texto → NaN. */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export type ContractFormField = keyof ContractFormState;

export function contractFormErrors(form: ContractFormState, today: string): Partial<Record<ContractFormField, string>> {
  const errors: Partial<Record<ContractFormField, string>> = {};
  if (!form.metricKey.trim()) errors.metricKey = "obrigatório";
  if (!form.unit.trim()) errors.unit = "obrigatório";
  const baseline = parseDecimal(form.baseline);
  const target = parseDecimal(form.target);
  if (baseline === null || Number.isNaN(baseline)) errors.baseline = "número";
  if (target === null || Number.isNaN(target)) errors.target = "número";
  const limit = parseDecimal(form.limit);
  if (limit !== null && Number.isNaN(limit)) errors.limit = "número";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.deadline)) errors.deadline = "data";
  else if (form.deadline <= today) errors.deadline = "futura";
  if (!form.ownerMemberId) errors.ownerMemberId = "obrigatório";
  const minutes = parseDecimal(form.referenceHumanMinutes);
  if (minutes !== null && (Number.isNaN(minutes) || minutes < 0)) errors.referenceHumanMinutes = "≥ 0";
  return errors;
}

export function contractBodyFromForm(form: ContractFormState): ContractBody {
  return {
    metricKey: form.metricKey.trim(),
    unit: form.unit.trim(),
    direction: form.direction,
    baseline: parseDecimal(form.baseline) ?? Number.NaN,
    target: parseDecimal(form.target) ?? Number.NaN,
    limit: parseDecimal(form.limit),
    deadline: form.deadline,
    ownerMemberId: form.ownerMemberId,
    referenceHumanMinutes: parseDecimal(form.referenceHumanMinutes),
    requireHumanAccept: form.requireHumanAccept,
    referenceModel: form.referenceModel.trim() || null,
  };
}

/** Nova versão parte da vigente (o usuário altera só o que muda). */
export function formFromContract(c: Omit<ContractBody, "limit" | "referenceHumanMinutes" | "referenceModel"> & {
  limit?: number | null;
  referenceHumanMinutes?: number | null;
  referenceModel?: string | null;
}): ContractFormState {
  const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    metricKey: c.metricKey,
    unit: c.unit,
    direction: c.direction,
    baseline: n(c.baseline),
    target: n(c.target),
    limit: n(c.limit),
    deadline: "",
    ownerMemberId: c.ownerMemberId,
    referenceHumanMinutes: n(c.referenceHumanMinutes),
    requireHumanAccept: c.requireHumanAccept,
    referenceModel: c.referenceModel ?? "",
  };
}
