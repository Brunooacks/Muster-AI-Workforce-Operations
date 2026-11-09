import { Router, type IRouter } from "express";
import { CreateAgentContractBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import {
  agentInOrg,
  contractInputProblems,
  ContractOwnerError,
  createContractVersion,
  listContracts,
  ownerCandidates,
  toAgentContract,
} from "../lib/agent-contracts";

/**
 * Contrato numérico versionado (cunha · C2.2). POST sempre cria versão nova;
 * não existe PUT/PATCH/DELETE de contrato. Agente de outra conta é 404.
 */

const router: IRouter = Router();

router.get("/agents/:agentId/contracts", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId!;
  const agentId = req.params.agentId as string;
  if (!(await agentInOrg(orgId, agentId))) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const versions = (await listContracts(orgId, agentId)).map(toAgentContract);
  res.json({
    agentId,
    active: versions.find((v) => v.status === "active") ?? null,
    versions,
    ownerCandidates: await ownerCandidates(orgId),
  });
});

router.post("/agents/:agentId/contracts", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const agentId = req.params.agentId as string;
  const parsed = CreateAgentContractBody.safeParse(req.body ?? {});
  const today = new Date().toISOString().slice(0, 10);
  const problems = parsed.success
    ? contractInputProblems(parsed.data, today)
    : ["Corpo inválido: metricKey, unit, direction, baseline, target, deadline e ownerMemberId são obrigatórios."];
  if (!parsed.success || problems.length > 0) {
    res.status(400).json({ error: problems.join(" "), problems });
    return;
  }
  try {
    const row = await createContractVersion({ orgId, agentId, createdBy: req.userId!, body: parsed.data });
    if (!row) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.status(201).json(toAgentContract(row));
  } catch (error) {
    if (error instanceof ContractOwnerError) {
      res.status(400).json({ error: error.message, problems: [error.message] });
      return;
    }
    throw error;
  }
});

export default router;
