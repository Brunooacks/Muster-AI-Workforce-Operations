// Contraste WCAG dos pares de tokens texto/fundo.
// Falha (exit 1) quando um par de texto normal fica abaixo de 4,5:1.
// Uso: node scripts/ci/contrast.mjs [--verbose]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MINIMO_TEXTO_NORMAL = 4.5;
export const MINIMO_TEXTO_GRANDE = 3;

/** "#1d1d1f" | "240 3% 12%" | "hsl(240 3% 12%)" → [r, g, b] 0-255 */
export function paraRgb(valor) {
  const limpo = String(valor).trim().replace(/\s*\/\s*.*$/, "").replace(/\/\*.*?\*\//g, "").trim();
  const hex = limpo.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let corpo = hex[1];
    if (corpo.length === 3 || corpo.length === 4) corpo = corpo.split("").map((c) => c + c).join("");
    return [
      parseInt(corpo.slice(0, 2), 16),
      parseInt(corpo.slice(2, 4), 16),
      parseInt(corpo.slice(4, 6), 16),
    ];
  }
  const hsl = limpo.match(/^(?:hsl\()?\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)?$/i);
  if (hsl) return hslParaRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
  throw new Error(`cor não reconhecida: ${valor}`);
}

function hslParaRgb(h, s, l) {
  const sat = s / 100;
  const lum = l / 100;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lum - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function luminancia([r, g, b]) {
  const canal = (valor) => {
    const v = valor / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste WCAG 2.1 (1 a 21). */
export function razaoContraste(frente, fundo) {
  const a = luminancia(paraRgb(frente));
  const b = luminancia(paraRgb(fundo));
  const [claro, escuro] = a >= b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}

function blocoCss(css, inicio) {
  const abre = css.indexOf("{", inicio);
  let profundidade = 0;
  for (let i = abre; i < css.length; i += 1) {
    if (css[i] === "{") profundidade += 1;
    if (css[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return css.slice(abre + 1, i);
    }
  }
  throw new Error("bloco CSS sem fechamento");
}

function tokensCss(texto, seletor) {
  const inicio = texto.indexOf(seletor);
  if (inicio < 0) throw new Error(`seletor não encontrado: ${seletor}`);
  const corpo = blocoCss(texto, inicio);
  const tokens = {};
  for (const [, nome, valor] of corpo.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const semComentario = valor.replace(/\/\*.*?\*\//g, "").trim();
    if (!/^[#\d]/.test(semComentario)) continue;
    if (/font|radius|shadow|rem|px|url/i.test(semComentario) && !/%/.test(semComentario)) continue;
    tokens[nome] = semComentario;
  }
  return tokens;
}

function tokensTsx(texto, marcador) {
  const inicio = texto.indexOf(marcador);
  if (inicio < 0) throw new Error(`bloco não encontrado: ${marcador}`);
  const corpo = blocoCss(texto, texto.indexOf("{", inicio));
  const paletas = {};
  for (const nome of ["mineral", "graphite", "dracula", "mocha"]) {
    const marca = corpo.indexOf(`${nome}: {`);
    if (marca < 0) continue;
    const bloco = blocoCss(corpo, marca);
    const tokens = {};
    for (const [, chave, valor] of bloco.matchAll(/"(--[\w-]+)"\s*:\s*"([^"]+)"/g)) {
      tokens[chave.slice(2)] = valor;
    }
    paletas[nome] = tokens;
  }
  return paletas;
}

const PARES_CSS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["cyan-text", "background"],
  ["cyan-text", "card"],
  ["cyan-text", "secondary"],
  ["sidebar-foreground", "sidebar"],
  // Chips de risco/atenção: texto de status sobre fundo, cartão e a própria tinta (15%).
  ...["chart-2", "chart-3", "chart-4", "destructive"].flatMap((tom) => [
    [`${tom}-text`, "background"],
    [`${tom}-text`, "card"],
    [`${tom}-text`, "secondary"],
    [`${tom}-text`, "card", tom],
    [`${tom}-text`, "secondary", tom],
  ]),
];

const PARES_PALETA = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["wo-text", "wo-bg"],
  ["wo-text", "wo-card"],
  ["wo-text", "wo-card-2"],
  ["wo-text", "wo-shell"],
  ["wo-muted", "wo-card"],
  ["wo-muted", "wo-bg"],
  ["wo-muted", "wo-card-2"],
  ["wo-primary", "wo-card"],
  ["wo-accent-ink", "wo-accent"],
  ["wo-primary-ink", "wo-primary"],
  ...[
    ["wo-warning-text", "wo-warning"],
    ["wo-danger-text", "wo-danger"],
    ["wo-accent-text", "wo-accent"],
  ].flatMap(([texto, tom]) => [
    [texto, "wo-card"],
    [texto, "wo-card-2"],
    [texto, "wo-bg"],
    [texto, "wo-card", tom],
    [texto, "wo-card-2", tom],
  ]),
  ...["chart-2", "chart-3", "chart-4", "destructive"].flatMap((tom) => [
    [`${tom}-text`, "card"],
    [`${tom}-text`, "secondary"],
    [`${tom}-text`, "card", tom],
  ]),
];

/** Proporção da tinta de status sobre o fundo nos chips (bg-x/10 a bg-x/15). */
export const TINTA_CHIP = 0.15;

function paraHex(rgb) {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Fundo do chip: `tinta` a TINTA_CHIP sobre `fundo`. */
export function misturar(tinta, fundo, proporcao = TINTA_CHIP) {
  const a = paraRgb(tinta);
  const b = paraRgb(fundo);
  return paraHex(a.map((v, i) => v * proporcao + b[i] * (1 - proporcao)));
}

function avalia(tema, tokens, pares) {
  const achados = [];
  for (const [texto, fundoBase, tinta] of pares) {
    const corTexto = tokens[texto];
    const corBase = tokens[fundoBase];
    if (!corTexto || !corBase) continue;
    if (tinta && !tokens[tinta]) continue;
    const corFundo = tinta ? misturar(tokens[tinta], corBase) : corBase;
    const fundo = tinta ? `${fundoBase}+${tinta}/${TINTA_CHIP * 100}%` : fundoBase;
    const razao = razaoContraste(corTexto, corFundo);
    achados.push({
      tema,
      texto,
      fundo,
      razao: Number(razao.toFixed(2)),
      cores: [corTexto, corFundo],
      passa: razao >= MINIMO_TEXTO_NORMAL,
    });
  }
  return achados;
}

/** Varre os tokens reais do app e devolve todos os pares avaliados. */
export function conferirContraste(raiz) {
  const css = readFileSync(join(raiz, "artifacts", "cohort", "src", "index.css"), "utf8");
  const tsx = readFileSync(
    join(raiz, "artifacts", "cohort", "src", "pages", "workforce-os-lab.tsx"),
    "utf8",
  );

  const resultado = [];
  resultado.push(...avalia("claro", tokensCss(css, '[data-profile="claro"], :root'), PARES_CSS));
  resultado.push(...avalia("noite", tokensCss(css, '[data-profile="noite"]'), PARES_CSS));

  const produto = tokensTsx(tsx, "const productTokens: Record<PaletteId, CSSProperties> = {");
  const wo = tokensTsx(tsx, "export const workforcePalettes: Record<PaletteId, CSSProperties> = {");
  for (const nome of ["mineral", "graphite", "dracula", "mocha"]) {
    const tokens = { ...(produto[nome] ?? {}), ...(wo[nome] ?? {}) };
    resultado.push(...avalia(nome, tokens, PARES_PALETA));
  }
  return resultado;
}

function main() {
  const raiz = join(import.meta.dirname, "..", "..");
  const pares = conferirContraste(raiz);
  const falhas = pares.filter((par) => !par.passa);
  const detalhado = process.argv.includes("--verbose");

  if (detalhado || falhas.length > 0) {
    for (const par of pares) {
      const marca = par.passa ? "ok  " : "FAIL";
      if (detalhado || !par.passa) {
        console.log(
          `${marca} ${par.tema.padEnd(9)} ${par.texto} sobre ${par.fundo}: ${par.razao}:1 (${par.cores.join(" / ")})`,
        );
      }
    }
  }

  console.log(
    `contraste: ${pares.length - falhas.length}/${pares.length} pares ≥ ${MINIMO_TEXTO_NORMAL}:1` +
      (falhas.length > 0 ? ` · ${falhas.length} abaixo do mínimo` : ""),
  );

  if (falhas.length > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
