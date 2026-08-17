import { describe, expect, it } from "vitest";
import { METRIC_CATALOG } from "./metric-catalog";
import { KPI_DOMAIN_CATALOG, KPI_DOMAIN_VERTICALS } from "./kpi-domain-catalog";
import {
  evaluateKpi,
  parseKpiContract,
  validateKpiContract,
  type KpiContract,
} from "./kpi-contract";
import { buildProposedMetrics } from "./discovery";

const sampleContract: KpiContract = KPI_DOMAIN_CATALOG[0]!;

describe("KPI contract", () => {
  it("validates the domain catalog entries", () => {
    expect(KPI_DOMAIN_CATALOG).toHaveLength(20);
    for (const contract of KPI_DOMAIN_CATALOG) {
      expect(validateKpiContract(contract)).toMatchObject({ success: true, issues: [] });
      expect(parseKpiContract(contract)).toEqual(contract);
    }
  });

  it("rejects malformed contracts with actionable paths", () => {
    const result = validateKpiContract({ key: "Taxa inválida", domain: "unknown" });
    expect(result.success).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["key", "domain", "label", "evidence"]),
    );
  });

  it("blocks a decision when evidence is not mature enough", () => {
    const evaluation = evaluateKpi(sampleContract, {
      value: 80,
      sampleSize: 2,
      baselineAvailable: false,
      evidenceType: "synthetic",
      confidence: 99,
    });
    expect(evaluation.status).toBe("insufficient-evidence");
    expect(evaluation.eligibleForDecision).toBe(false);
    expect(evaluation.reasons).toEqual(
      expect.arrayContaining([
        "amostra abaixo do mínimo do contrato",
        "baseline obrigatório ausente",
        "tipo de evidência não permitido",
      ]),
    );
  });

  it("evaluates an observed result against the contract target", () => {
    const evaluation = evaluateKpi(sampleContract, {
      value: 82,
      sampleSize: 40,
      baselineAvailable: true,
      evidenceType: "observed",
      confidence: 90,
    });
    expect(evaluation).toMatchObject({
      status: "on-target",
      targetStatus: "on",
      eligibleForDecision: true,
    });
  });
});

describe("domain KPI catalog", () => {
  it("exposes the four first-slice domains and seeds the legacy catalog", () => {
    expect(KPI_DOMAIN_VERTICALS.map((vertical) => vertical.key)).toEqual([
      "atendimento",
      "vendas-crm",
      "engenharia-it",
      "risco-financas-rh",
    ]);
    for (const vertical of KPI_DOMAIN_VERTICALS) {
      expect(vertical.metrics.length).toBeGreaterThanOrEqual(5);
      expect(METRIC_CATALOG.some((catalogVertical) => catalogVertical.key === vertical.key)).toBe(true);
    }
  });

  it("makes new domain signals available to discovery", () => {
    const metrics = buildProposedMetrics("domain-agent", [
      "speed_to_lead",
      "escaped_defect_rate",
      "exposicao_dado_sensivel",
      "employee_experience",
    ]);
    expect(metrics.map((metric) => metric.sourceSignal)).toEqual([
      "speed_to_lead",
      "escaped_defect_rate",
      "exposicao_dado_sensivel",
      "employee_experience",
    ]);
  });
});

