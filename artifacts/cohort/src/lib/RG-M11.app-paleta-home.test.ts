/**
 * RG-M11 (01/11): área logada no visual da home.
 * Bruno (t550u): /admissao e o menu ainda saíam verde-petróleo (Mineral #0f766e).
 * Falha se o tema padrão da área logada voltar ao verde/teal ou deixar de
 * usar a tinta e o ciano da home (index.css, perfil "claro").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { workforcePalettes } from "../pages/workforce-os-lab";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f: string) => readFileSync(join(raiz, f), "utf8");
const TEAL = /#(0f766e|14201c|dbeee9|9dd36f|45702a|f2f4f1|fafbf8|edf1ed|d7ddd8|5d6963|13250f)\b|176 77% 26%|157 23% 10%|120 12% 95%/i;
const t = workforcePalettes.mineral as Record<string, string>;

test("RG-M11: tema padrão da área logada sem verde/teal antigo", () => {
  assert.doesNotMatch(JSON.stringify(workforcePalettes.mineral), TEAL);
  assert.doesNotMatch(ler("src/pages/configuracoes.tsx"), /#0f766e/i);
});

test("RG-M11: tema padrão usa tinta e ciano da home", () => {
  assert.equal(t["--wo-text"], "#1d1d1f");
  assert.equal(t["--wo-primary"], "#1d1d1f");
  assert.equal(t["--wo-accent"], "#19d4f5");
  assert.equal(t["--primary"], "240 3% 12%");
  assert.equal(t["--accent"], "189 92% 53%");
  assert.equal(t["--background"], "240 11% 96%");
});

test("RG-M11: área logada herda a Outfit da home", () => {
  assert.match(ler("src/index.css"), /--app-font-sans:\s*'Outfit'/);
  assert.doesNotMatch(ler("src/pages/workforce-os-lab.tsx"), /fontFamily:\s*["'](?!var\(--app-font)/);
});
