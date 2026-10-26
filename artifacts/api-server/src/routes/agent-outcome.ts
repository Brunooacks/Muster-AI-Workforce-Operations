import { Router, type IRouter } from "express";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import {
  db,
  agentApiKeys,
  agentOwners,
  agents,
  environments,
  eventOutbox,
  organizationMembers,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import { inOrg } from "../lib/tenant-scope";
import { activeContract, toAgentContract } from "../lib/agent-contracts";
import { computeOutcome } from "../lib/outcome-layers";
import { loadOutcomeInputs, periodFromMonth } from "../lib/outcome-loader";
import { buildProofLayer } from "../lib/outcome-proof";
import { closeOutcomePeriod, latestSnapshot, reproduceSnapshot } from "../lib/outcome-snapshots";
import { TASK_TRAIL_EVENT_TYPE } from "../lib/task-outcome";

/**
 * Página do agente nas três camadas (cunha · C12.1). Mês fechado com snapshot
 * é lido do snapshot (prova); mês aberto é calculado na hora. Todo número
 * vem com `status` e, quando indisponível, o motivo.
 */

const router: IRouter = Router();

const currentMonth = () => new Date().toISOString().slice(0, 7);
const dayAfter = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000);

router.get("/agents/:agentId/outcome", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId!;
  const agentId = req.params.agentId as string;
  const month = typeof req.query.period === "string" && req.query.period ? req.query.period : currentMonth();
  const period = periodFromMonth(month);
  if (!period) {
    res.status(400).json({ error: "period deve ser YYYY-MM." });
    return;
  }
  const [agent] = await db
    .select({ id: agents.id, projectId: agents.projectId })
    .from(agents)
    .where(inOrg(agents, orgId, eq(agents.id, agentId)))
    .limit(1);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const snapshot = month < currentMonth() ? await latestSnapshot(orgId, agentId, month) : null;
  let result;
  if (snapshot) result = reproduceSnapshot(snapshot);
  else {
    const loaded = await loadOutcomeInputs({ orgId, agentId, period });
    if (!loaded) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    result = computeOutcome(loaded.inputs);
  }

  const contract = await activeContract(orgId, agentId);
  const [owners] = await db
    .select({
      businessOwner: agentOwners.businessOwner,
      technicalOwner: agentOwners.technicalOwner,
      governanceSponsor: agentOwners.governanceSponsor,
    })
    .from(agentOwners)
    .where(eq(agentOwners.agentId, agent.id))
    .limit(1);
  const [contractOwner] = contract
    ? await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(inOrg(organizationMembers, orgId, eq(organizationMembers.id, contract.ownerMemberId)))
        .limit(1)
    : [];
  const keys = await db
    .select({ environmentKind: environments.kind })
    .from(agentApiKeys)
    .innerJoin(environments, eq(environments.id, agentApiKeys.environmentId))
    .where(
      and(
        inOrg(agentApiKeys, orgId, eq(agentApiKeys.agentId, agentId), isNull(agentApiKeys.revokedAt)),
        eq(agentApiKeys.projectId, agent.projectId),
      ),
    );
  const trail = await db
    .select({ payload: eventOutbox.payload })
    .from(eventOutbox)
    .where(
      inOrg(
        eventOutbox,
        orgId,
        eq(eventOutbox.projectId, agent.projectId),
        eq(eventOutbox.aggregateId, agentId),
        eq(eventOutbox.eventType, TASK_TRAIL_EVENT_TYPE),
        gte(eventOutbox.createdAt, new Date(`${period.start}T00:00:00Z`)),
        lt(eventOutbox.createdAt, dayAfter(period.end)),
      ),
    );

  const layer3 = buildProofLayer({
    result,
    owners: owners ?? null,
    contract: contract
      ? { id: contract.id, version: contract.version, ownerMemberId: contract.ownerMemberId, ownerIsMember: Boolean(contractOwner) }
      : null,
    activeKeys: keys,
    trail: trail.map((t) => ({
      record: String(t.payload.record ?? ""),
      acceptedByKind: (t.payload.acceptedByKind as string | null) ?? null,
      acceptedRuleVersion: (t.payload.acceptedRuleVersion as string | null) ?? null,
    })),
    snapshot: snapshot ? { id: snapshot.id, inputsHash: snapshot.inputsHash, createdAt: snapshot.createdAt.toISOString() } : null,
  });

  res.json({
    agentId,
    period: month,
    source: snapshot ? "snapshot" : "live",
    calcVersion: result.calcVersion,
    coverage: result.coverage,
    layer1: result.layer1,
    layer2: result.layer2,
    layer3,
    signals: result.signals,
    contract: contract ? toAgentContract(contract) : null,
    verdict: { status: "coming_soon" },
  });
});

router.post("/agents/:agentId/outcome/close", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const agentId = req.params.agentId as string;
  const month = typeof req.query.period === "string" ? req.query.period : "";
  if (!periodFromMonth(month) || month >= currentMonth()) {
    res.status(400).json({ error: "period deve ser um mês já encerrado (YYYY-MM)." });
    return;
  }
  const closed = await closeOutcomePeriod({ orgId, agentId, month });
  if (!closed) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.status(closed.created ? 201 : 200).json({
    id: closed.snapshot.id,
    agentId,
    period: closed.snapshot.period,
    calcVersion: closed.snapshot.calcVersion,
    inputsHash: closed.snapshot.inputsHash,
    created: closed.created,
  });
});

export default router;
