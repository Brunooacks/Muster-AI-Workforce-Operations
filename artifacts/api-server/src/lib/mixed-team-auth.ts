import type { TeamMemberRole } from "@workspace/db";
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
  bypass = false,
): MixedTeamAuthorization {
  if (bypass) {
    return { authorized: true, role: "owner" };
  }

  const parsedRole = parseTeamMemberRole(role);
  if (!parsedRole || !isRoleAllowed(parsedRole, allowedRoles)) {
    return { authorized: false, status: 403, reason: "forbidden" };
  }
  return { authorized: true, role: parsedRole };
}
