import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, agentApiKeys } from "@workspace/db";
import {
  agentApiKeyMatches,
  bearerFrom,
  parseAgentApiKey,
} from "../lib/agent-api-key";
import { authDevBypass, requireAuth } from "./requireAuth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set when the request authenticated as an agent, not as a human. */
      agentCredentialId?: string;
    }
  }
}

/**
 * Authenticates telemetry ingestion as the AGENT itself (gauntlet rodada 3).
 *
 * An agent running in the customer's infrastructure must not hold a human
 * session, so ingest accepts a per-agent API key: `Authorization: Bearer
 * msk_live_<prefix>_<secret>`. The key is scoped to exactly one agent — a valid
 * key for agent A cannot report for agent B.
 *
 * Transition rule (deliberate, and tested): when AUTH_DEV_BYPASS is active —
 * which is impossible in production, see requireAuth — a request WITHOUT any
 * bearer token still falls back to session auth, so local tooling and the
 * demo keep working. A token that is *present but invalid or revoked* is always
 * rejected, in every environment: presenting a bad credential is never treated
 * as "no credential".
 */
export async function requireAgentCredential(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = bearerFrom(req.header("authorization"));
  const parsed = parseAgentApiKey(token);

  // No agent key presented at all.
  if (!parsed) {
    // A bearer token that is not a Muster agent key may still be a Clerk
    // session JWT — let the human auth path decide.
    if (authDevBypass || token) {
      requireAuth(req, res, next);
      return;
    }
    res.status(401).json({ error: "Credencial do agente ausente." });
    return;
  }

  const agentId = req.params.agentId as string | undefined;
  const [record] = await db
    .select()
    .from(agentApiKeys)
    .where(and(eq(agentApiKeys.prefix, parsed.prefix), isNull(agentApiKeys.revokedAt)))
    .limit(1);

  // Same generic message for unknown, revoked and mismatched keys: telling the
  // caller *which* of the three failed would help an attacker enumerate.
  if (!record || !agentApiKeyMatches(token as string, record.keyHash)) {
    res.status(401).json({ error: "Credencial do agente inválida ou revogada." });
    return;
  }
  if (agentId && record.agentId !== agentId) {
    res.status(401).json({ error: "Credencial do agente inválida ou revogada." });
    return;
  }

  req.agentCredentialId = record.id;
  req.userId = `agent:${record.agentId}`;

  // Best-effort usage stamp: it powers "última vez que este agente reportou"
  // in the UI and must never delay or fail the ingest itself.
  void db
    .update(agentApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentApiKeys.id, record.id))
    .catch(() => undefined);

  next();
}
