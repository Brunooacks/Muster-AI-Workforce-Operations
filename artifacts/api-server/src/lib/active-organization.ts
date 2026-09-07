export function resolveActiveOrganizationId(
  orgId: string | null | undefined,
  sessionClaims: unknown,
): string | null {
  if (orgId) return orgId;
  if (!sessionClaims || typeof sessionClaims !== "object") return null;
  const fromClaims = (sessionClaims as Record<string, unknown>)["org_id"];
  return typeof fromClaims === "string" && fromClaims ? fromClaims : null;
}
