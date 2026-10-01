import type { OrgMemberRole } from "@workspace/db";

export type OrgAuthorizationDecision =
  | { authorized: true; role: OrgMemberRole }
  | { authorized: false; status: 403; reason: "forbidden" };

export function authorizeOrgRole(
  role: OrgMemberRole | null,
  allowedRoles: readonly OrgMemberRole[],
): OrgAuthorizationDecision {
  if (role && allowedRoles.includes(role)) {
    return { authorized: true, role };
  }
  return { authorized: false, status: 403, reason: "forbidden" };
}
