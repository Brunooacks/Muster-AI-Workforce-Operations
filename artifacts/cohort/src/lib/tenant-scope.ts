export interface TenantScope {
  userId: string;
  organizationId: string;
}

export function createTenantScope(
  userId?: string | null,
  organizationId?: string | null,
): TenantScope | null {
  const normalizedUserId = userId?.trim();
  const normalizedOrganizationId = organizationId?.trim();

  if (!normalizedUserId || !normalizedOrganizationId) return null;

  return {
    userId: normalizedUserId,
    organizationId: normalizedOrganizationId,
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
