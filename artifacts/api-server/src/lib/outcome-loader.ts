import { and, asc, eq, gte, isNotNull, lt, lte, or, isNull, gt, sql } from "drizzle-orm";
import {
  db,
  agentContracts,
  agentEvents,
  agents,
  environments,
  offInvoiceCosts,
  roleRates,
} from "@workspace/db";
import { inOrg } from "./tenant-scope";
import { resolveHourlyRate } from "./rate-input";
import {
  CALC_VERSION,
  allocateOffInvoice,
  normalizeTasks,
  type OutcomeContract,
  type OutcomeEventRow,
  type OutcomeInputs,
  type PriceTable,
} from "./outcome-layers";
import type { ExchangeRate } from "./value/cost-per-validated-task";

/**
 * Monta `OutcomeInputs` a partir do banco (cunha · C4.2). Toda leitura é da
 * conta (`inOrg`). A tabela de preços da Veltrix e o câmbio ainda não têm
 * fonte (decisão em aberto 1): entram como parâmetro e, sem eles, o modelo de
 * referência e custos em USD ficam "indisponível".
 */

export interface OutcomePeriod {
  /** YYYY-MM-DD, inclusivo. */
  start: string;
  /** YYYY-MM-DD, inclusivo. */
  end: string;
}

/** "2026-10" → 1º ao último dia do mês. */
export function periodFromMonth(month: string): OutcomePeriod | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

const dayAfter = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000);

async function distinctTasks(orgId: string, period: OutcomePeriod, projectId?: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${agentEvents.taskId})::int` })
    .from(agentEvents)
    .where(
      inOrg(
        agentEvents,
        orgId,
        isNotNull(agentEvents.taskId),
        gte(agentEvents.ts, new Date(`${period.start}T00:00:00Z`)),
        lt(agentEvents.ts, dayAfter(period.end)),
        projectId ? eq(agentEvents.projectId, projectId) : undefined,
      ),
    );
  return row?.n ?? 0;
}

/** Versão do contrato vigente no fim do período (R3: a história não muda). */
export async function contractAt(orgId: string, agentId: string, at: Date): Promise<OutcomeContract | null> {
  const [row] = await db
    .select()
    .from(agentContracts)
    .where(
      inOrg(
        agentContracts,
        orgId,
        eq(agentContracts.agentId, agentId),
        lte(agentContracts.createdAt, at),
        or(isNull(agentContracts.supersededAt), gt(agentContracts.supersededAt, at)),
        sql`${agentContracts.status} <> 'draft'`,
      ),
    )
    .orderBy(sql`${agentContracts.version} DESC`)
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    metricKey: row.metricKey,
    unit: row.unit,
    direction: row.direction,
    baseline: row.baseline,
    target: row.target,
    referenceHumanMinutes: row.referenceHumanMinutes ?? null,
    requireHumanAccept: row.requireHumanAccept,
    referenceModel: row.referenceModel ?? null,
  };
}

export async function loadOutcomeInputs(input: {
  orgId: string;
  agentId: string;
  period: OutcomePeriod;
  priceTable?: PriceTable | null;
  fx?: ExchangeRate | null;
}): Promise<{ inputs: OutcomeInputs; projectId: string; environmentId: string | null } | null> {
  const { orgId, agentId, period } = input;
  const [agent] = await db
    .select({ id: agents.id, projectId: agents.projectId, role: agents.role, areaId: agents.areaId })
    .from(agents)
    .where(inOrg(agents, orgId, eq(agents.id, agentId)))
    .limit(1);
  if (!agent) return null;

  // Prova de valor é de produção: eventos de sandbox ficam fora. Evento sem
  // ambiente (sessão humana, conector org-wide, histórico) conta como prod.
  const [prod] = await db
    .select({ id: environments.id })
    .from(environments)
    .where(inOrg(environments, orgId, eq(environments.projectId, agent.projectId), eq(environments.kind, "prod")))
    .limit(1);
  const environmentId = prod?.id ?? null;

  const rows = await db
    .select()
    .from(agentEvents)
    .where(
      inOrg(
        agentEvents,
        orgId,
        eq(agentEvents.agentId, agentId),
        eq(agentEvents.projectId, agent.projectId),
        environmentId ? or(isNull(agentEvents.environmentId), eq(agentEvents.environmentId, environmentId)) : undefined,
        gte(agentEvents.ts, new Date(`${period.start}T00:00:00Z`)),
        lt(agentEvents.ts, dayAfter(period.end)),
      ),
    )
    .orderBy(asc(agentEvents.ts), asc(agentEvents.id));
  const events: OutcomeEventRow[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    ts: r.ts,
    taskId: r.taskId ?? null,
    runId: r.runId ?? null,
    attempt: r.attempt ?? null,
    costCents: r.costCents ?? null,
    tokensIn: r.tokensIn ?? null,
    tokensOut: r.tokensOut ?? null,
    contextTokens: r.contextTokens ?? null,
    model: r.model ?? null,
    capabilities: r.capabilities ?? null,
    success: r.success === null ? null : r.success === 1,
    expected: r.expected ?? null,
    actual: r.actual ?? null,
    acceptedBy: r.acceptedBy ?? null,
    acceptedByKind: r.acceptedByKind ?? null,
    acceptedRuleVersion: r.acceptedRuleVersion ?? null,
    humanMinutes: r.humanMinutes ?? null,
    reworkCount: r.reworkCount ?? null,
  }));
  const { tasks, coverage } = normalizeTasks(events);

  const rates = await db.select().from(roleRates).where(inOrg(roleRates, orgId, eq(roleRates.role, agent.role)));
  const rate = resolveHourlyRate(
    rates.map((r) => ({ ...r, areaId: r.areaId ?? null, validTo: r.validTo ?? null })),
    { role: agent.role, areaId: agent.areaId, day: period.end },
  );

  const costs = await db
    .select()
    .from(offInvoiceCosts)
    .where(inOrg(offInvoiceCosts, orgId, lte(offInvoiceCosts.periodStart, period.end), gte(offInvoiceCosts.periodEnd, period.start)));
  const fx = input.fx ?? null;
  const offInvoice =
    costs.length === 0
      ? { cents: 0, itemIds: [], missingFx: false }
      : allocateOffInvoice({
          costs: costs.map((c) => ({ ...c, projectId: c.projectId ?? null, agentId: c.agentId ?? null })),
          period,
          agentId,
          projectId: agent.projectId,
          agentTasks: tasks.length,
          projectTasks: await distinctTasks(orgId, period, agent.projectId),
          orgTasks: await distinctTasks(orgId, period),
          fx,
        });

  return {
    projectId: agent.projectId,
    environmentId,
    inputs: {
      calcVersion: CALC_VERSION,
      agentId,
      period,
      tasks,
      coverage,
      contract: await contractAt(orgId, agentId, dayAfter(period.end)),
      hourlyRate: rate
        ? { rateId: rate.id, hourlyCostCents: rate.hourlyCostCents, currency: rate.currency, role: rate.role, areaId: rate.areaId }
        : null,
      offInvoice,
      priceTable: input.priceTable ?? null,
      fx,
    },
  };
}
