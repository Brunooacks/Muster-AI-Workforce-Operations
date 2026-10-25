import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
  agents,
  agentApiKeys,
  eventOutbox,
  areas,
  teams,
  purposes,
  connectors,
  journeys,
  catalogMetrics,
  discoveryRuns,
  agentDrafts,
  metricEvidence,
  externalEventReceipts,
} from "@workspace/db/schema";
import type { EnvironmentKind } from "@workspace/db/schema";

/**
 * Escopo por organização (gauntlet rodada 6).
 *
 * O problema que este módulo resolve: `requireOrg` identifica o tenant e as
 * escritas gravam `org_id`, mas a leitura só isola se **cada** consulta se
 * lembrar de filtrar — e são dezenas. Uma esquecida não quebra teste nenhum:
 * apenas devolve, silenciosamente, o dado de outro cliente.
 *
 * A resposta aqui é dupla: um lugar único para expressar o escopo, e um teste
 * que varre o código-fonte procurando leitura de entidade-raiz sem filtro. A
 * disciplina deixa de depender de memória.
 */

/** Tabelas-raiz: pertencem diretamente a uma organização. */
export const ROOT_TABLES = {
  agents,
  areas,
  teams,
  purposes,
  connectors,
  journeys,
  catalogMetrics,
  discoveryRuns,
  agentDrafts,
  metricEvidence,
  externalEventReceipts,
} as const;

export type RootTableName = keyof typeof ROOT_TABLES;

/** Qualquer tabela-raiz: o que as define é ter a coluna de organização. */
export interface TabelaComOrg {
  orgId: PgColumn;
}

/** Predicado de escopo, para compor com os demais filtros da consulta. */
export function ofOrg(table: TabelaComOrg, orgId: string): SQL {
  return eq(table.orgId, orgId);
}

/**
 * Combina o escopo com outros predicados. Preferir a esta sobre montar o `and`
 * à mão: aqui o `orgId` é obrigatório na assinatura, então não há como escrever
 * a consulta e esquecer dele.
 */
export function inOrg(
  table: TabelaComOrg,
  orgId: string,
  ...rest: Array<SQL | undefined>
): SQL {
  const filtros = rest.filter((r): r is SQL => r !== undefined);
  return filtros.length === 0 ? ofOrg(table, orgId) : and(ofOrg(table, orgId), ...filtros)!;
}

/**
 * Predicado para filtrar uma entidade filha pelos agentes da organização.
 * Devolve `undefined` quando a organização não tem agente algum — nesse caso a
 * consulta deve retornar vazio, e o chamador precisa tratar isso explicitamente
 * em vez de omitir o filtro (omitir devolveria a base inteira).
 */
export function byAgentsOf(
  column: PgColumn,
  agentIds: string[],
): SQL | undefined {
  return agentIds.length === 0 ? undefined : inArray(column, agentIds);
}

// --- Projeto e ambiente (E1) --------------------------------------------------

/**
 * Tabelas com `project_id` (D-E1-3). Nelas, quem entra por chave de agente lê
 * e escreve só com `inProject`/`inEnv`; o scanner de `tenant-scope.test.ts`
 * cobra isso. `event_outbox` também tem ambiente.
 */
export const PROJECT_TABLES = {
  agents,
  agentApiKeys,
  eventOutbox,
} as const;

export type ProjectTableName = keyof typeof PROJECT_TABLES;

export function tabelaTemProjeto(nome: string): nome is ProjectTableName {
  return Object.hasOwn(PROJECT_TABLES, nome);
}

/**
 * O tenant completo de uma requisição. Sessão humana tem só `orgId` (segue
 * org-wide); chave de agente tem os quatro campos.
 */
export interface TenantScope {
  orgId: string;
  projectId?: string;
  environmentId?: string;
  environmentKind?: EnvironmentKind;
}

export type ProjectScope = TenantScope & { projectId: string };
export type EnvironmentScope = ProjectScope & { environmentId: string };

export interface TabelaComProjeto extends TabelaComOrg {
  projectId: PgColumn;
}

export interface TabelaComAmbiente extends TabelaComProjeto {
  environmentId: PgColumn;
}

/**
 * Conta + projeto, compondo com os demais filtros. O projeto é obrigatório no
 * tipo: escopo sem projeto usa `inOrg`, de forma explícita.
 */
export function inProject(
  table: TabelaComProjeto,
  scope: ProjectScope,
  ...rest: Array<SQL | undefined>
): SQL {
  return inOrg(table, scope.orgId, eq(table.projectId, scope.projectId), ...rest);
}

/** Conta + projeto + ambiente. */
export function inEnv(
  table: TabelaComAmbiente,
  scope: EnvironmentScope,
  ...rest: Array<SQL | undefined>
): SQL {
  return inProject(table, scope, eq(table.environmentId, scope.environmentId), ...rest);
}

/**
 * Regra de ambiente para a chave de agente (D-E1-4 + decisão em aberto 1):
 * - mesmo ambiente → permitido;
 * - chave sandbox pedindo prod → proibido (403);
 * - chave prod pedindo sandbox → inexistente (404: o recurso não existe
 *   naquele ambiente para essa chave).
 */
export type DecisaoDeAmbiente = "permitido" | "proibido" | "inexistente";

export function decidirAmbiente(
  daChave: EnvironmentKind,
  pedido: EnvironmentKind,
): DecisaoDeAmbiente {
  if (daChave === pedido) return "permitido";
  return daChave === "sandbox" ? "proibido" : "inexistente";
}

