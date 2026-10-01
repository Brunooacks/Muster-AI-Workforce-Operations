import { Router, type IRouter } from "express";
import {
  GetKpiTaxonomyResponse,
  ListKpiContractsByDomainResponse,
  ListKpiContractsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { KPI_DOMAIN_VERTICALS, KPI_DOMAIN_CATALOG } from "../lib/kpi-domain-catalog";
import {
  KPI_ADOPTION_RULES,
  KPI_CAPABILITIES,
  KPI_CAPABILITY_LABELS,
  KPI_DOMAINS,
  type KpiContract,
} from "../lib/kpi-contract";

const router: IRouter = Router();

router.get("/performance/kpi-contracts", requireAuth, requireOrg, (_req, res) => {
  res.json(ListKpiContractsResponse.parse({
    domains: KPI_DOMAIN_VERTICALS.map(({ metrics: _metrics, ...domain }) => domain),
    contracts: KPI_DOMAIN_CATALOG,
    total: KPI_DOMAIN_CATALOG.length,
  }));
});

router.get("/performance/kpi-contracts/:domain", requireAuth, requireOrg, (req, res) => {
  const domain = req.params.domain as (typeof KPI_DOMAINS)[number];
  if (!KPI_DOMAINS.includes(domain)) {
    res.status(404).json({ error: "Domínio de KPI não encontrado" });
    return;
  }
  res.json(ListKpiContractsByDomainResponse.parse({
    domain,
    contracts: KPI_DOMAIN_CATALOG.filter((contract: KpiContract) => contract.domain === domain),
  }));
});

router.get("/performance/kpi-taxonomy", requireAuth, requireOrg, (_req, res) => {
  res.json(GetKpiTaxonomyResponse.parse({
    capabilities: KPI_CAPABILITIES.map((key) => ({ key, label: KPI_CAPABILITY_LABELS[key] })),
    adoptionRules: KPI_ADOPTION_RULES,
  }));
});

export default router;
