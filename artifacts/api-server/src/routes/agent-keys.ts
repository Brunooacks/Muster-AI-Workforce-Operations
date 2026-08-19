import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, agents, agentApiKeys } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { generateAgentApiKey, maskAgentApiKey } from "../lib/agent-api-key";

const router: IRouter = Router();

/**
 * Credential management for agents (gauntlet rodada 3). These routes are for
 * HUMANS — creating and revoking a key requires a session, never an agent key,
 * so a leaked agent credential cannot mint new credentials for itself.
 */

type KeyRow = typeof agentApiKeys.$inferSelect;

/** Serializer — the single place that decides what leaves the server. The hash
 *  is never part of the shape, so no route can leak it by accident. */
function toAgentApiKey(row: KeyRow) {
  return {
    id: row.id,
    agentId: row.agentId,
    label: row.label ?? null,
    prefix: row.prefix,
    masked: maskAgentApiKey(row.prefix),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revoked: row.revokedAt !== null,
  };
}

async function agentBelongsToOrg(agentId: string, orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
    .limit(1);
  return !!row;
}

router.get("/agents/:agentId/api-keys", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const orgId = req.orgId!;
  if (!(await agentBelongsToOrg(agentId, orgId))) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }
  const rows = await db
    .select()
    .from(agentApiKeys)
    .where(and(eq(agentApiKeys.agentId, agentId), eq(agentApiKeys.orgId, orgId)))
    .orderBy(desc(agentApiKeys.createdAt));
  res.json(rows.map(toAgentApiKey));
});

router.post("/agents/:agentId/api-keys", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const orgId = req.orgId!;
  if (!(await agentBelongsToOrg(agentId, orgId))) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const label =
    typeof req.body?.label === "string" && req.body.label.trim()
      ? req.body.label.trim().slice(0, 120)
      : null;

  const generated = generateAgentApiKey();
  const [row] = await db
    .insert(agentApiKeys)
    .values({
      orgId,
      agentId,
      label,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      createdBy: req.userId ?? null,
    })
    .returning();

  // The only moment the plaintext exists outside the caller's memory. It is not
  // logged and cannot be recovered — losing it means issuing a new key.
  res.status(201).json({
    key: toAgentApiKey(row!),
    plaintext: generated.plaintext,
  });
});

router.post("/agents/:agentId/api-keys/:keyId/revoke", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const keyId = req.params.keyId as string;

  const [row] = await db
    .update(agentApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(agentApiKeys.id, keyId),
        eq(agentApiKeys.agentId, agentId),
        eq(agentApiKeys.orgId, req.orgId!),
      ),
    )
    .returning();

  if (!row) {
    res.status(404).json({ error: "Credencial não encontrada para este agente." });
    return;
  }
  res.json(toAgentApiKey(row));
});

export default router;
