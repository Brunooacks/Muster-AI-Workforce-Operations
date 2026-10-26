import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Glossário único pt-BR (home-referencias §4) aplicado às telas que o usuário vê.
 * Varre texto visível (literais de string e texto JSX) das telas da home em modo
 * demonstração e falha se aparecer termo que o glossário manda substituir.
 *
 * Exceções documentadas: /mapa (tabela "SAI" cita os nomes antigos), dicionários
 * en/es (o glossário é pt-BR) e strings que são identificador de código.
 */

const SRC = join(import.meta.dirname, "..");

const ARQUIVOS = [
  "pages/workforce-os-lab.tsx",
  "pages/workforce-os-modules.tsx",
  "pages/mixed-teams-workforce.tsx",
  "pages/executive-reports-workforce.tsx",
  "pages/configuracoes.tsx",
  "pages/adicionar-agente.tsx",
  "pages/perfil.tsx",
  "pages/conectar.tsx",
  "pages/entregas.tsx",
  "pages/pendencias.tsx",
  "pages/comando.tsx",
  "pages/alerts.tsx",
  "pages/admin-console.tsx",
  "pages/connectors-workforce.tsx",
  "pages/design-system.tsx",
  "components/shell/agentes-graficos.tsx",
  "components/shell/visao-geral-graficos.tsx",
  "components/shell/bottom-bar.tsx",
  "components/shell/conta.tsx",
  "lib/shell-nav.ts",
  "lib/team-operating-model.ts",
  "lib/agentes.ts",
  "lib/calculadora.ts",
  "lib/workforce-agent-adapter.ts",
  "lib/relatorios.ts",
  "lib/adicionar-agente.ts",
  "components/agent-contract.tsx",
  "components/agent-outcome.tsx",
  "components/home",
  "muster",
  "muster/pages",
  "muster/auth",
];

// Termo proibido + corpo do padrão; o teste cola limite de palavra que não
// aceita hífen junto (assim "items-baseline" e "agent-outcome" não contam).
const PROIBIDOS: Array<[string, string]> = [
  ["control plane", "control\\s+plane"],
  ["a2a", "a2a"],
  ["gauntlet", "gauntlet"],
  ["freshness", "freshness"],
  ["tenant-scoped", "tenant-scoped"],
  ["envelope", "envelope"],
  ["outcome", "outcomes?"],
  ["pp", "pp"],
  ["evidência", "evid[êe]ncias?"],
  ["guardrail", "guardrails?"],
  ["owner", "owners?"],
  ["baseline", "baseline"],
  ["job description", "job\\s+description"],
  ["probation", "probation"],
  ["handoff", "handoffs?"],
  ["speed to lead", "speed\\s+to\\s+lead"],
  ["on the fly", "on\\s+the\\s+fly"],
].map(([nome, corpo]) => [nome, new RegExp(`(?<![-\\w])${corpo}(?![\\w-])`, "i")]);

/** [arquivo, termo, motivo]: o que o scanner deixa passar de propósito. */
const EXCECOES: Array<[string, string, string]> = [
  ["lib/shell-nav.ts", "a2a", "tabela do /mapa cita o nome antigo do item"],
  ["lib/shell-nav.ts", "control plane", "tabela do /mapa cita o nome antigo do item"],
  ["pages/configuracoes.tsx", "probation", "dicionário en/es mantém a palavra do idioma"],
  ["pages/comando.tsx", "owner", "dicionário en: 'Owner'"],
  ["pages/alerts.tsx", "owner", "dicionário en: 'Owner or team'"],
  ["pages/conectar.tsx", "evidência", "dicionário es: 'Sin evidencia'"],
];

/** Texto que o usuário enxerga: literais de string e texto entre tags JSX. */
export function textoVisivel(fonte: string): string[] {
  const semComentarios = fonte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\bimport\s[\s\S]*?\sfrom\s["'][^"']+["'];?/g, "");
  const pecas: string[] = [];
  for (const trecho of semComentarios.matchAll(
    /`([^`\n$]*)`|"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g,
  )) {
    pecas.push(trecho[1] ?? trecho[2] ?? trecho[3] ?? "");
  }
  for (const trecho of semComentarios.matchAll(/(?<!=)>([^<>{}]+)</g)) {
    const texto = trecho[1];
    // Entre tags só entra texto de gente: nada de código arrastado pelo parser.
    if (!/[A-Za-zÀ-ÿ]/.test(texto)) continue;
    if (/[;=(){}$`|&]/.test(texto)) continue;
    pecas.push(texto);
  }
  return pecas;
}

export function termosEncontrados(fonte: string, excecoes: string[] = []): string[] {
  const achados: string[] = [];
  textoVisivel(fonte).forEach((pedaco, i) => {
    // String minúscula de uma palavra é identificador de código, não rótulo.
    if (/^[a-z][a-z0-9]*$/.test(pedaco.trim())) return;
    // Caminho de rota (href) é identificador de URL, não rótulo.
    if (/^\/[a-z0-9/:-]*$/.test(pedaco.trim())) return;
    for (const [nome, re] of PROIBIDOS) {
      if (excecoes.includes(nome)) continue;
      if (re.test(pedaco)) achados.push(`pedaço #${i}: [${nome}] ${pedaco.trim().slice(0, 120)}`);
    }
  });
  return achados;
}

test("glossário: o próprio scanner pega termo proibido em texto visível", () => {
  const achados = termosEncontrados(`const rotulo = "Status do owner"; <td>4 pp</td>`);
  assert.ok(achados.length >= 2, "scanner precisa acusar owner e pp");
  assert.deepEqual(termosEncontrados(`const owner = dados.owner;`), [], "código sem aspas passa");
  assert.deepEqual(termosEncontrados(`<div className="flex items-baseline gap-2">Texto</div>`), [], "classe do Tailwind não é baseline de dado");
  assert.deepEqual(termosEncontrados(`<span>Agente do agente-outcome</span>`), [], "hífen junto não é termo solto");
});

test("glossário: nenhuma tela da home em demonstração usa termo fora do glossário", () => {
  const problemas: string[] = [];
  for (const arquivo of ARQUIVOS) {
    const caminho = join(SRC, arquivo);
    const alvos = (arquivo.endsWith("home") || arquivo.startsWith("muster"))
      ? readdirSync(caminho).filter((nome) => nome.endsWith(".tsx")).map((nome) => `${arquivo}/${nome}`)
      : [arquivo];
    for (const alvo of alvos) {
      const fonte = readFileSync(join(SRC, alvo), "utf8");
      const permitidos = EXCECOES.filter(([arquivoExcecao]) => arquivoExcecao === alvo).map(([, termo]) => termo);
      for (const achado of termosEncontrados(fonte, permitidos)) problemas.push(`${alvo}: ${achado}`);
    }
  }
  assert.deepEqual(problemas, []);
});

test("glossário: /mapa é a exceção e continua citando os nomes antigos", () => {
  const mapa = readFileSync(join(SRC, "pages", "mapa.tsx"), "utf8");
  assert.match(mapa, /SAI/);
  assert.ok(termosEncontrados(mapa).length > 0, "a tabela de nomes antigos é a exceção");
});
