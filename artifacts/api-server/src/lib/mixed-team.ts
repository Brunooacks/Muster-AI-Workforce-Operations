import type { TeamMemberRole } from "@workspace/db";

export const TEAM_MEMBER_ROLES = [
  "owner",
  "supervisor",
  "operator",
  "observer",
] as const;

export function isTeamMemberRole(value: unknown): value is TeamMemberRole {
  return (
    typeof value === "string" &&
    (TEAM_MEMBER_ROLES as readonly string[]).includes(value)
  );
}

export function parseTeamMemberRole(value: unknown): TeamMemberRole | null {
  return isTeamMemberRole(value) ? value : null;
}

export function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeDecisionRights(rights: string[]): string[] {
  return [...new Set(rights.map((right) => right.trim()).filter(Boolean))];
}

export function canManageMixedTeam(role: TeamMemberRole): boolean {
  return role === "owner" || role === "supervisor";
}

export function isRoleAllowed(
  role: TeamMemberRole | null,
  allowedRoles: readonly TeamMemberRole[],
): boolean {
  return role !== null && allowedRoles.includes(role);
}
