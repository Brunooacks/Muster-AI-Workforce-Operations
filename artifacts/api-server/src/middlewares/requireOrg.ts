import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, organizations, organizationMembers } from "@workspace/db";
import { resolveActiveOrganizationId } from "../lib/active-organization";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Tenant scope of this request. Every root-entity query MUST filter by it. */
      orgId?: string;
    }
  }
}

/** Slug/id da organização de acolhimento criada pela migration 0009. */
export const DEFAULT_ORG_ID = "org_default";

/**
 * Resolve a organização da requisição (tenancy, gauntlet rodada 4).
 *
 * Precedência:
 *  1. Organização ativa na sessão do provedor de identidade (Clerk `org_id`),
 *     casada por `organizations.external_id`.
 *  2. Não há fallback para o único vínculo: a organização ativa precisa estar
 *     selecionada na sessão do Clerk.
 * Falha fechada: sem organização resolvida, a requisição para em 403. É
 * preferível recusar uma leitura legítima a servir dado de outro cliente.
 */
export async function requireOrg(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Uma credencial de agente já carrega o tenant: o middleware de ingestão
  // resolveu a chave e gravou a organização dona do agente.
  if (req.orgId) {
    next();
    return;
  }

  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const claimedOrg = readSessionOrgId(req);
  if (claimedOrg) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.externalId, claimedOrg))
      .limit(1);
    // A organização da sessão só vale se o vínculo existir aqui também —
    // confiar apenas no claim deixaria o tenant à mercê do token.
    if (org) {
      const [member] = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.orgId, org.id),
            eq(organizationMembers.userId, userId),
          ),
        )
        .limit(1);
      if (member) {
        req.orgId = org.id;
        next();
        return;
      }
    }
  }

  res.status(403).json({
    error: "Selecione uma organização ativa antes de acessar dados do tenant.",
    code: "ACTIVE_ORGANIZATION_REQUIRED",
  });
}

function readSessionOrgId(req: Request): string | null {
  const auth = getAuth(req);
  return resolveActiveOrganizationId(auth?.orgId, auth?.sessionClaims);
}
