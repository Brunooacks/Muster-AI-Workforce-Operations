import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { connectorApiKeys, db } from "@workspace/db";
import { bearerFrom } from "../lib/agent-api-key";
import {
  connectorApiKeyMatches,
  parseConnectorApiKey,
} from "../lib/connector-api-key";

declare global {
  namespace Express {
    interface Request {
      connectorCredentialId?: string;
      integrationConnectorId?: string;
    }
  }
}

export async function requireIntegrationCredential(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = bearerFrom(req.header("authorization"));
  const parsed = parseConnectorApiKey(token);

  if (!parsed) {
    res.status(401).json({
      error: token
        ? "Credencial da integração inválida ou revogada."
        : "Credencial da integração ausente.",
    });
    return;
  }

  const [record] = await db
    .select()
    .from(connectorApiKeys)
    .where(
      and(
        eq(connectorApiKeys.prefix, parsed.prefix),
        isNull(connectorApiKeys.revokedAt),
      ),
    )
    .limit(1);

  if (!record || !connectorApiKeyMatches(token as string, record.keyHash)) {
    res.status(401).json({ error: "Credencial da integração inválida ou revogada." });
    return;
  }

  req.connectorCredentialId = record.id;
  req.integrationConnectorId = record.connectorId;
  req.userId = `connector:${record.connectorId}`;
  req.orgId = record.orgId;

  void db
    .update(connectorApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(connectorApiKeys.id, record.id))
    .catch(() => undefined);

  next();
}
