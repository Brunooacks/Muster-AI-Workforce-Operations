import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, organizations, organizationMembers } from "@workspace/db";
import { authDevBypass } from "./requireAuth";

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
 *  2. Vínculo do usuário: se ele pertence a exatamente uma organização, é ela.
 *  3. Apenas com AUTH_DEV_BYPASS (impossível em produção): organização padrão,
 *     para que o ambiente local e a demo continuem funcionando.
 *
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

  const memberships = await db
    .select({ orgId: organizationMembers.orgId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(2);

  if (memberships.length === 1) {
    req.orgId = memberships[0]!.orgId;
    next();
    return;
  }
  if (memberships.length > 1) {
    // Ambíguo de propósito: com mais de um vínculo, o cliente precisa dizer
    // qual organização está operando, em vez de o servidor adivinhar.
    res.status(409).json({
      error: "Usuário pertence a mais de uma organização; selecione uma.",
    });
    return;
  }

  if (authDevBypass) {
    req.orgId = await ensureDevOrgMembership(userId);
    next();
    return;
  }

  res.status(403).json({ error: "Usuário sem organização." });
}

function readSessionOrgId(req: Request): string | null {
  const auth = (req as unknown as { auth?: { orgId?: string; sessionClaims?: Record<string, unknown> } }).auth;
  const fromClaims = auth?.sessionClaims?.["org_id"];
  return (auth?.orgId as string | undefined) ?? (typeof fromClaims === "string" ? fromClaims : null);
}

/** Local dev: garante que o usuário de bypass pertence à organização padrão. */
async function ensureDevOrgMembership(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, DEFAULT_ORG_ID),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!existing) {
    await db
      .insert(organizationMembers)
      .values({ orgId: DEFAULT_ORG_ID, userId, role: "owner" })
      .onConflictDoNothing();
  }
  return DEFAULT_ORG_ID;
}
