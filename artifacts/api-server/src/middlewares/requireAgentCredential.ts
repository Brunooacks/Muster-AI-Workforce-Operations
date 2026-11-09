import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, agents, agentApiKeys, environments } from "@workspace/db";
import type { EnvironmentKind } from "@workspace/db";
import {
  agentApiKeyMatches,
  bearerFrom,
  parseAgentApiKey,
} from "../lib/agent-api-key";
import { decidirAmbiente, inProject, type AgentKeyScope } from "../lib/tenant-scope";
import { requireAuth } from "./requireAuth";
import { requireOrg } from "./requireOrg";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set when the request authenticated as an agent, not as a human. */
      agentCredentialId?: string;
      /** Agente dono da chave (só com credencial de agente). */
      agentCredentialAgentId?: string;
      /** Projeto e ambiente da chave (E1). Sessão humana não preenche. */
      projectId?: string;
      environmentId?: string;
      environmentKind?: EnvironmentKind;
    }
  }
}

// Corpos fixos: o 404 de recurso de outro projeto/conta precisa ser byte a
// byte igual ao de recurso inexistente (D-E1-4), senão a diferença vira
// oráculo de enumeração.
export const CREDENCIAL_AUSENTE = { error: "Credencial do agente ausente." } as const;
export const CREDENCIAL_INVALIDA = { error: "Credencial do agente inválida ou revogada." } as const;
export const AGENTE_NAO_ENCONTRADO = { error: "Agente não encontrado." } as const;
export const PROJETO_NAO_ENCONTRADO = { error: "Projeto não encontrado." } as const;
export const SANDBOX_SEM_PROD = { error: "Chave de sandbox não acessa produção." } as const;
export const AMBIENTE_INVALIDO = { error: "environment deve ser sandbox ou prod." } as const;

/** Escopo resolvido de uma requisição autenticada por chave de agente. */
export function agentScopeOf(req: Request): AgentKeyScope {
  return {
    orgId: req.orgId!,
    projectId: req.projectId!,
    environmentId: req.environmentId!,
    environmentKind: req.environmentKind!,
  };
}

function textoDe(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

/**
 * Ambiente pedido: `?environment=` ou `environment` no corpo; ausente = o da
 * chave. Devolve `null` quando o valor não é um ambiente.
 */
export function ambientePedido(req: Request): EnvironmentKind | undefined | null {
  const bruto =
    textoDe((req.query as Record<string, unknown> | undefined)?.environment) ??
    textoDe((req.body as Record<string, unknown> | undefined)?.environment);
  if (bruto === undefined) return undefined;
  return bruto === "sandbox" || bruto === "prod" ? bruto : null;
}

/**
 * Authenticates an agent by its API key and resolves the full tenant tuple
 * (conta, projeto, ambiente) from it (gauntlet rodada 3 + E1).
 *
 * An agent running in the customer's infrastructure must not hold a human
 * session, so agent routes accept `Authorization: Bearer msk_live_…` (prod) or
 * `msk_sbx_…` (sandbox). Evaluation order (spec 003):
 *
 * 1. token malformed/unknown/revoked, or label ≠ stored environment → 401;
 * 2. project (`?project=`) or agent (`:agentId`) outside the key's project or
 *    account → 404, same body as "does not exist";
 * 3. requested environment: sandbox key asking prod → 403; prod key asking
 *    sandbox → 404 (decisão em aberto 1, adotada como proposta);
 * 4. `:agentId` of another agent of the same project → 404 (was 401);
 * 5. next().
 *
 * A bearer token that is not a Muster agent key may still be a Clerk session
 * JWT — that path stays org-wide, as before.
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
    if (token) {
      // Encadeia a resolução de organização: sem ela, as consultas do ingest
      // filtrariam por um orgId indefinido e devolveriam 404 para agente que
      // existe. Quem entra por credencial já teve a organização definida acima.
      requireAuth(req, res, () => {
        void requireOrg(req, res, next);
      });
      return;
    }
    res.status(401).json(CREDENCIAL_AUSENTE);
    return;
  }

  // Busca por prefixo antes de existir tenant: o prefixo é o próprio
  // identificador global da chave. O join traz o ambiente do mesmo projeto da
  // chave (agentApiKeys.projectId), que é o que ela pode alcançar.
  const [record] = await db
    .select({ key: agentApiKeys, environmentKind: environments.kind })
    .from(agentApiKeys)
    .innerJoin(
      environments,
      and(
        eq(environments.id, agentApiKeys.environmentId),
        eq(environments.projectId, agentApiKeys.projectId),
      ),
    )
    .where(and(eq(agentApiKeys.prefix, parsed.prefix), isNull(agentApiKeys.revokedAt)))
    .limit(1);

  // Same generic message for unknown, revoked and mismatched keys: telling the
  // caller *which* failed would help an attacker enumerate.
  if (
    !record ||
    !agentApiKeyMatches(token as string, record.key.keyHash) ||
    record.environmentKind !== parsed.environment
  ) {
    res.status(401).json(CREDENCIAL_INVALIDA);
    return;
  }

  const scope: AgentKeyScope = {
    orgId: record.key.orgId,
    projectId: record.key.projectId,
    environmentId: record.key.environmentId,
    environmentKind: record.environmentKind,
  };
  const agentId = req.params.agentId as string | undefined;
  const naoEncontrado = agentId ? AGENTE_NAO_ENCONTRADO : PROJETO_NAO_ENCONTRADO;

  const pedido = ambientePedido(req);
  if (pedido === null) {
    res.status(400).json(AMBIENTE_INVALIDO);
    return;
  }

  // 2 · projeto/conta. O filtro por projeto da chave faz agente de outro
  // projeto ou de outra conta cair no mesmo "não existe".
  const projetoPedido = textoDe((req.query as Record<string, unknown> | undefined)?.project);
  if (projetoPedido !== undefined && projetoPedido !== scope.projectId) {
    res.status(404).json(naoEncontrado);
    return;
  }
  if (agentId) {
    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(inProject(agents, scope, eq(agents.id, agentId)))
      .limit(1);
    if (!agent) {
      res.status(404).json(AGENTE_NAO_ENCONTRADO);
      return;
    }
  }

  // 3 · ambiente.
  const decisao = decidirAmbiente(scope.environmentKind, pedido ?? scope.environmentKind);
  if (decisao === "proibido") {
    res.status(403).json(SANDBOX_SEM_PROD);
    return;
  }
  if (decisao === "inexistente") {
    res.status(404).json(naoEncontrado);
    return;
  }

  // 4 · a chave é de exatamente um agente.
  if (agentId && record.key.agentId !== agentId) {
    res.status(404).json(AGENTE_NAO_ENCONTRADO);
    return;
  }

  req.agentCredentialId = record.key.id;
  req.agentCredentialAgentId = record.key.agentId;
  req.userId = `agent:${record.key.agentId}`;
  // A credencial já carrega o tenant: as consultas filtram por conta, projeto
  // e ambiente sem depender de sessão humana.
  req.orgId = scope.orgId;
  req.projectId = scope.projectId;
  req.environmentId = scope.environmentId;
  req.environmentKind = scope.environmentKind;

  // Best-effort usage stamp: it powers "última vez que este agente reportou"
  // in the UI and must never delay or fail the request itself.
  void db
    .update(agentApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(inProject(agentApiKeys, scope, eq(agentApiKeys.id, record.key.id)))
    .catch(() => undefined);

  next();
}
