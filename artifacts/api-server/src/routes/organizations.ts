import { getAuth } from "@clerk/express";
import {
  Router,
  type IRouter,
  type Request,
  type RequestHandler,
} from "express";
import {
  createSafeOrganizationSlug,
  mapClerkOrganizationRole,
  type ClerkOrganizationMembershipSnapshot,
} from "../lib/organization-lifecycle";
import {
  listClerkOrganizationMemberships,
  listLocalOrganizationsByExternalIds,
  provisionClerkOrganization,
  type LocalOrganizationSnapshot,
  type ProvisionedOrganization,
} from "../lib/organization-provisioning";
import { requireAuth } from "../middlewares/requireAuth";

interface AuthenticatedOrganizationContext {
  userId: string | null;
  activeOrganizationId: string | null;
}

export interface OrganizationRouteDependencies {
  requireAuth: RequestHandler;
  readAuth: (req: Request) => AuthenticatedOrganizationContext;
  listMemberships: (
    userId: string,
  ) => Promise<ClerkOrganizationMembershipSnapshot[]>;
  listLocalOrganizations: (
    externalIds: string[],
  ) => Promise<LocalOrganizationSnapshot[]>;
  provisionOrganization: (
    userId: string,
    membership: ClerkOrganizationMembershipSnapshot,
  ) => Promise<ProvisionedOrganization>;
}

export interface OrganizationRouteHandlers {
  list: RequestHandler;
  syncActive: RequestHandler;
}

const defaultDependencies: OrganizationRouteDependencies = {
  requireAuth,
  readAuth: readClerkAuth,
  listMemberships: listClerkOrganizationMemberships,
  listLocalOrganizations: listLocalOrganizationsByExternalIds,
  provisionOrganization: provisionClerkOrganization,
};

export function createOrganizationsRouter(
  dependencies: OrganizationRouteDependencies = defaultDependencies,
): IRouter {
  const router: IRouter = Router();
  const handlers = createOrganizationRouteHandlers(dependencies);

  router.get("/organizations", dependencies.requireAuth, handlers.list);
  router.post(
    "/organizations/active/sync",
    dependencies.requireAuth,
    handlers.syncActive,
  );

  return router;
}

export function createOrganizationRouteHandlers(
  dependencies: OrganizationRouteDependencies,
): OrganizationRouteHandlers {
  return {
    list: async (req, res) => {
      const auth = dependencies.readAuth(req);
      const userId = auth.userId ?? req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const memberships = await dependencies.listMemberships(userId);
      const localOrganizations = await dependencies.listLocalOrganizations(
        memberships.map((membership) => membership.organization.id),
      );
      const localByExternalId = new Map(
        localOrganizations.map((organization) => [
          organization.externalId,
          organization,
        ]),
      );

      res.json({
        organizations: memberships.map((membership) => {
          const externalId = membership.organization.id;
          const local = localByExternalId.get(externalId);
          return {
            id: local?.id ?? null,
            externalId,
            name: membership.organization.name,
            slug:
              local?.slug ??
              createSafeOrganizationSlug(
                membership.organization.name,
                membership.organization.slug,
                externalId,
              ),
            role: mapClerkOrganizationRole(membership.role),
            providerRole: membership.role,
            active: auth.activeOrganizationId === externalId,
            provisioned: Boolean(local),
          };
        }),
      });
    },
    syncActive: async (req, res) => {
      const auth = dependencies.readAuth(req);
      const userId = auth.userId ?? req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!auth.activeOrganizationId) {
        res.status(409).json({
          error: "Selecione uma organização ativa no Clerk antes de continuar.",
          code: "ACTIVE_ORGANIZATION_REQUIRED",
        });
        return;
      }

      const memberships = await dependencies.listMemberships(userId);
      const activeMembership = memberships.find(
        (membership) =>
          membership.organization.id === auth.activeOrganizationId,
      );
      if (!activeMembership) {
        res.status(403).json({
          error: "A organização ativa não pertence ao usuário autenticado.",
          code: "ORGANIZATION_MEMBERSHIP_REQUIRED",
        });
        return;
      }

      const organization = await dependencies.provisionOrganization(
        userId,
        activeMembership,
      );
      req.orgId = organization.id;
      res.json({ organization });
    },
  };
}

function readClerkAuth(req: Request): AuthenticatedOrganizationContext {
  const auth = getAuth(req);
  const claimedUserId = auth.sessionClaims?.userId;
  const claimedOrganizationId = auth.sessionClaims?.org_id;

  return {
    userId:
      auth.userId ?? (typeof claimedUserId === "string" ? claimedUserId : null),
    activeOrganizationId:
      auth.orgId ??
      (typeof claimedOrganizationId === "string"
        ? claimedOrganizationId
        : null),
  };
}

export default createOrganizationsRouter();
