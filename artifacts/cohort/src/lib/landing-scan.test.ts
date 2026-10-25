import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Varredura da landing (cunha · C14.1/C14.2, MUS-179 + redesign T3).
 * 1. A landing (composição) não tem número literal em card de métrica:
 *    os números moram em components/home/* e vêm com selo "Dados
 *    ilustrativos" ou com fonte pública linkada.
 * 2. Os dados da regra R6 sem fonte pública não voltam a nenhum texto
 *    público: landing, componentes da landing, i18n e index.html.
 *    Gartner saiu da lista: o comunicado público é linkado na home.
 */

const SRC = join(import.meta.dirname, "..");
const ROOT = join(SRC, "..");
const read = (...p: string[]) => readFileSync(join(...p), "utf8");

const METRIC_FILES = ["pages/landing.tsx", "components/workforce-overview.tsx"];
const PUBLIC_FILES = [
  ...METRIC_FILES,
  "pages/landing-examples.ts",
  "components/landing-demo.tsx",
  "lib/i18n.tsx",
];

const MONTHS =
  "janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|" +
  "january|february|march|april|may|june|july|august|september|october|november|december|" +
  "enero|febrero|marzo|mayo|junio|julio|septiembre|octubre|noviembre|diciembre";

const METRIC_LITERALS: Array<[string, RegExp]> = [
  ["valor numérico em card", /\bvalue:\s*\d/],
  ["delta em pp", /["'`>\s][+\-−]?\d+(?:[.,]\d+)?\s?pp\b/],
  ["percentual como string", /"\d+(?:[.,]\d+)?%"/],
  ["percentual em texto JSX", />\s*\d+(?:[.,]\d+)?%/],
  ["confiança/e2e com número", /\d+%\s*(?:confiança|confidence|confianza|e2e|end-to-end)/i],
  ["mês e ano fixos", new RegExp(`\\b(?:${MONTHS})\\s+\\d{4}\\b`, "i")],
  ["selo de decisão fixo", /decision ready/i],
];

// Dados da R6 sem fonte pública, em pt/en/es. Mantidos só aqui (teste).
const R6_TERMS: RegExp[] = [
  /\b1\s*(?:em|in|de cada|out of)\s*5\b/i,
  /\b(?:one in five|um em cada cinco|uno de cada cinco)\b/i,
  /\b100\s*(?:x|×|vezes|times|veces)\b/i,
];

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function metricLiterals(fonte: string): string[] {
  const achados: string[] = [];
  semComentarios(fonte)
    .split("\n")
    .forEach((linha, i) => {
      if (/^\s*"--/.test(linha)) return; // variáveis CSS de tema
      for (const [nome, re] of METRIC_LITERALS) if (re.test(linha)) achados.push(`l.${i + 1} ${nome}`);
    });
  return achados;
}

test("varredura pega número literal em card (prova do scanner)", () => {
  assert.equal(metricLiterals(`{[{ label: "A", value: 92, delta: "+4 pp" }]}`).length >= 2, true);
  assert.deepEqual(metricLiterals(`<strong>91%</strong>`), ["l.1 percentual em texto JSX"]);
  assert.deepEqual(metricLiterals(`<b>Agosto 2026</b>`), ["l.1 mês e ano fixos"]);
  assert.deepEqual(metricLiterals(`    "--ring": "211 100% 68%",`), []);
});

test("landing e visão geral sem número literal em card de métrica", () => {
  for (const arquivo of METRIC_FILES) {
    assert.deepEqual(metricLiterals(read(SRC, arquivo)), [], arquivo);
  }
});

test("os exemplos existem e a landing compõe as seções do handoff", () => {
  const exemplos = read(SRC, "pages/landing-examples.ts");
  for (const selo of ['pt: "Exemplo"', 'en: "Example"', 'es: "Ejemplo"']) assert.ok(exemplos.includes(selo), selo);
  const landing = read(SRC, "pages/landing.tsx");
  for (const secao of ["HomeNav", "HomeHero", "HomeMercado", "HomeResolvemos", "HomeFicha", "HomeAcompanhamento", "HomeDecisao", "HomeIntegracoes", "HomeCobertura", "HomePrecos", "HomeFechamento"]) {
    assert.ok(landing.includes(`<${secao}`), `seção ${secao}`);
  }
  assert.ok(!landing.includes("video") && !landing.includes("iframe"), "sem vídeo publicado");
});

test("home: número ilustrativo vem com selo; Gartner vem com fonte pública", () => {
  const dir = join(SRC, "components", "home");
  for (const arquivo of readdirSync(dir)) {
    if (!arquivo.endsWith(".tsx")) continue;
    const texto = semComentarios(readFileSync(join(dir, arquivo), "utf8"));
    if (!/\d+%/.test(texto)) continue;
    const selo = texto.includes("Dados ilustrativos");
    const fonte = texto.includes("Gartner") || texto.includes("Preços pendentes de decisão");
    assert.ok(selo || fonte, `${arquivo}: número de exemplo sem selo "Dados ilustrativos" e sem fonte`);
  }
  const mercado = readFileSync(join(SRC, "components", "home", "home-mercado.tsx"), "utf8");
  assert.ok(mercado.includes("gartner.com/en/newsroom/press-releases/2025-06-25"), "link do comunicado");
  assert.ok(mercado.includes("ao menos"), "15% é \"ao menos 15%\"");
  const precos = readFileSync(join(SRC, "components", "home", "home-precos.tsx"), "utf8");
  assert.ok(!precos.includes("MAIS ESCOLHIDO") && !precos.includes("Mais escolhido"), "selo removido");
  assert.ok(precos.includes("Preços pendentes de decisão"), "aviso de preços");
});

test("R6: nenhum dos três dados sem fonte em texto público", () => {
  const arquivos = [...PUBLIC_FILES.map((f) => join(SRC, f)), join(ROOT, "index.html")];
  for (const arquivo of arquivos) {
    const texto = readFileSync(arquivo, "utf8");
    for (const termo of R6_TERMS) assert.doesNotMatch(texto, termo, `${arquivo} · ${termo}`);
  }
});

test("docs/fontes.md existe e não reintroduz os dados da R6", () => {
  const fontes = join(ROOT, "..", "..", "docs", "fontes.md");
  assert.ok(existsSync(fontes), "docs/fontes.md");
  const texto = readFileSync(fontes, "utf8");
  for (const termo of R6_TERMS) assert.doesNotMatch(texto, termo);
});
