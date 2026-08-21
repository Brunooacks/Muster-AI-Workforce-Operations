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
 * varre o código-fonte: qualquer acesso a tabela-raiz precisa mencionar `orgId`
 * por perto.
 *
 * Duas lições da rodada 7, ambas de buracos que a primeira versão desta guarda
 * deixou passar:
 *
 * 1. Varrer só `routes/` não basta. `buildAgentDetail` lê `agents` dentro de
 *    `lib/serializers.ts`, então `GET /agents/:id` parecia limpo na rota e lia
 *    agente de outra organização. Agora `lib/` também é varrido.
 * 2. Varrer só `.from()` não basta. `DELETE /agents/:id` apagava por id sem
 *    filtro de organização — pior que vazar leitura. Agora `delete()` e
 *    `update()` contam como acesso.
 *
 * Quando um acesso for legitimamente global (bootstrap, seed, manutenção),
 * declare-o em ISENTAS com a justificativa. O custo de justificar é o ponto:
 * obriga a decisão a ser consciente.
 */

const DIR_ROTAS = join(import.meta.dirname, "..", "routes");
const DIR_LIB = import.meta.dirname;

/**
 * Acessos que podem, e devem, ignorar a organização — cada um com o motivo.
 */
const ISENTAS: Array<{ arquivo: string; motivo: string }> = [
  { arquivo: "health.ts", motivo: "healthcheck não consulta dado de cliente" },
  { arquivo: "seed.ts", motivo: "bootstrap de ambiente: popula o banco antes de existir sessão" },
  {
    arquivo: "reevaluate.ts",
    motivo:
      "backfill de manutenção roda no boot sobre a base inteira, fora de requisição; " +
      "o caminho por agente recebe orgId e é coberto pelo teste de assinatura abaixo",
  },
  { arquivo: "tenant-scope.ts", motivo: "é a própria definição do escopo" },
];

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.includes(".test."));
}

/** Formas de tocar uma tabela que precisam de escopo. */
function acessos(tabela: string): string[] {
  return [`.from(${tabela})`, `.delete(${tabela})`, `.update(${tabela})`];
}

/**
 * A instrução inteira em volta do acesso.
 *
 * Uma janela de N linhas fixas erra dos dois lados: um `.set({...})` longo
 * empurra o `.where()` para fora dela (falso positivo), e uma janela generosa
 * pega o `orgId` da consulta vizinha (falso negativo — o pior dos dois). Como a
 * consulta drizzle é uma cadeia que termina em `;`, seguir até o ponto-e-vírgula
 * delimita exatamente a instrução. O limite de 60 linhas é só para não varrer o
 * arquivo inteiro se algo não fechar.
 */
function blocosDeAcesso(fonte: string, tabela: string): Array<{ bloco: string; linha: string }> {
  const linhas = fonte.split("\n");
  const encontrados: Array<{ bloco: string; linha: string }> = [];
  const formas = acessos(tabela);

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i]!;
    if (!formas.some((f) => linha.includes(f))) continue;

    // Algumas linhas atrás: cobre `const x = await db.select({...})` quebrado
    // em várias linhas antes do `.from()`.
    const inicio = Math.max(0, i - 8);
    let fim = i;
    while (fim < linhas.length && fim < i + 60 && !linhas[fim]!.trimEnd().endsWith(";")) {
      fim += 1;
    }
    encontrados.push({
      bloco: linhas.slice(inicio, fim + 1).join("\n"),
      linha: linha.trim(),
    });
  }
  return encontrados;
}

function temEscopo(bloco: string): boolean {
  return (
    bloco.includes("orgId") ||
    bloco.includes("inOrg(") ||
    bloco.includes("ofOrg(") ||
    bloco.includes("agentIdsOfOrg")
  );
}

describe("isolamento por organização — varredura do código", () => {
  const nomesDeTabela = Object.keys(ROOT_TABLES);

  it("nenhum acesso a tabela-raiz ignora a organização", () => {
    const faltando: string[] = [];

    for (const dir of [DIR_ROTAS, DIR_LIB]) {
      for (const arquivo of arquivosDe(dir)) {
        if (ISENTAS.some((e) => e.arquivo === arquivo)) continue;
        const fonte = readFileSync(join(dir, arquivo), "utf8");

        for (const tabela of nomesDeTabela) {
          for (const { bloco, linha } of blocosDeAcesso(fonte, tabela)) {
            if (!temEscopo(bloco)) faltando.push(`${arquivo} · ${tabela} · ${linha}`);
          }
        }
      }
    }

    // A mensagem lista cada ponto: o valor do teste é dizer onde corrigir, não
    // apenas que há algo errado.
    expect(
      faltando,
      `Acessos sem escopo de organização (${faltando.length}):\n  ${faltando.join("\n  ")}`,
    ).toEqual([]);
  });

  it("toda tabela-raiz declarada tem coluna orgId", () => {
    for (const [nome, tabela] of Object.entries(ROOT_TABLES)) {
      expect((tabela as { orgId?: unknown }).orgId, `${nome} sem orgId`).toBeDefined();
    }
  });

  /**
   * Um helper que busca entidade-raiz por id e NÃO recebe organização é um
   * vazamento esperando a próxima rota que o chamar — foi exatamente assim que
   * `buildAgentDetail` entrou. Aqui a exigência é da assinatura, não do uso.
   */
  it("helpers que carregam entidade-raiz exigem orgId na assinatura", () => {
    const exigidos = [
      { arquivo: "serializers.ts", fn: "buildAgentDetail" },
      { arquivo: "reevaluate.ts", fn: "recomputeAgentScores" },
    ];

    for (const { arquivo, fn } of exigidos) {
      const fonte = readFileSync(join(DIR_LIB, arquivo), "utf8");
      const assinatura = fonte
        .slice(fonte.indexOf(`export async function ${fn}(`))
        .slice(0, 400);
      expect(assinatura, `${fn} não recebe orgId`).toContain("orgId");
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
