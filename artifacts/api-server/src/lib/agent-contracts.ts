import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  agentContracts,
  agents,
  eventOutbox,
  organizationMembers,
} from "@workspace/db";
import { inOrg } from "./tenant-scope";
import type { ContractInput } from "./agent-contract-input";

export { contractInputProblems, type ContractInput } from "./agent-contract-input";

/**
 * Contrato numérico versionado por agente (cunha · C2.2, MUS-175).
 *
 * Nunca há edição: cada POST grava a versão N+1 como `active` e passa a
 * anterior para `superseded` na mesma transação. O banco garante o resto
 * (trigger de imutabilidade e único parcial de `active` por agente).
 */

export const CONTRACT_TRAIL_EVENT_TYPE = "agent.contract.versioned";

export type AgentContractRow = typeof agentContracts.$inferSelect;

export function toAgentContract(row: AgentContractRow) {
  return {
    id: row.id,
    agentId: row.agentId,
    version: row.version,
    metricKey: row.metricKey,
    unit: row.unit,
    direction: row.direction,
    baseline: row.baseline,
    target: row.target,
    limit: row.limit ?? null,
    deadline: row.deadline,
    ownerMemberId: row.ownerMemberId,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    supersededAt: row.supersededAt ? row.supersededAt.toISOString() : null,
    referenceHumanMinutes: row.referenceHumanMinutes ?? null,
    requireHumanAccept: row.requireHumanAccept,
    referenceModel: row.referenceModel ?? null,
  };
}

export async function listContracts(orgId: string, agentId: string): Promise<AgentContractRow[]> {
  return db
    .select()
    .from(agentContracts)
    .where(inOrg(agentContracts, orgId, eq(agentContracts.agentId, agentId)))
    .orderBy(desc(agentContracts.version));
}

export async function activeContract(orgId: string, agentId: string): Promise<AgentContractRow | null> {
  const [row] = await db
    .select()
    .from(agentContracts)
    .where(inOrg(agentContracts, orgId, eq(agentContracts.agentId, agentId), eq(agentContracts.status, "active")))
    .limit(1);
  return row ?? null;
}

/** Versão exata (leitura de veredito antigo usa a versão dele, regra R3). */
export async function contractVersion(
  orgId: string,
  contractId: string,
  version: number,
): Promise<AgentContractRow | null> {
  const [row] = await db
    .select()
    .from(agentContracts)
    .where(inOrg(agentContracts, orgId, eq(agentContracts.id, contractId), eq(agentContracts.version, version)))
    .limit(1);
  return row ?? null;
}

export async function ownerCandidates(orgId: string) {
  return db
    .select({ id: organizationMembers.id, userId: organizationMembers.userId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(inOrg(organizationMembers, orgId))
    .orderBy(asc(organizationMembers.createdAt));
}

export class ContractOwnerError extends Error {}

/**
 * Grava a versão seguinte. O agente é travado (`FOR UPDATE`) para que dois
 * POSTs simultâneos não disputem o mesmo número de versão.
 */
export async function createContractVersion(input: {
  orgId: string;
  agentId: string;
  createdBy: string;
  body: ContractInput;
  now?: Date;
}): Promise<AgentContractRow | null> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [agent] = await tx
      .select({ id: agents.id, projectId: agents.projectId })
      .from(agents)
      .where(inOrg(agents, input.orgId, eq(agents.id, input.agentId)))
      .for("update");
    if (!agent) return null;

    const [owner] = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(inOrg(organizationMembers, input.orgId, eq(organizationMembers.id, input.body.ownerMemberId)))
      .limit(1);
    if (!owner) throw new ContractOwnerError("O dono precisa ser membro da conta.");

    const [last] = await tx
      .select({ version: agentContracts.version })
      .from(agentContracts)
      .where(inOrg(agentContracts, input.orgId, eq(agentContracts.agentId, input.agentId)))
      .orderBy(desc(agentContracts.version))
      .limit(1);

    const superseded = await tx
      .update(agentContracts)
      .set({ status: "superseded", supersededAt: now })
      .where(inOrg(agentContracts, input.orgId, eq(agentContracts.agentId, input.agentId), eq(agentContracts.status, "active")))
      .returning({ id: agentContracts.id, version: agentContracts.version });

    const b = input.body;
    const [row] = await tx
      .insert(agentContracts)
      .values({
        orgId: input.orgId,
        projectId: agent.projectId,
        agentId: input.agentId,
        version: (last?.version ?? 0) + 1,
        metricKey: b.metricKey.trim(),
        unit: b.unit.trim(),
        direction: b.direction,
        baseline: b.baseline,
        target: b.target,
        limit: b.limit ?? null,
        deadline: b.deadline,
        ownerMemberId: b.ownerMemberId,
        status: "active",
        createdBy: input.createdBy,
        createdAt: now,
        referenceHumanMinutes: b.referenceHumanMinutes ?? null,
        requireHumanAccept: b.requireHumanAccept ?? false,
        referenceModel: b.referenceModel?.trim() || null,
      })
      .returning();

    await tx.insert(eventOutbox).values({
      orgId: input.orgId,
      projectId: agent.projectId,
      aggregateType: "agent",
      aggregateId: input.agentId,
      eventType: CONTRACT_TRAIL_EVENT_TYPE,
      payload: {
        agentId: input.agentId,
        contractId: row!.id,
        version: row!.version,
        supersededVersion: superseded[0]?.version ?? null,
        createdBy: input.createdBy,
        occurredAt: now.toISOString(),
      },
      status: "completed",
      processedAt: now,
    });
    return row!;
  });
}

/** Agente da conta? (404 sem dizer se existe em outra conta). */
export async function agentInOrg(orgId: string, agentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), inOrg(agents, orgId)))
    .limit(1);
  return Boolean(row);
}
