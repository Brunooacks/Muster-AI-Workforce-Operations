import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { agents, areas, teams, purposes, connectors, journeys, catalogMetrics, discoveryRuns, agentDrafts } from "@workspace/db/schema";

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
