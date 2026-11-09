import type { Num, OutcomeResult } from "./outcome-layers";

/**
 * Camada 3 · Prova (cunha · C12.1). Puro: recebe o que o endpoint leu do
 * banco e diz, para cada número, de onde veio, que trilha existe e quem
 * responde. O selo assinado é da E6; aqui fica a proveniência e a cobertura.
 */

export interface ProofInput {
  result: OutcomeResult;
  owners: { businessOwner: string; technicalOwner: string; governanceSponsor: string } | null;
  contract: { id: string; version: number; ownerMemberId: string; ownerIsMember: boolean } | null;
  activeKeys: { environmentKind: string }[];
  trail: { record: string; acceptedByKind: string | null; acceptedRuleVersion: string | null }[];
  snapshot: { id: string; inputsHash: string; createdAt: string } | null;
}

export interface ProofLayer {
  provenance: Num<{ sources: string[]; formula: string; taskCount: number; runCount: number }>;
  trail: Num<{ records: number; humanReviews: number; acceptances: number; autoAcceptances: number; ruleVersions: string[] }>;
  ownerCoverage: Num<{ covered: number; of: number; missing: string[] }>;
  credentialCoverage: Num<{ activeKeys: number; environments: string[] }>;
  snapshot: Num<{ id: string; inputsHash: string; createdAt: string }>;
}

const ok = <T>(value: T): Num<T> => ({ status: "ok", value });
const na = <T>(reason: string): Num<T> => ({ status: "unavailable", reason });

export function buildProofLayer(input: ProofInput): ProofLayer {
  const cost = input.result.layer1.cost;
  const provenance: ProofLayer["provenance"] =
    cost.status === "ok"
      ? ok({
          sources: cost.value.totalCost.provenance.sources,
          formula: cost.value.totalCost.provenance.formula ?? "",
          taskCount: cost.value.totalCost.provenance.taskIds?.length ?? 0,
          runCount: cost.value.totalCost.provenance.runIds?.length ?? 0,
        })
      : na(cost.reason);

  const acceptances = input.trail.filter((t) => t.record === "acceptance");
  const autos = input.trail.filter((t) => t.acceptedByKind === "auto");
  const trail: ProofLayer["trail"] =
    input.trail.length === 0
      ? na("no_trail_records")
      : ok({
          records: input.trail.length,
          humanReviews: input.trail.filter((t) => t.record === "human_review").length,
          acceptances: acceptances.length,
          autoAcceptances: autos.length,
          ruleVersions: [...new Set(autos.map((t) => t.acceptedRuleVersion).filter((v): v is string => Boolean(v)))].sort(),
        });

  const slots: [string, boolean][] = [
    ["business_owner", Boolean(input.owners?.businessOwner.trim())],
    ["technical_owner", Boolean(input.owners?.technicalOwner.trim())],
    ["governance_sponsor", Boolean(input.owners?.governanceSponsor.trim())],
    ["contract_owner", Boolean(input.contract?.ownerIsMember)],
  ];
  const ownerCoverage = ok({
    covered: slots.filter(([, has]) => has).length,
    of: slots.length,
    missing: slots.filter(([, has]) => !has).map(([name]) => name),
  });

  const credentialCoverage: ProofLayer["credentialCoverage"] =
    input.activeKeys.length === 0
      ? na("no_active_agent_key")
      : ok({
          activeKeys: input.activeKeys.length,
          environments: [...new Set(input.activeKeys.map((k) => k.environmentKind))].sort(),
        });

  return {
    provenance,
    trail,
    ownerCoverage,
    credentialCoverage,
    snapshot: input.snapshot ? ok(input.snapshot) : na("period_not_closed"),
  };
}
