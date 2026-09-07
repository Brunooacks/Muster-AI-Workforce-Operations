import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  organizations: {},
  organizationMembers: {},
}));
vi.mock("../lib/catalog-seed", () => ({
  ensureCatalogSeed: vi.fn(),
}));

import { createOrganizationRouteHandlers } from "./organizations";

describe("organization lifecycle routes", () => {
  it("lists only organizations returned by Clerk for the authenticated user", async () => {
    const handlers = createOrganizationRouteHandlers({
      requireAuth: authenticatedAs("user_1"),
      readAuth: () => ({
        userId: "user_1",
        activeOrganizationId: "org_active",
      }),
      listMemberships: vi.fn().mockResolvedValue([
        {
          role: "org:admin",
          organization: {
            id: "org_active",
            name: "Active Company",
            slug: "active-company",
          },
        },
        {
          role: "org:member",
          organization: {
            id: "org_secondary",
            name: "Secondary Company",
            slug: "secondary-company",
          },
        },
      ]),
      listLocalOrganizations: vi.fn().mockResolvedValue([
        {
          id: "local_active",
          externalId: "org_active",
          name: "Active Company",
          slug: "active-company-local",
        },
      ]),
      provisionOrganization: vi.fn(),
    });

    const request = { userId: "user_1" } as Request;
    const response = responseMock();
    await handlers.list(request, response, vi.fn());
    const body = vi.mocked(response.json).mock.calls[0]![0] as {
      organizations: Array<Record<string, unknown>>;
    };

    expect(response.status).not.toHaveBeenCalled();
    expect(body.organizations).toHaveLength(2);
    expect(body.organizations[0]).toMatchObject({
      id: "local_active",
      externalId: "org_active",
      role: "admin",
      active: true,
      provisioned: true,
    });
    expect(body.organizations[1]).toMatchObject({
      id: null,
      externalId: "org_secondary",
      role: "member",
      active: false,
      provisioned: false,
    });
  });

  it("ignores client organization data and provisions the signed active membership", async () => {
    const activeMembership = {
      role: "org:admin",
      organization: {
        id: "org_active",
        name: "Authoritative Company",
        slug: "authoritative-company",
      },
    };
    const provisionOrganization = vi.fn().mockResolvedValue({
      id: "local_active",
      externalId: "org_active",
      name: "Authoritative Company",
      slug: "authoritative-company-local",
      role: "admin",
    });
    const handlers = createOrganizationRouteHandlers({
      requireAuth: authenticatedAs("user_1"),
      readAuth: () => ({
        userId: "user_1",
        activeOrganizationId: "org_active",
      }),
      listMemberships: vi.fn().mockResolvedValue([
        activeMembership,
        {
          role: "org:member",
          organization: {
            id: "org_other",
            name: "Other Company",
            slug: "other-company",
          },
        },
      ]),
      listLocalOrganizations: vi.fn(),
      provisionOrganization,
    });

    const request = {
      userId: "user_1",
      body: {
        orgId: "org_other",
        name: "Client Controlled Name",
        role: "owner",
      },
    } as Request;
    const response = responseMock();
    await handlers.syncActive(request, response, vi.fn());

    expect(response.status).not.toHaveBeenCalled();
    expect(provisionOrganization).toHaveBeenCalledWith(
      "user_1",
      activeMembership,
    );
  });

  it("refuses an active organization absent from the user's Clerk memberships", async () => {
    const provisionOrganization = vi.fn();
    const handlers = createOrganizationRouteHandlers({
      requireAuth: authenticatedAs("user_1"),
      readAuth: () => ({
        userId: "user_1",
        activeOrganizationId: "org_not_a_member",
      }),
      listMemberships: vi.fn().mockResolvedValue([]),
      listLocalOrganizations: vi.fn(),
      provisionOrganization,
    });

    const request = { userId: "user_1" } as Request;
    const response = responseMock();
    await handlers.syncActive(request, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(provisionOrganization).not.toHaveBeenCalled();
  });
});

function authenticatedAs(userId: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.userId = userId;
    next();
  };
}

function responseMock(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}
