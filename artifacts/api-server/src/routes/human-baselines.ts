import { Router, type IRouter } from "express";
import { SaveAgentHumanBaselineBody, UpsertHumanBaselineBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import { agentInOrg } from "../lib/agent-contracts";
import { humanBaselineProblems } from "../lib/human-baseline-input";
import {
  deleteHumanBaseline,
  getAgentHumanBaselineContext,
  listHumanBaselines,
  saveAgentHumanBaseline,
  toHumanBaseline,
  upsertHumanBaseline,
} from "../lib/human-baselines";

/**
 * Endpoints de baseline humano configurável por tipo de tarefa (MUS-195).
 * Todo acesso é escopado por organização (`requireOrg` + `agentInOrg` / `inOrg`).
 */

const router: IRouter = Router();

router.get("/human-baselines", requireAuth, requireOrg, async (req, res) => {
  const rows = await listHumanBaselines(req.orgId!);
  res.json({ baselines: rows.map(toHumanBaseline) });
});

router.put("/human-baselines", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const parsed = UpsertHumanBaselineBody.safeParse(req.body ?? {});
  const problems = parsed.success ? humanBaselineProblems(parsed.data) : ["Corpo inválido."];
  if (!parsed.success || problems.length > 0) {
    res.status(400).json({ error: problems.join(" "), problems });
    return;
  }
  const body = parsed.data;
  if (body.agentId && !(await agentInOrg(orgId, body.agentId))) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const row = await upsertHumanBaseline({
    orgId,
    userId: req.userId!,
    taskType: body.taskType,
    agentId: body.agentId ?? null,
    humanMinutesPerTask: body.humanMinutesPerTask,
    humanAccuracyRate: body.humanAccuracyRate,
    humanEscalationRate: body.humanEscalationRate,
    measurementKind: body.measurementKind,
    measuredAt: body.measuredAt ?? null,
    notes: body.notes ?? null,
  });
  if (!row) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(toHumanBaseline(row));
});

router.delete("/human-baselines/:baselineId", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const ok = await deleteHumanBaseline(req.orgId!, req.params.baselineId as string);
  if (!ok) {
    res.status(404).json({ error: "Baseline not found" });
    return;
  }
  res.status(204).end();
});

router.get("/agents/:agentId/human-baseline", requireAuth, requireOrg, async (req, res) => {
  const context = await getAgentHumanBaselineContext(req.orgId!, req.params.agentId as string);
  if (!context) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(context);
});

router.put("/agents/:agentId/human-baseline", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const agentId = req.params.agentId as string;
  if (!(await agentInOrg(orgId, agentId))) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const parsed = SaveAgentHumanBaselineBody.safeParse(req.body ?? {});
  const problems = parsed.success ? humanBaselineProblems(parsed.data) : ["Corpo inválido."];
  if (!parsed.success || problems.length > 0) {
    res.status(400).json({ error: problems.join(" "), problems });
    return;
  }
  const body = parsed.data;
  const updated = await saveAgentHumanBaseline({
    orgId,
    agentId,
    userId: req.userId!,
    taskType: body.taskType,
    humanMinutesPerTask: body.humanMinutesPerTask,
    humanAccuracyRate: body.humanAccuracyRate,
    humanEscalationRate: body.humanEscalationRate,
    scope: body.scope ?? "task_type",
    notes: body.notes ?? null,
  });
  if (!updated) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(updated);
});

export default router;
