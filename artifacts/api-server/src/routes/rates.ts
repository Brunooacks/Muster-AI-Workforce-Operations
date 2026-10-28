import { Router, type IRouter } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, agents, areas, eventOutbox, offInvoiceCosts, projects, roleRates } from "@workspace/db";
import { CreateOffInvoiceCostBody, CreateRoleRateBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import { inOrg } from "../lib/tenant-scope";
import { offInvoiceProblems, periodsOverlap, roleRateProblems } from "../lib/rate-input";

/**
 * Custo-hora por área/papel e custos fora da fatura (cunha · C3.2). Tudo só
 * para admin, leitura inclusive: custo de pessoas é dado sensível. Nada aqui
 * vai para log — o audit de mutação grava só o padrão da rota. A trilha das
 * alterações vai ao outbox (`account.rates.changed`), já `completed`.
 */

const router: IRouter = Router();

export const RATES_TRAIL_EVENT_TYPE = "account.rates.changed";

type RoleRateRow = typeof roleRates.$inferSelect;
type OffInvoiceRow = typeof offInvoiceCosts.$inferSelect;

function toRoleRate(r: RoleRateRow) {
  return {
    id: r.id,
    areaId: r.areaId ?? null,
    role: r.role,
    hourlyCostCents: r.hourlyCostCents,
    currency: r.currency,
    validFrom: r.validFrom,
    validTo: r.validTo ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

function toOffInvoice(r: OffInvoiceRow) {
  return {
    id: r.id,
    projectId: r.projectId ?? null,
    agentId: r.agentId ?? null,
    category: r.category,
    amountCents: r.amountCents,
    currency: r.currency,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    allocation: r.allocation,
    description: r.description ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

const badRequest = (problems: string[]) => ({ error: problems.join(" "), problems });

router.get("/rates/roles", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const rows = await db
    .select()
    .from(roleRates)
    .where(inOrg(roleRates, req.orgId!))
    .orderBy(asc(roleRates.role), asc(roleRates.validFrom));
  res.json(rows.map(toRoleRate));
});

router.post("/rates/roles", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const parsed = CreateRoleRateBody.safeParse(req.body ?? {});
  const problems = parsed.success ? roleRateProblems(parsed.data) : ["Corpo inválido."];
  if (!parsed.success || problems.length > 0) {
    res.status(400).json(badRequest(problems));
    return;
  }
  const body = parsed.data;
  const areaId = body.areaId ?? null;
  if (areaId) {
    const [area] = await db.select({ id: areas.id }).from(areas).where(inOrg(areas, orgId, eq(areas.id, areaId))).limit(1);
    if (!area) {
      res.status(400).json(badRequest(["areaId não pertence à conta."]));
      return;
    }
  }
  const row = await db.transaction(async (tx) => {
    const mesmas = await tx
      .select()
      .from(roleRates)
      .where(
        inOrg(
          roleRates,
          orgId,
          eq(roleRates.role, body.role.trim()),
          areaId ? eq(roleRates.areaId, areaId) : isNull(roleRates.areaId),
        ),
      )
      .for("update");
    if (mesmas.some((r) => periodsOverlap(r.validFrom, r.validTo, body.validFrom, body.validTo ?? null))) return null;
    const [created] = await tx
      .insert(roleRates)
      .values({
        orgId,
        areaId,
        role: body.role.trim(),
        hourlyCostCents: body.hourlyCostCents,
        currency: body.currency,
        validFrom: body.validFrom,
        validTo: body.validTo ?? null,
        createdBy: req.userId!,
      })
      .returning();
    await tx.insert(eventOutbox).values({
      orgId,
      aggregateType: "organization",
      aggregateId: orgId,
      eventType: RATES_TRAIL_EVENT_TYPE,
      payload: { record: "role_rate", id: created!.id, role: created!.role, areaId, validFrom: created!.validFrom, validTo: created!.validTo, createdBy: req.userId! },
      status: "completed",
      processedAt: new Date(),
    });
    return created!;
  });
  if (!row) {
    res.status(409).json({ error: "Já existe custo-hora vigente para este papel/área no período." });
    return;
  }
  res.status(201).json(toRoleRate(row));
});

router.get("/rates/off-invoice", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const rows = await db
    .select()
    .from(offInvoiceCosts)
    .where(inOrg(offInvoiceCosts, req.orgId!))
    .orderBy(asc(offInvoiceCosts.periodStart));
  res.json(rows.map(toOffInvoice));
});

router.post("/rates/off-invoice", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const parsed = CreateOffInvoiceCostBody.safeParse(req.body ?? {});
  const problems = parsed.success ? offInvoiceProblems(parsed.data) : ["Corpo inválido."];
  if (!parsed.success || problems.length > 0) {
    res.status(400).json(badRequest(problems));
    return;
  }
  const body = parsed.data;
  let projectId = body.projectId ?? null;
  if (body.agentId) {
    const [agent] = await db
      .select({ projectId: agents.projectId })
      .from(agents)
      .where(inOrg(agents, orgId, eq(agents.id, body.agentId)))
      .limit(1);
    if (!agent || (projectId && projectId !== agent.projectId)) {
      res.status(400).json(badRequest(["agentId não pertence à conta (ou ao projeto informado)."]));
      return;
    }
    projectId = agent.projectId;
  } else if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(inOrg(projects, orgId), eq(projects.id, projectId)))
      .limit(1);
    if (!project) {
      res.status(400).json(badRequest(["projectId não pertence à conta."]));
      return;
    }
  }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(offInvoiceCosts)
      .values({
        orgId,
        projectId,
        agentId: body.agentId ?? null,
        category: body.category,
        amountCents: body.amountCents,
        currency: body.currency,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        allocation: body.allocation,
        description: body.description?.trim() || null,
        createdBy: req.userId!,
      })
      .returning();
    await tx.insert(eventOutbox).values({
      orgId,
      projectId,
      aggregateType: "organization",
      aggregateId: orgId,
      eventType: RATES_TRAIL_EVENT_TYPE,
      payload: {
        record: "off_invoice_cost",
        id: created!.id,
        category: created!.category,
        allocation: created!.allocation,
        agentId: created!.agentId,
        projectId,
        periodStart: created!.periodStart,
        periodEnd: created!.periodEnd,
        createdBy: req.userId!,
      },
      status: "completed",
      processedAt: new Date(),
    });
    return created!;
  });
  res.status(201).json(toOffInvoice(row));
});

export default router;
