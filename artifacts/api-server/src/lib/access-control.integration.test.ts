import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accessGroupMembers,
  accessGroups,
  organizationMembers,
  organizations,
  purposes,
  teams,
} from "@workspace/db/schema";

const runIntegration = process.env.RUN_ACCESS_CONTROL_DB_TESTS === "true";
type WorkspaceDb = typeof import("@workspace/db");
let workspaceDb: WorkspaceDb;

const suffix = randomUUID().slice(0, 8);
const orgA = `org_access_a_${suffix}`;
const orgB = `org_access_b_${suffix}`;
const userId = `user_access_${suffix}`;
const purposeId = `purpose_access_${suffix}`;
const teamA = `team_access_a_${suffix}`;
const groupOrg = `group_access_org_${suffix}`;
const groupTeam = `group_access_team_${suffix}`;

describe.skipIf(!runIntegration)("access control PostgreSQL", () => {
  beforeAll(async () => {
    workspaceDb = await import("@workspace/db");
    const { db } = workspaceDb;
    await db.insert(organizations).values([
      { id: orgA, name: "Access A", slug: `access-a-${suffix}` },
      { id: orgB, name: "Access B", slug: `access-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values({
      orgId: orgA,
      userId,
      role: "member",
    });
    await db.insert(purposes).values({
      id: purposeId,
      orgId: orgA,
      key: "access-purpose",
      name: "Access purpose",
      domain: "operations",
      outcome: "controlled",
    });
    await db.insert(teams).values({
      id: teamA,
      orgId: orgA,
      purposeId,
      name: "Access team",
      slug: "access-team",
    });
    await db.insert(accessGroups).values([
      {
        id: groupOrg,
        orgId: orgA,
        name: "Observers",
        slug: "observers",
        scopeType: "organization",
        permissions: ["agents:read"],
        createdBy: "owner-a",
      },
      {
        id: groupTeam,
        orgId: orgA,
        name: "Team managers",
        slug: "team-managers",
        scopeType: "team",
        scopeId: teamA,
        permissions: ["teams:manage"],
        createdBy: "owner-a",
      },
    ]);
    await db.insert(accessGroupMembers).values([
      { groupId: groupOrg, userId },
      { groupId: groupTeam, userId },
    ]);
  });

  afterAll(async () => {
    if (!workspaceDb) return;
    await workspaceDb.db.delete(organizations).where(eq(organizations.id, orgA));
    await workspaceDb.db.delete(organizations).where(eq(organizations.id, orgB));
  });

  it("combines organization and matching team grants without tenant leakage", async () => {
    const { hasAccessPermission, listEffectivePermissions } = await import(
      "./access-control-service"
    );

    await expect(
      listEffectivePermissions(orgA, userId, { type: "team", id: teamA }),
    ).resolves.toEqual(["agents:read", "teams:manage"]);
    await expect(
      hasAccessPermission(orgA, userId, "teams:manage", {
        type: "team",
        id: "other-team",
      }),
    ).resolves.toBe(false);
    await expect(
      hasAccessPermission(orgB, userId, "agents:read"),
    ).resolves.toBe(false);
  });
});
