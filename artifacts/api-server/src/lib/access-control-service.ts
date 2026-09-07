import { and, eq } from "drizzle-orm";
import {
  accessGroupMembers,
  accessGroups,
  db,
  organizationMembers,
  type AccessPermission,
  type OrgMemberRole,
} from "@workspace/db";
import {
  canAccess,
  effectivePermissions,
  type AccessGrant,
  type AccessScope,
} from "./access-policy";

export interface UserAccessSnapshot {
  role: OrgMemberRole | null;
  grants: AccessGrant[];
}

export async function readUserAccess(
  orgId: string,
  userId: string,
): Promise<UserAccessSnapshot> {
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  const rows = await db
    .select({
      scopeType: accessGroups.scopeType,
      scopeId: accessGroups.scopeId,
      permissions: accessGroups.permissions,
    })
    .from(accessGroupMembers)
    .innerJoin(accessGroups, eq(accessGroups.id, accessGroupMembers.groupId))
    .where(
      and(
        eq(accessGroups.orgId, orgId),
        eq(accessGroupMembers.userId, userId),
      ),
    );

  return {
    role: membership?.role ?? null,
    grants: rows,
  };
}

export async function listEffectivePermissions(
  orgId: string,
  userId: string,
  scope?: AccessScope,
): Promise<AccessPermission[]> {
  const snapshot = await readUserAccess(orgId, userId);
  return effectivePermissions(snapshot.role, snapshot.grants, scope);
}

export async function hasAccessPermission(
  orgId: string,
  userId: string,
  permission: AccessPermission,
  scope?: AccessScope,
): Promise<boolean> {
  const snapshot = await readUserAccess(orgId, userId);
  return canAccess(snapshot.role, snapshot.grants, permission, scope);
}
