import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  PROJECT_TABLES,
  ROOT_TABLES,
  byAgentsOf,
  decidirAmbiente,
  inEnv,
  inOrg,
  inProject,
  ofOrg,
  tabelaTemProjeto,
} from "./tenant-scope";

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
const DIR_MIDDLEWARES = join(import.meta.dirname, "..", "middlewares");

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

function temEscopoPorAgente(bloco: string): boolean {
  return (
    bloco.includes("byAgentsOf(") ||
    (bloco.includes("innerJoin(agents") && bloco.includes("ofOrg(agents"))
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

  it("fleet restringe toda leitura filha à frota da organização", () => {
    const fonte = readFileSync(join(DIR_ROTAS, "fleet.ts"), "utf8");
    const tabelasFilhas = [
      "alerts",
      "evaluations",
      "metricPoints",
      "agentOwners",
      "verdicts",
    ];
    const faltando: string[] = [];

    for (const tabela of tabelasFilhas) {
      for (const { bloco, linha } of blocosDeAcesso(fonte, tabela)) {
        if (linha.includes(`.update(${tabela})`)) continue;
        if (!temEscopoPorAgente(bloco)) faltando.push(`${tabela} · ${linha}`);
      }
    }

    expect(
      faltando,
      `Leituras filhas de fleet sem escopo (${faltando.length}):\n  ${faltando.join("\n  ")}`,
    ).toEqual([]);
  });

  it("update de alerta exige posse previamente resolvida na organização", () => {
    const fonte = readFileSync(join(DIR_ROTAS, "fleet.ts"), "utf8");
    const inicio = fonte.indexOf('router.patch("/fleet/alerts/:alertId"');
    const fim = fonte.indexOf('router.get("/fleet/decisions"');
    const handler = fonte.slice(inicio, fim);

    expect(handler).toContain("requireOrgOperator");
    expect(handler).toContain("ofOrg(agents, req.orgId!)");
    expect(handler).toContain("eq(alerts.agentId, current.alert.agentId)");
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

// --- Projeto e ambiente (E1 · T1.5) ------------------------------------------

function temEscopoDeProjeto(bloco: string): boolean {
  return bloco.includes("inProject(") || bloco.includes("inEnv(") || bloco.includes("projectId");
}

/**
 * Acessos a tabela com projeto (agents, agentApiKeys, eventOutbox) que não
 * mencionam projeto. Exportável para a fixture abaixo provar que o scanner pega.
 */
function acessosSemProjeto(fonte: string): string[] {
  const faltando: string[] = [];
  for (const tabela of Object.keys(PROJECT_TABLES)) {
    for (const { bloco, linha } of blocosDeAcesso(fonte, tabela)) {
      if (!temEscopoDeProjeto(bloco)) faltando.push(`${tabela} · ${linha}`);
    }
  }
  return faltando;
}

/**
 * Leituras/escritas org-wide que existem hoje em tabelas com projeto, por
 * arquivo: são as consultas de sessão humana, que seguem org-wide por decisão
 * da E1 (`?project=` fica para quando a UI tiver seletor). A lista é fechada
 * nos dois sentidos — consulta nova sem projeto quebra o teste, e consulta
 * migrada obriga a baixar o número aqui.
 */
const ORG_WIDE_PENDENTES: Record<string, number> = {
  "lib/admission.ts": 2,
  "lib/agent-telemetry-reevaluation.ts": 3,
  "lib/continuous-telemetry-worker.ts": 1,
  "lib/professional-plan-service.ts": 1,
  "lib/serializers.ts": 1,
  // Caminho de chave: sai desta lista na T1.6.
  "middlewares/requireAgentCredential.ts": 2,
  "routes/agent-keys.ts": 3,
  "routes/agents.ts": 8,
  "routes/areas.ts": 2,
  "routes/connectors.ts": 3,
  "routes/evidence.ts": 1,
  "routes/executive-reports.ts": 1,
  "routes/fleet.ts": 5,
  "routes/journey-recommendations.ts": 2,
  "routes/journeys.ts": 4,
  "routes/mixed-teams.ts": 1,
  "routes/realtime-governance.ts": 1,
  "routes/telemetry.ts": 5,
  "routes/verdict-actions.ts": 1,
};

describe("isolamento por projeto — varredura do código", () => {
  it("todo acesso a tabela com projeto usa inProject/inEnv ou está na lista org-wide", () => {
    const contagem: Record<string, number> = {};
    const detalhes: string[] = [];
    for (const [rotulo, dir] of [
      ["routes", DIR_ROTAS],
      ["lib", DIR_LIB],
      ["middlewares", DIR_MIDDLEWARES],
    ] as const) {
      for (const arquivo of arquivosDe(dir)) {
        if (ISENTAS.some((e) => e.arquivo === arquivo)) continue;
        const achados = acessosSemProjeto(readFileSync(join(dir, arquivo), "utf8"));
        if (achados.length === 0) continue;
        contagem[`${rotulo}/${arquivo}`] = achados.length;
        detalhes.push(...achados.map((a) => `${rotulo}/${arquivo} · ${a}`));
      }
    }
    expect(
      contagem,
      `Acessos org-wide em tabela com projeto (${detalhes.length}):\n  ${detalhes.join("\n  ")}`,
    ).toEqual(ORG_WIDE_PENDENTES);
  });

  it("o scanner pega leitura de agents só com ofOrg (fixture)", () => {
    const soConta = [
      "const rows = await db",
      "  .select()",
      "  .from(agents)",
      "  .where(ofOrg(agents, req.orgId!));",
    ].join("\n");
    const comProjeto = [
      "const rows = await db",
      "  .select()",
      "  .from(agents)",
      "  .where(inProject(agents, scope));",
    ].join("\n");
    expect(acessosSemProjeto(soConta)).toEqual(["agents · .from(agents)"]);
    expect(acessosSemProjeto(comProjeto)).toEqual([]);
  });

  it("toda tabela com projeto tem orgId e projectId", () => {
    for (const [nome, tabela] of Object.entries(PROJECT_TABLES)) {
      expect((tabela as { orgId?: unknown }).orgId, `${nome} sem orgId`).toBeDefined();
      expect((tabela as { projectId?: unknown }).projectId, `${nome} sem projectId`).toBeDefined();
    }
    expect(tabelaTemProjeto("agents")).toBe(true);
    expect(tabelaTemProjeto("areas")).toBe(false);
  });
});

describe("predicados de projeto e ambiente", () => {
  const dialect = new PgDialect();
  const render = (sql: ReturnType<typeof inOrg>) => dialect.sqlToQuery(sql);
  const scope = { orgId: "org_x", projectId: "prj_x", environmentId: "env_x" };

  it("inProject filtra por conta e projeto, nessa ordem, e compõe", () => {
    const q = render(inProject(PROJECT_TABLES.agents, scope, eq(PROJECT_TABLES.agents.id, "a1")));
    expect(q.sql).toBe(
      '("agents"."org_id" = $1 and "agents"."project_id" = $2 and "agents"."id" = $3)',
    );
    expect(q.params).toEqual(["org_x", "prj_x", "a1"]);
  });

  it("inEnv filtra por conta, projeto e ambiente", () => {
    const q = render(inEnv(PROJECT_TABLES.eventOutbox, scope));
    expect(q.sql).toBe(
      '("event_outbox"."org_id" = $1 and "event_outbox"."project_id" = $2 and "event_outbox"."environment_id" = $3)',
    );
    expect(q.params).toEqual(["org_x", "prj_x", "env_x"]);
  });

  it("inProject equivale a inOrg + projeto escrito à mão", () => {
    const t = PROJECT_TABLES.agentApiKeys;
    expect(render(inProject(t, scope))).toEqual(
      render(and(eq(t.orgId, "org_x"), eq(t.projectId, "prj_x"))!),
    );
  });

  it("decidirAmbiente: igual permite, sandbox→prod proíbe, prod→sandbox não existe", () => {
    expect(decidirAmbiente("prod", "prod")).toBe("permitido");
    expect(decidirAmbiente("sandbox", "sandbox")).toBe("permitido");
    expect(decidirAmbiente("sandbox", "prod")).toBe("proibido");
    expect(decidirAmbiente("prod", "sandbox")).toBe("inexistente");
  });
});

