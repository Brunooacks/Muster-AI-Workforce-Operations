import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT_TABLES, inOrg, ofOrg, byAgentsOf } from "./tenant-scope";

/**
 * Guarda de isolamento.
 *
 * O risco desta base não é escrever o filtro errado — é esquecê-lo. Uma leitura
 * sem `orgId` não quebra teste nenhum: devolve, em silêncio, o dado de outro
 * cliente. Por isso o teste principal aqui não exercita comportamento, e sim
 * varre o código-fonte: qualquer consulta a tabela-raiz precisa mencionar
 * `orgId` por perto.
 *
 * Quando uma leitura for legitimamente global (bootstrap, seed, migração),
 * declare-a em ISENTAS com a justificativa. O custo de justificar é o ponto:
 * obriga a decisão a ser consciente.
 */

const DIR_ROTAS = join(import.meta.dirname, "..", "routes");

/**
 * Leituras que podem, e devem, ignorar a organização — cada uma com o motivo.
 * Formato: "arquivo.ts:trecho identificador".
 */
const ISENTAS: Array<{ arquivo: string; motivo: string }> = [
  { arquivo: "health.ts", motivo: "healthcheck não consulta dado de cliente" },
];

function arquivosDeRota(): string[] {
  return readdirSync(DIR_ROTAS).filter((f) => f.endsWith(".ts") && !f.includes(".test."));
}

/** Um bloco de consulta: da linha do `.from(tabela)` até o `;` que a encerra. */
function blocosDeLeitura(fonte: string, tabela: string): string[] {
  const linhas = fonte.split("\n");
  const blocos: string[] = [];
  for (let i = 0; i < linhas.length; i += 1) {
    if (!linhas[i]!.includes(`.from(${tabela})`)) continue;
    // Uma consulta drizzle é encadeada: o filtro pode estar antes (select) ou
    // depois (where). Uma janela de 8 linhas para cada lado cobre o encadeamento
    // sem invadir a consulta seguinte.
    const inicio = Math.max(0, i - 8);
    const fim = Math.min(linhas.length, i + 9);
    blocos.push(linhas.slice(inicio, fim).join("\n"));
  }
  return blocos;
}

describe("isolamento por organização — varredura do código", () => {
  const nomesDeTabela = Object.keys(ROOT_TABLES);

  it("nenhuma leitura de tabela-raiz nas rotas ignora a organização", () => {
    const faltando: string[] = [];

    for (const arquivo of arquivosDeRota()) {
      if (ISENTAS.some((e) => e.arquivo === arquivo)) continue;
      const fonte = readFileSync(join(DIR_ROTAS, arquivo), "utf8");

      for (const tabela of nomesDeTabela) {
        for (const bloco of blocosDeLeitura(fonte, tabela)) {
          const temEscopo =
            bloco.includes("orgId") ||
            bloco.includes("inOrg(") ||
            bloco.includes("ofOrg(") ||
            bloco.includes("agentIdsOfOrg");
          if (!temEscopo) {
            const linha = bloco.split("\n").find((l) => l.includes(`.from(${tabela})`))?.trim();
            faltando.push(`${arquivo} · ${tabela} · ${linha}`);
          }
        }
      }
    }

    // A mensagem lista cada ponto: o valor do teste é dizer onde corrigir, não
    // apenas que há algo errado.
    expect(
      faltando,
      `Leituras sem escopo de organização (${faltando.length}):\n  ${faltando.join("\n  ")}`,
    ).toEqual([]);
  });

  it("toda tabela-raiz declarada tem coluna orgId", () => {
    for (const [nome, tabela] of Object.entries(ROOT_TABLES)) {
      expect((tabela as { orgId?: unknown }).orgId, `${nome} sem orgId`).toBeDefined();
    }
  });
});

describe("helpers de escopo", () => {
  it("ofOrg gera o predicado de organização", () => {
    expect(ofOrg(ROOT_TABLES.agents, "org_x")).toBeDefined();
  });

  it("inOrg exige a organização e compõe com os demais filtros", () => {
    expect(inOrg(ROOT_TABLES.agents, "org_x")).toBeDefined();
    expect(inOrg(ROOT_TABLES.agents, "org_x", undefined)).toBeDefined();
  });

  it("byAgentsOf devolve undefined quando a organização não tem agentes", () => {
    // O chamador precisa tratar este caso devolvendo vazio; omitir o filtro
    // devolveria a base inteira, que é exatamente o vazamento que evitamos.
    expect(byAgentsOf(ROOT_TABLES.agents.id, [])).toBeUndefined();
    expect(byAgentsOf(ROOT_TABLES.agents.id, ["a1"])).toBeDefined();
  });
});
