import { createHash } from "node:crypto";
import type { OrgMemberRole } from "@workspace/db";

const MAX_ORGANIZATION_SLUG_LENGTH = 63;
const SLUG_SUFFIX_LENGTH = 10;

export interface ClerkOrganizationMembershipSnapshot {
  role: string;
  organization: {
    id: string;
    name: string;
    slug?: string | null;
  };
}

export interface OrganizationUpsertPlan {
  organization: {
    externalId: string;
    name: string;
    slug: string;
    updatedAt: Date;
  };
  membership: {
    userId: string;
    role: OrgMemberRole;
  };
}

export function mapClerkOrganizationRole(role: string): OrgMemberRole {
  return role === "org:admin" ? "admin" : "member";
}

export function createSafeOrganizationSlug(
  name: string,
  clerkSlug: string | null | undefined,
  externalId: string,
): string {
  const normalizedExternalId = requiredValue(externalId, "organization.id");
  const source = clerkSlug?.trim() || name;
  const normalizedBase =
    source
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "organization";
  const suffix = createHash("sha256")
    .update(normalizedExternalId)
    .digest("hex")
    .slice(0, SLUG_SUFFIX_LENGTH);
  const maxBaseLength = MAX_ORGANIZATION_SLUG_LENGTH - suffix.length - 1;
  const base =
    normalizedBase.slice(0, maxBaseLength).replace(/-+$/g, "") ||
    "organization";

  return `${base}-${suffix}`;
}

export function buildOrganizationUpsertPlan(
  userId: string,
  membership: ClerkOrganizationMembershipSnapshot,
  now: Date = new Date(),
): OrganizationUpsertPlan {
  const normalizedUserId = requiredValue(userId, "user.id");
  const externalId = requiredValue(
    membership.organization.id,
    "organization.id",
  );
  const name = normalizeOrganizationName(membership.organization.name);

  return {
    organization: {
      externalId,
      name,
      slug: createSafeOrganizationSlug(
        name,
        membership.organization.slug,
        externalId,
      ),
      updatedAt: now,
    },
    membership: {
      userId: normalizedUserId,
      role: mapClerkOrganizationRole(membership.role),
    },
  };
}

function normalizeOrganizationName(name: string): string {
  const normalized = requiredValue(name, "organization.name")
    .replace(/\s+/g, " ")
    .slice(0, 160)
    .trim();

  return requiredValue(normalized, "organization.name");
}

function requiredValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Clerk returned an invalid ${field}.`);
  }
  return normalized;
}
