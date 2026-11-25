import { asc, eq, isNull, sql } from "drizzle-orm";
import { db, agents, eventOutbox, humanBaselines } from "@workspace/db";
import { inOrg, inProject } from "./tenant-scope";
export { humanBaselineProblems, type HumanBaselineInputPayload } from "./human-baseline-input";
import { agentInOrg } from "./agent-contracts";
import type { HumanBaselineInput } from "./outcome-layers";

/**
 * Baseline humano configurável por tipo de tarefa (MUS-195).
 * Escopado sempre por organização (`inOrg`), sem seed nem default global:
 * quando a conta não configurou, a ficha mostra "indisponível".
 */

export const HUMAN_BASELINE_TRAIL_EVENT_TYPE = "account.human_baseline.updated";

export type HumanBaselineRow = typeof humanBaselines.$inferSelect;

export function toHumanBaseline(row: HumanBaselineRow) {
  return {
    id: row.id,
    taskType: row.taskType,
    agentId: row.agentId ?? null,
    humanMinutesPerTask: row.humanMinutesPerTask,
    humanAccuracyRate: row.humanAccuracyRate,
    humanEscalationRate: row.humanEscalationRate,
    measurementKind: row.measurementKind,
    measuredAt: row.measuredAt ?? null,
    notes: row.notes ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listHumanBaselines(orgId: string): Promise<HumanBaselineRow[]> {
  return db
    .select()
    .from(humanBaselines)
    .where(inOrg(humanBaselines, orgId))
    .orderBy(asc(humanBaselines.taskType), asc(humanBaselines.createdAt));
}

function normalizeTaskType(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function resolveHumanBaseline(
  orgId: string,
  agent: { id: string; taskType?: string | null; role: string },
): Promise<HumanBaselineInput | null> {
  const rows = await db
    .select()
    .from(humanBaselines)
    .where(inOrg(humanBaselines, orgId));
  if (rows.length === 0) return null;

  const byAgent = rows.find((r) => r.agentId === agent.id);
  if (byAgent) {
    return {
      id: byAgent.id,
      taskType: byAgent.taskType,
      source: "agent_baseline",
      humanMinutesPerTask: byAgent.humanMinutesPerTask,
      humanAccuracyRate: byAgent.humanAccuracyRate,
      humanEscalationRate: byAgent.humanEscalationRate,
      measurementKind: byAgent.measurementKind,
      measuredAt: byAgent.measuredAt ?? null,
      notes: byAgent.notes ?? null,
    };
  }

  const orgRows = rows.filter((r) => r.agentId === null);
  if (agent.taskType) {
    const key = normalizeTaskType(agent.taskType);
    const byTaskType = orgRows.find((r) => normalizeTaskType(r.taskType) === key);
    if (byTaskType) {
      return {
        id: byTaskType.id,
        taskType: byTaskType.taskType,
        source: "task_type_baseline",
        humanMinutesPerTask: byTaskType.humanMinutesPerTask,
        humanAccuracyRate: byTaskType.humanAccuracyRate,
        humanEscalationRate: byTaskType.humanEscalationRate,
        measurementKind: byTaskType.measurementKind,
      measuredAt: byTaskType.measuredAt ?? null,
      notes: byTaskType.notes ?? null,
      };
    }
  }

  const roleKey = normalizeTaskType(agent.role);
  const byRole = orgRows.find((r) => normalizeTaskType(r.taskType) === roleKey);
  if (byRole) {
    return {
      id: byRole.id,
      taskType: byRole.taskType,
      source: "role_baseline",
      humanMinutesPerTask: byRole.humanMinutesPerTask,
      humanAccuracyRate: byRole.humanAccuracyRate,
      humanEscalationRate: byRole.humanEscalationRate,
      measurementKind: byRole.measurementKind,
      measuredAt: byRole.measuredAt ?? null,
      notes: byRole.notes ?? null,
    };
  }

  return null;
}

export async function getAgentHumanBaselineContext(orgId: string, agentId: string) {
  const [agent] = await db
    .select({ id: agents.id, projectId: agents.projectId, taskType: agents.taskType, role: agents.role })
    .from(agents)
    .where(inOrg(agents, orgId, eq(agents.id, agentId)))
    .limit(1);
  if (!agent) return null;

  const all = await listHumanBaselines(orgId);
  const resolved = await resolveHumanBaseline(orgId, agent);
  return {
    agentId: agent.id,
    taskType: agent.taskType ?? null,
    role: agent.role,
    resolved,
    orgBaselines: all.filter((r) => r.agentId === null).map(toHumanBaseline),
  };
}

export async function upsertHumanBaseline(input: {
  orgId: string;
  userId: string;
  taskType: string;
  agentId?: string | null;
  humanMinutesPerTask: number;
  humanAccuracyRate: number;
  humanEscalationRate: number;
  measurementKind?: "measured" | "estimated";
  measuredAt?: string | null;
  notes?: string | null;
  now?: Date;
}): Promise<HumanBaselineRow | null> {
  const agentId = input.agentId ?? null;
  if (agentId && !(await agentInOrg(input.orgId, agentId))) {
    return null;
  }
  const now = input.now ?? new Date();
  const cleanTaskType = input.taskType.trim();
  const cleanNotes = input.notes?.trim() || null;
  const measurementKind = input.measurementKind ?? "measured";
  const measuredAt = input.measuredAt?.trim() || null;

  return db.transaction(async (tx) => {
    const existing = agentId
      ? await tx
          .select()
          .from(humanBaselines)
          .where(inOrg(humanBaselines, input.orgId, eq(humanBaselines.agentId, agentId)))
          .limit(1)
      : await tx
          .select()
          .from(humanBaselines)
          .where(
            inOrg(
              humanBaselines,
              input.orgId,
              isNull(humanBaselines.agentId),
              sql`lower(trim(${humanBaselines.taskType})) = ${normalizeTaskType(cleanTaskType)}`,
            ),
          )
          .limit(1);

    let row: HumanBaselineRow;
    if (existing[0]) {
      const [updated] = await tx
        .update(humanBaselines)
        .set({
          taskType: cleanTaskType,
          humanMinutesPerTask: input.humanMinutesPerTask,
          humanAccuracyRate: input.humanAccuracyRate,
          humanEscalationRate: input.humanEscalationRate,
          measurementKind,
          measuredAt,
          notes: cleanNotes,
          updatedAt: now,
        })
        .where(inOrg(humanBaselines, input.orgId, eq(humanBaselines.id, existing[0].id)))
        .returning();
      row = updated!;
    } else {
      const [created] = await tx
        .insert(humanBaselines)
        .values({
          orgId: input.orgId,
          taskType: cleanTaskType,
          agentId,
          humanMinutesPerTask: input.humanMinutesPerTask,
          humanAccuracyRate: input.humanAccuracyRate,
          humanEscalationRate: input.humanEscalationRate,
          measurementKind,
          measuredAt,
          notes: cleanNotes,
          createdBy: input.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      row = created!;
    }

    await tx.insert(eventOutbox).values({
      orgId: input.orgId,
      aggregateType: agentId ? "agent" : "organization",
      aggregateId: agentId ?? input.orgId,
      eventType: HUMAN_BASELINE_TRAIL_EVENT_TYPE,
      payload: {
        baselineId: row.id,
        taskType: row.taskType,
        agentId: row.agentId ?? null,
        updatedBy: input.userId,
        occurredAt: now.toISOString(),
      },
      status: "completed",
      processedAt: now,
    });

    return row;
  });
}

export async function saveAgentHumanBaseline(input: {
  orgId: string;
  agentId: string;
  userId: string;
  taskType: string;
  humanMinutesPerTask: number;
  humanAccuracyRate: number;
  humanEscalationRate: number;
  scope: "task_type" | "agent";
  measurementKind?: "measured" | "estimated";
  measuredAt?: string | null;
  notes?: string | null;
}) {
  const ctx = await getAgentHumanBaselineContext(input.orgId, input.agentId);
  if (!ctx) return null;
  const cleanTaskType = input.taskType.trim();
  const [agentRow] = await db
    .select({ id: agents.id, projectId: agents.projectId })
    .from(agents)
    .where(inOrg(agents, input.orgId, eq(agents.id, input.agentId)))
    .limit(1);
  if (!agentRow) return null;
  await db
    .update(agents)
    .set({ taskType: cleanTaskType })
    .where(inProject(agents, { orgId: input.orgId, projectId: agentRow.projectId }, eq(agents.id, input.agentId)));

  const saved = await upsertHumanBaseline({
    orgId: input.orgId,
    userId: input.userId,
    taskType: cleanTaskType,
    agentId: input.scope === "agent" ? input.agentId : null,
    humanMinutesPerTask: input.humanMinutesPerTask,
    humanAccuracyRate: input.humanAccuracyRate,
    humanEscalationRate: input.humanEscalationRate,
    measurementKind: input.measurementKind,
    measuredAt: input.measuredAt,
    notes: input.notes,
  });
  if (!saved) return null;
  return getAgentHumanBaselineContext(input.orgId, input.agentId);
}

export async function deleteHumanBaseline(orgId: string, baselineId: string): Promise<boolean> {
  const deleted = await db
    .delete(humanBaselines)
    .where(inOrg(humanBaselines, orgId, eq(humanBaselines.id, baselineId)))
    .returning({ id: humanBaselines.id });
  return deleted.length > 0;
}
