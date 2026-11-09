import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, agents, agentApiKeys, environments } from "@workspace/db";
import type { EnvironmentKind } from "@workspace/db";
import { CreateAgentApiKeyBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
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
export function toAgentApiKey(row: KeyRow, environment: EnvironmentKind) {
  return {
    id: row.id,
    agentId: row.agentId,
    projectId: row.projectId,
    environment,
    label: row.label ?? null,
    prefix: row.prefix,
    masked: maskAgentApiKey(row.prefix, environment),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revoked: row.revokedAt !== null,
  };
}

/** Agente da conta, com o projeto dele (a chave nasce no projeto do agente). */
async function agentOfOrg(agentId: string, orgId: string): Promise<{ id: string; projectId: string } | null> {
  // Sessão humana segue org-wide (E1); o projeto vem do próprio agente.
  const [row] = await db
    .select({ id: agents.id, projectId: agents.projectId })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

router.get("/agents/:agentId/api-keys", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const orgId = req.orgId!;
  const agent = await agentOfOrg(agentId, orgId);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }
  const rows = await db
    .select({ key: agentApiKeys, environment: environments.kind })
    .from(agentApiKeys)
    .innerJoin(environments, eq(environments.id, agentApiKeys.environmentId))
    .where(
      and(
        eq(agentApiKeys.agentId, agentId),
        eq(agentApiKeys.orgId, orgId),
        eq(agentApiKeys.projectId, agent.projectId),
      ),
    )
    .orderBy(desc(agentApiKeys.createdAt));
  res.json(rows.map((r) => toAgentApiKey(r.key, r.environment)));
});

router.post("/agents/:agentId/api-keys", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const agentId = req.params.agentId as string;
  const orgId = req.orgId!;
  const agent = await agentOfOrg(agentId, orgId);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const parsed = CreateAgentApiKeyBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Corpo inválido: label é texto e environment é sandbox ou prod." });
    return;
  }
  const label = parsed.data.label?.trim() ? parsed.data.label.trim().slice(0, 120) : null;
  // Sem escolha, a chave é de produção: o comportamento de antes da E1.
  const environment: EnvironmentKind = parsed.data.environment ?? "prod";
  const [env] = await db
    .select({ id: environments.id })
    .from(environments)
    .where(
      and(
        eq(environments.orgId, orgId),
        eq(environments.projectId, agent.projectId),
        eq(environments.kind, environment),
      ),
    )
    .limit(1);
  if (!env) throw new Error(`Projeto ${agent.projectId} sem ambiente ${environment}.`);

  const generated = generateAgentApiKey(environment);
  const [row] = await db
    .insert(agentApiKeys)
    .values({
      orgId,
      agentId,
      projectId: agent.projectId,
      environmentId: env.id,
      label,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      createdBy: req.userId ?? null,
    })
    .returning();

  // The only moment the plaintext exists outside the caller's memory. It is not
  // logged and cannot be recovered — losing it means issuing a new key.
  res.status(201).json({
    key: toAgentApiKey(row!, environment),
    plaintext: generated.plaintext,
  });
});

router.post("/agents/:agentId/api-keys/:keyId/revoke", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
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
  const [env] = await db
    .select({ kind: environments.kind })
    .from(environments)
    .where(and(eq(environments.id, row.environmentId), eq(environments.orgId, req.orgId!)))
    .limit(1);
  res.json(toAgentApiKey(row, env?.kind ?? "prod"));
});

export default router;
