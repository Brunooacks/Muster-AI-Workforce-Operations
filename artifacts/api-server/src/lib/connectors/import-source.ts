import type { DiscoveredAgentCandidate } from "./types";

export interface CatalogAgentCandidate {
  externalId: string;
  name: string;
  role: string;
  signals: string[];
}

export interface ResolvedImportSource {
  externalId: string;
  name: string;
  role: string;
  url?: string;
  signals: string[];
  isReal: boolean;
}

export function resolveImportSource(
  realCandidate: DiscoveredAgentCandidate | undefined,
  catalogCandidate: CatalogAgentCandidate | undefined,
): ResolvedImportSource | null {
  if (realCandidate) {
    return {
      externalId: realCandidate.externalId,
      name: realCandidate.name,
      role: realCandidate.description || realCandidate.stack || "Agente descoberto",
      ...(realCandidate.url ? { url: realCandidate.url } : {}),
      signals: realCandidate.signals,
      isReal: true,
    };
  }

  if (catalogCandidate) {
    return {
      externalId: catalogCandidate.externalId,
      name: catalogCandidate.name,
      role: catalogCandidate.role,
      signals: catalogCandidate.signals,
      isReal: false,
    };
  }

  return null;
}
