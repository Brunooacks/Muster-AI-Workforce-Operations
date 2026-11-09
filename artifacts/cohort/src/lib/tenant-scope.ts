export type AccountKind = "company" | "personal";

export interface TenantScope {
  userId: string;
  /** Organização ativa; na conta pessoal, "personal:<userId>". */
  organizationId: string;
  kind: AccountKind;
}

export const PERSONAL_PREFIX = "personal:";

export function createTenantScope(
  userId?: string | null,
  organizationId?: string | null,
): TenantScope | null {
  const normalizedUserId = userId?.trim();
  const normalizedOrganizationId = organizationId?.trim();

  if (!normalizedUserId) return null;

  // Sem organização ativa = conta pessoal. Ela é um tenant próprio e nunca
  // aparece dentro da conta da empresa.
  if (!normalizedOrganizationId) {
    return {
      userId: normalizedUserId,
      organizationId: `${PERSONAL_PREFIX}${normalizedUserId}`,
      kind: "personal",
    };
  }

  return {
    userId: normalizedUserId,
    organizationId: normalizedOrganizationId,
    kind: "company",
  };
}

export function createTenantScopeKey(
  userId?: string | null,
  organizationId?: string | null,
): string | null {
  const scope = createTenantScope(userId, organizationId);
  if (!scope) return null;

  return [scope.userId, scope.organizationId]
    .map((value) => encodeURIComponent(value))
    .join(":");
}

export function hasTenantScopeChanged(
  previousScopeKey: string | null | undefined,
  nextScopeKey: string | null,
): boolean {
  return previousScopeKey !== nextScopeKey;
}
