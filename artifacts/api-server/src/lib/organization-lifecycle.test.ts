import { describe, expect, it } from "vitest";
import {
  buildOrganizationUpsertPlan,
  createSafeOrganizationSlug,
  mapClerkOrganizationRole,
} from "./organization-lifecycle";

describe("organization lifecycle", () => {
  it("maps only Clerk administrators to the basic admin role", () => {
    expect(mapClerkOrganizationRole("org:admin")).toBe("admin");
    expect(mapClerkOrganizationRole("org:member")).toBe("member");
    expect(mapClerkOrganizationRole("org:owner")).toBe("member");
    expect(mapClerkOrganizationRole("org:custom-role")).toBe("member");
  });

  it("creates a deterministic, bounded and tenant-specific safe slug", () => {
    const first = createSafeOrganizationSlug(
      "Árvore & Operações / Brasil",
      null,
      "org_clerk_123",
    );
    const repeated = createSafeOrganizationSlug(
      "Árvore & Operações / Brasil",
      null,
      "org_clerk_123",
    );
    const anotherTenant = createSafeOrganizationSlug(
      "Árvore & Operações / Brasil",
      null,
      "org_clerk_456",
    );

    expect(first).toMatch(/^arvore-operacoes-brasil-[a-f0-9]{10}$/);
    expect(first).toBe(repeated);
    expect(first).not.toBe(anotherTenant);
    expect(first.length).toBeLessThanOrEqual(63);
  });

  it("builds an upsert plan exclusively from the authenticated Clerk membership", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const plan = buildOrganizationUpsertPlan(
      " user_clerk_123 ",
      {
        role: "org:admin",
        organization: {
          id: "org_clerk_123",
          name: "  Muster   Brasil  ",
          slug: "muster-brasil",
        },
      },
      now,
    );

    expect(plan).toEqual({
      organization: {
        externalId: "org_clerk_123",
        name: "Muster Brasil",
        slug: expect.stringMatching(/^muster-brasil-[a-f0-9]{10}$/),
        updatedAt: now,
      },
      membership: {
        userId: "user_clerk_123",
        role: "admin",
      },
    });
  });

  it("fails closed when Clerk returns an invalid organization", () => {
    expect(() =>
      buildOrganizationUpsertPlan("user_1", {
        role: "org:member",
        organization: { id: " ", name: "Muster" },
      }),
    ).toThrow("organization.id");
  });
});
