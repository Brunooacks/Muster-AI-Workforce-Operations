import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, outcomeSnapshots } from "@workspace/db";
import { inOrg } from "./tenant-scope";
import { computeOutcome, stableStringify, type OutcomeInputs, type OutcomeResult } from "./outcome-layers";
import { loadOutcomeInputs, periodFromMonth } from "./outcome-loader";

/**
 * Fechamento por período (cunha · C4.4). O snapshot é imutável e guarda os
 * inputs normalizados: recalcular o mesmo período com os mesmos dados dá o
 * mesmo `inputs_hash` (e o único impede duplicar); mudar contrato, custo-hora
 * ou preço depois não altera o snapshot já fechado.
 */

export type OutcomeSnapshotRow = typeof outcomeSnapshots.$inferSelect;

export function inputsHash(inputs: OutcomeInputs): string {
  return createHash("sha256").update(stableStringify(inputs)).digest("hex");
}

/** O cálculo reproduzido só com o que a linha guarda. */
export function reproduceSnapshot(row: Pick<OutcomeSnapshotRow, "inputs">): OutcomeResult {
  return computeOutcome(row.inputs as unknown as OutcomeInputs);
}

export function snapshotValues(input: {
  orgId: string;
  projectId: string;
  environmentId: string | null;
  month: string;
  inputs: OutcomeInputs;
}): typeof outcomeSnapshots.$inferInsert {
  const result = computeOutcome(input.inputs);
  const ref = result.layer1.referenceModel;
  return {
    orgId: input.orgId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    agentId: input.inputs.agentId,
    period: input.month,
    layer1: result.layer1 as unknown as Record<string, unknown>,
    layer2: result.layer2 as unknown as Record<string, unknown>,
    signals: result.signals as unknown as Record<string, unknown>,
    contractId: input.inputs.contract?.id ?? null,
    contractVersion: input.inputs.contract?.version ?? null,
    calcVersion: input.inputs.calcVersion,
    inputsHash: inputsHash(input.inputs),
    inputs: JSON.parse(stableStringify(input.inputs)) as Record<string, unknown>,
    roleRatesSnapshot: (input.inputs.hourlyRate as unknown as Record<string, unknown> | null) ?? null,
    pricesSnapshot: (input.inputs.priceTable as unknown as Record<string, unknown> | null) ?? null,
    referenceModel: ref.status === "ok" ? ref.value.model : null,
    priceVersion: input.inputs.priceTable?.version ?? null,
    taskCoverage: result.coverage.status === "ok" ? result.coverage.value.ratio : null,
  };
}

/** Fecha o mês do agente. Idempotente: mesmo input → mesma linha. */
export async function closeOutcomePeriod(input: {
  orgId: string;
  agentId: string;
  month: string;
}): Promise<{ snapshot: OutcomeSnapshotRow; created: boolean } | null> {
  const period = periodFromMonth(input.month);
  if (!period) return null;
  const loaded = await loadOutcomeInputs({ orgId: input.orgId, agentId: input.agentId, period });
  if (!loaded) return null;
  const values = snapshotValues({
    orgId: input.orgId,
    projectId: loaded.projectId,
    environmentId: loaded.environmentId,
    month: input.month,
    inputs: loaded.inputs,
  });
  const [created] = await db.insert(outcomeSnapshots).values(values).onConflictDoNothing().returning();
  if (created) return { snapshot: created, created: true };
  const [existing] = await db
    .select()
    .from(outcomeSnapshots)
    .where(
      inOrg(
        outcomeSnapshots,
        input.orgId,
        eq(outcomeSnapshots.agentId, input.agentId),
        eq(outcomeSnapshots.period, input.month),
        eq(outcomeSnapshots.calcVersion, values.calcVersion),
        eq(outcomeSnapshots.inputsHash, values.inputsHash),
      ),
    )
    .limit(1);
  return existing ? { snapshot: existing, created: false } : null;
}

/** Último snapshot fechado do mês (o mais recente, se houve refechamento). */
export async function latestSnapshot(orgId: string, agentId: string, month: string): Promise<OutcomeSnapshotRow | null> {
  const [row] = await db
    .select()
    .from(outcomeSnapshots)
    .where(and(inOrg(outcomeSnapshots, orgId, eq(outcomeSnapshots.agentId, agentId), eq(outcomeSnapshots.period, month))))
    .orderBy(desc(outcomeSnapshots.createdAt))
    .limit(1);
  return row ?? null;
}
