import type { LayerKey, VerdictType } from "@workspace/db";
import { metricTargetStatus } from "@workspace/metrics";

export const KPI_DOMAINS = [
  "atendimento",
  "vendas-crm",
  "engenharia-it",
  "risco-financas-rh",
] as const;
export type KpiDomain = (typeof KPI_DOMAINS)[number];

export const KPI_DIRECTIONS = [
  "higher-is-better",
  "lower-is-better",
  "target-range",
  "informational",
] as const;
export type KpiMetricDirection = (typeof KPI_DIRECTIONS)[number];

export const KPI_CADENCES = ["per-run", "daily", "weekly", "monthly", "quarterly"] as const;
export type KpiCadence = (typeof KPI_CADENCES)[number];

export const KPI_BASELINE_POLICIES = ["required", "optional", "not-applicable"] as const;
export type KpiBaselinePolicy = (typeof KPI_BASELINE_POLICIES)[number];

export const KPI_EVIDENCE_TYPES = ["observed", "inferred", "synthetic"] as const;
export type KpiEvidenceType = (typeof KPI_EVIDENCE_TYPES)[number];

export interface KpiEvidencePolicy {
  allowed: KpiEvidenceType[];
  minConfidence: number;
  auditSampleRate: number;
}

export interface KpiContract {
  key: string;
  domain: KpiDomain;
  area: string;
  layer: LayerKey;
  label: string;
  purpose: string;
  unit: string;
  direction: KpiMetricDirection;
  formula: string;
  sourceSignals: string[];
  cadence: KpiCadence;
  baseline: KpiBaselinePolicy;
  target?: string;
  owner: string;
  decisionImpact: VerdictType;
  guardrail: boolean;
  minSampleSize: number;
  evidence: KpiEvidencePolicy;
  rationale: string;
}

export interface KpiContractIssue {
  path: string;
  message: string;
}

export interface KpiContractValidation {
  success: boolean;
  issues: KpiContractIssue[];
  value?: KpiContract;
}

export interface KpiObservation {
  value: number;
  sampleSize: number;
  baselineAvailable: boolean;
  evidenceType: KpiEvidenceType;
  confidence: number;
}

export type KpiEvaluationStatus =
  | "on-target"
  | "off-target"
  | "not-comparable"
  | "insufficient-evidence";

export interface KpiEvaluation {
  status: KpiEvaluationStatus;
  targetStatus: "on" | "off" | null;
  eligibleForDecision: boolean;
  reasons: string[];
}

const LAYER_KEYS: LayerKey[] = [
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
];
const VERDICTS: VerdictType[] = ["promote", "mentor", "retire", "observation"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function validateKpiContract(input: unknown): KpiContractValidation {
  const issues: KpiContractIssue[] = [];
  if (!isRecord(input)) {
    return { success: false, issues: [{ path: "", message: "Contrato deve ser um objeto." }] };
  }

  const requireText = (field: string) => {
    if (typeof input[field] !== "string" || input[field].trim().length === 0) {
      issues.push({ path: field, message: "Campo obrigatório deve ser texto não vazio." });
    }
  };

  requireText("key");
  if (typeof input.key === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.key)) {
    issues.push({ path: "key", message: "Use uma chave kebab-case, por exemplo: taxa-resolucao." });
  }
  for (const field of ["area", "label", "purpose", "unit", "formula", "owner", "rationale"]) requireText(field);
  if (!isOneOf(input.domain, KPI_DOMAINS)) issues.push({ path: "domain", message: "Domínio de KPI inválido." });
  if (!isOneOf(input.layer, LAYER_KEYS)) issues.push({ path: "layer", message: "Camada de avaliação inválida." });
  if (!isOneOf(input.direction, KPI_DIRECTIONS)) issues.push({ path: "direction", message: "Direção de KPI inválida." });
  if (!isOneOf(input.cadence, KPI_CADENCES)) issues.push({ path: "cadence", message: "Cadência de KPI inválida." });
  if (!isOneOf(input.baseline, KPI_BASELINE_POLICIES)) issues.push({ path: "baseline", message: "Política de baseline inválida." });
  if (!isOneOf(input.decisionImpact, VERDICTS)) issues.push({ path: "decisionImpact", message: "Impacto de decisão inválido." });
  if (!isStringArray(input.sourceSignals)) issues.push({ path: "sourceSignals", message: "Informe ao menos um sinal de origem." });
  if (typeof input.guardrail !== "boolean") issues.push({ path: "guardrail", message: "Guardrail deve ser booleano." });
  if (!Number.isInteger(input.minSampleSize) || Number(input.minSampleSize) < 1) {
    issues.push({ path: "minSampleSize", message: "A amostra mínima deve ser um inteiro positivo." });
  }
  if (input.target !== undefined && (typeof input.target !== "string" || input.target.trim().length === 0)) {
    issues.push({ path: "target", message: "Target, quando informado, deve ser texto não vazio." });
  }

  if (!isRecord(input.evidence)) {
    issues.push({ path: "evidence", message: "Política de evidência é obrigatória." });
  } else {
    if (!isStringArray(input.evidence.allowed) || !input.evidence.allowed.every((item) => isOneOf(item, KPI_EVIDENCE_TYPES))) {
      issues.push({ path: "evidence.allowed", message: "Informe tipos de evidência válidos." });
    }
    for (const field of ["minConfidence", "auditSampleRate"]) {
      const value = input.evidence[field];
      if (typeof value !== "number" || value < 0 || value > 100) {
        issues.push({ path: `evidence.${field}`, message: "Valor deve estar entre 0 e 100." });
      }
    }
  }

  if (issues.length > 0) return { success: false, issues };
  return { success: true, issues, value: input as unknown as KpiContract };
}

export class KpiContractValidationError extends Error {
  constructor(public readonly issues: KpiContractIssue[]) {
    super(`Contrato de KPI inválido: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
    this.name = "KpiContractValidationError";
  }
}

export function parseKpiContract(input: unknown): KpiContract {
  const result = validateKpiContract(input);
  if (!result.success || !result.value) throw new KpiContractValidationError(result.issues);
  return result.value;
}

export function evaluateKpi(contract: KpiContract, observation: KpiObservation): KpiEvaluation {
  const reasons: string[] = [];
  if (observation.sampleSize < contract.minSampleSize) reasons.push("amostra abaixo do mínimo do contrato");
  if (contract.baseline === "required" && !observation.baselineAvailable) reasons.push("baseline obrigatório ausente");
  if (!contract.evidence.allowed.includes(observation.evidenceType)) reasons.push("tipo de evidência não permitido");
  if (observation.confidence < contract.evidence.minConfidence) reasons.push("confiança abaixo do mínimo do contrato");
  if (reasons.length > 0) return { status: "insufficient-evidence", targetStatus: null, eligibleForDecision: false, reasons };

  const targetStatus = contract.direction === "informational" ? null : metricTargetStatus(observation.value, contract.target);
  if (targetStatus === null) {
    return { status: "not-comparable", targetStatus: null, eligibleForDecision: true, reasons: ["KPI sem target comparável"] };
  }
  return {
    status: targetStatus === "on" ? "on-target" : "off-target",
    targetStatus,
    eligibleForDecision: true,
    reasons: [],
  };
}

