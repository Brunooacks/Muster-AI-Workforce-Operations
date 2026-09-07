import { and, eq } from "drizzle-orm";
import type { NextFunction, RequestHandler, Response } from "express";
import {
  db,
  organizationMembers,
  type OrgMemberRole,
} from "@workspace/db";
import type { AuthenticatedRequest } from "./requireAuth";
import { authorizeOrgRole } from "../lib/org-authorization";

declare global {
  namespace Express {
    interface Request {
      orgRole?: OrgMemberRole;
    }
  }
}

/**
 * Alçada reutilizável da organização. Deve vir depois de requireAuth e
 * requireOrg: identidade e tenant são resolvidos antes da autorização.
 */
export function requireOrgRole(
  ...allowedRoles: readonly OrgMemberRole[]
): RequestHandler {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.orgId) {
      res.status(403).json({ error: "Organização não resolvida." });
      return;
    }

    try {
      const [membership] = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.orgId, req.orgId),
            eq(organizationMembers.userId, req.userId),
          ),
        )
        .limit(1);
      const decision = authorizeOrgRole(membership?.role ?? null, allowedRoles);
      if (!decision.authorized) {
        res.status(decision.status).json({
          error: "Forbidden",
          reason: "Permissão insuficiente nesta organização.",
        });
        return;
      }
      req.orgRole = decision.role;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Configuração, credenciais e estrutura organizacional. */
export const requireOrgAdmin = requireOrgRole("owner", "admin");

/** Operação cotidiana auditável, incluindo alertas e ações de veredito. */
export const requireOrgOperator = requireOrgRole("owner", "admin", "member");
