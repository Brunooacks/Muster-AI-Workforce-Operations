import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, agents, agentApiKeys, eventOutbox } from "@workspace/db";
import { inEnv, inProject } from "../lib/tenant-scope";
import {
  AGENTE_NAO_ENCONTRADO,
  agentScopeOf,
  requireAgentCredential,
} from "../middlewares/requireAgentCredential";
import { toAgentApiKey } from "./agent-keys";

/**
 * Leituras do runtime do agente (E1): o que uma chave enxerga do próprio
 * projeto e ambiente. Só chave de agente entra aqui — sessão humana usa as
 * rotas de /agents. Toda consulta usa `inProject`/`inEnv` com o escopo que o
 * middleware resolveu da chave; o scanner de tenant-scope.test.ts cobra isso
 * neste arquivo sem exceção.
 */

const router: IRouter = Router();

/** Recusa quem não entrou por chave de agente (ex.: JWT humano). */
function soChave(req: Parameters<Parameters<IRouter["get"]>[1]>[0]): boolean {
  return Boolean(req.agentCredentialId && req.projectId && req.environmentId);
}

const EVENTOS_POR_PAGINA = 50;

router.get("/runtime/agents", requireAgentCredential, async (req, res) => {
  if (!soChave(req)) {
    res.status(401).json({ error: "Rota exclusiva de chave de agente." });
    return;
  }
  const rows = await db
    .select({ id: agents.id, name: agents.name, slug: agents.slug, projectId: agents.projectId })
    .from(agents)
    .where(inProject(agents, agentScopeOf(req)))
    .orderBy(asc(agents.slug));
  res.json(rows);
});

router.get("/runtime/agents/:agentId", requireAgentCredential, async (req, res) => {
  if (!soChave(req)) {
    res.status(401).json({ error: "Rota exclusiva de chave de agente." });
    return;
  }
  const [row] = await db
    .select({ id: agents.id, name: agents.name, slug: agents.slug, projectId: agents.projectId })
    .from(agents)
    .where(inProject(agents, agentScopeOf(req), eq(agents.id, req.params.agentId as string)))
    .limit(1);
  if (!row) {
    res.status(404).json(AGENTE_NAO_ENCONTRADO);
    return;
  }
  res.json(row);
});

router.get("/runtime/agents/:agentId/events", requireAgentCredential, async (req, res) => {
  if (!soChave(req)) {
    res.status(401).json({ error: "Rota exclusiva de chave de agente." });
    return;
  }
  const scope = agentScopeOf(req);
  const rows = await db
    .select({
      id: eventOutbox.id,
      eventType: eventOutbox.eventType,
      status: eventOutbox.status,
      projectId: eventOutbox.projectId,
      createdAt: eventOutbox.createdAt,
    })
    .from(eventOutbox)
    .where(
      inEnv(
        eventOutbox,
        scope,
        eq(eventOutbox.aggregateType, "agent"),
        eq(eventOutbox.aggregateId, req.params.agentId as string),
      ),
    )
    .orderBy(desc(eventOutbox.createdAt))
    .limit(EVENTOS_POR_PAGINA);
  res.json(
    rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      status: r.status,
      projectId: r.projectId!,
      environment: scope.environmentKind,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.get("/runtime/agents/:agentId/api-keys", requireAgentCredential, async (req, res) => {
  if (!soChave(req)) {
    res.status(401).json({ error: "Rota exclusiva de chave de agente." });
    return;
  }
  const scope = agentScopeOf(req);
  const rows = await db
    .select()
    .from(agentApiKeys)
    .where(inEnv(agentApiKeys, scope, eq(agentApiKeys.agentId, req.params.agentId as string)))
    .orderBy(desc(agentApiKeys.createdAt));
  res.json(rows.map((row) => toAgentApiKey(row, scope.environmentKind)));
});

export default router;
