import type {
  Connector,
  DiscoveredAgent,
  PreAssessResult,
} from "@workspace/api-client-react";

export const ADMISSION_HANDOFF_KEY = "muster:admission-handoff-v1";
const LEGACY_FAST_ASSESSMENT_KEY = "muster:fast-assessment-handoff";

export interface AdmissionHandoff {
  source: "connector" | "discovery" | "fast-assessment";
  sourceUrl?: string;
  connector?: Pick<Connector, "id" | "name" | "platform" | "mode" | "status">;
  candidate?: Pick<
    DiscoveredAgent,
    | "externalId"
    | "name"
    | "role"
    | "platform"
    | "sourceUrl"
    | "signals"
    | "proposedMetrics"
    | "confidence"
  >;
  result?: PreAssessResult;
}

export function storeAdmissionHandoff(handoff: AdmissionHandoff): void {
  sessionStorage.setItem(ADMISSION_HANDOFF_KEY, JSON.stringify(handoff));
}

export function consumeAdmissionHandoff(): AdmissionHandoff | null {
  const query = new URLSearchParams(window.location.search);
  const hasHandoffQuery = Boolean(query.get("source") || query.get("assessment"));
  if (!hasHandoffQuery) return null;

  const serialized =
    sessionStorage.getItem(ADMISSION_HANDOFF_KEY) ??
    sessionStorage.getItem(LEGACY_FAST_ASSESSMENT_KEY);
  sessionStorage.removeItem(ADMISSION_HANDOFF_KEY);
  sessionStorage.removeItem(LEGACY_FAST_ASSESSMENT_KEY);
  if (!serialized) return null;

  try {
    const parsed = JSON.parse(serialized) as AdmissionHandoff | {
      sourceUrl: string;
      result: PreAssessResult;
    };
    if ("source" in parsed) return parsed;
    return { source: "fast-assessment", ...parsed };
  } catch {
    return null;
  }
}
