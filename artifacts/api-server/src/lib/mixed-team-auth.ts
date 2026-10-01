import type { OrgMemberRole, TeamMemberRole } from "@workspace/db";
import { isRoleAllowed, parseTeamMemberRole } from "./mixed-team";

export type MixedTeamAuthorization =
  | { authorized: true; role: TeamMemberRole }
  | {
      authorized: false;
      status: 401 | 403;
      reason: "unauthenticated" | "forbidden";
    };

export function authorizeMixedTeamRole(
  role: unknown,
  allowedRoles: readonly TeamMemberRole[],
): MixedTeamAuthorization {
  const parsedRole = parseTeamMemberRole(role);
  if (!parsedRole || !isRoleAllowed(parsedRole, allowedRoles)) {
    return { authorized: false, status: 403, reason: "forbidden" };
  }
  return { authorized: true, role: parsedRole };
}

export function authorizeMixedTeamManagement(
  organizationRole: OrgMemberRole | null,
  teamRole: unknown,
  allowedTeamRoles: readonly TeamMemberRole[],
): MixedTeamAuthorization {
  if (organizationRole === "owner" || organizationRole === "admin") {
    return { authorized: true, role: "owner" };
  }

  return authorizeMixedTeamRole(teamRole, allowedTeamRoles);
}
