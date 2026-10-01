import { clerkClient } from "@clerk/express";
import { db, organizations, organizationMembers } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { ensureCatalogSeed } from "./catalog-seed";
import {
  buildOrganizationUpsertPlan,
  mapClerkOrganizationRole,
  type ClerkOrganizationMembershipSnapshot,
} from "./organization-lifecycle";

const CLERK_PAGE_SIZE = 100;

export interface LocalOrganizationSnapshot {
  id: string;
  externalId: string;
  name: string;
  slug: string;
}

export interface ProvisionedOrganization extends LocalOrganizationSnapshot {
  role: "owner" | "admin" | "member";
}

export async function listClerkOrganizationMemberships(
  userId: string,
): Promise<ClerkOrganizationMembershipSnapshot[]> {
  const memberships: ClerkOrganizationMembershipSnapshot[] = [];
  let offset = 0;

  while (true) {
    const page = await clerkClient.users.getOrganizationMembershipList({
      userId,
      limit: CLERK_PAGE_SIZE,
      offset,
    });
    memberships.push(
      ...page.data.map((membership) => ({
        role: membership.role,
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
        },
      })),
    );

    if (
      page.data.length === 0 ||
      memberships.length >= page.totalCount ||
      page.data.length < CLERK_PAGE_SIZE
    ) {
      break;
    }
    offset += page.data.length;
  }

  return memberships;
}

export async function listLocalOrganizationsByExternalIds(
  externalIds: string[],
): Promise<LocalOrganizationSnapshot[]> {
  const uniqueExternalIds = [...new Set(externalIds)];
  if (uniqueExternalIds.length === 0) return [];

  const rows = await db
    .select({
      id: organizations.id,
      externalId: organizations.externalId,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(inArray(organizations.externalId, uniqueExternalIds));

  return rows.flatMap((row) =>
    row.externalId ? [{ ...row, externalId: row.externalId }] : [],
  );
}

export async function provisionClerkOrganization(
  userId: string,
  membership: ClerkOrganizationMembershipSnapshot,
): Promise<ProvisionedOrganization> {
  const plan = buildOrganizationUpsertPlan(userId, membership);
  const provisioned = await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values(plan.organization)
      .onConflictDoUpdate({
        target: organizations.externalId,
        set: {
          name: plan.organization.name,
          slug: plan.organization.slug,
          updatedAt: plan.organization.updatedAt,
        },
      })
      .returning({
        id: organizations.id,
        externalId: organizations.externalId,
        name: organizations.name,
        slug: organizations.slug,
      });

    if (!organization?.externalId) {
      throw new Error(
        "Organization provisioning did not return an external id.",
      );
    }

    await tx
      .insert(organizationMembers)
      .values({
        orgId: organization.id,
        userId: plan.membership.userId,
        role: plan.membership.role,
      })
      .onConflictDoUpdate({
        target: [organizationMembers.orgId, organizationMembers.userId],
        set: { role: plan.membership.role },
      });

    return {
      id: organization.id,
      externalId: organization.externalId,
      name: organization.name,
      slug: organization.slug,
      role: plan.membership.role,
    };
  });

  await ensureCatalogSeed(provisioned.id);
  return provisioned;
}

export interface OrganizationMemberProfile {
  userId: string;
  name: string;
  email: string | null;
}

export async function ensureOrganizationMember(
  orgId: string,
  userId: string,
): Promise<OrganizationMemberProfile | null> {
  const [localMembership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  const [organization] = await db
    .select({ externalId: organizations.externalId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!organization?.externalId) {
    return localMembership ? { userId, name: "", email: null } : null;
  }

  const memberships = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId: organization.externalId,
    userId: [userId],
    limit: 1,
  });
  const membership = memberships.data[0];
  const publicUser = membership?.publicUserData;
  if (!membership || !publicUser || publicUser.userId !== userId) return null;

  await db
    .insert(organizationMembers)
    .values({
      orgId,
      userId,
      role: mapClerkOrganizationRole(membership.role),
    })
    .onConflictDoUpdate({
      target: [organizationMembers.orgId, organizationMembers.userId],
      set: { role: mapClerkOrganizationRole(membership.role) },
    });

  return {
    userId,
    name: [publicUser.firstName, publicUser.lastName].filter(Boolean).join(" "),
    email: publicUser.identifier || null,
  };
}
