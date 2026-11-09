/**
 * RG-M09 (31/10): o Muster tem tipografia própria — Outfit na interface.
 * Antes usava Geist, a mesma família do Veltrix. Falha se alguma folha
 * voltar a pedir Geist ou se a Outfit deixar de ser carregada do Google Fonts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f: string) => readFileSync(join(raiz, f), "utf8");
const arquivos = ["index.html", "src/index.css", "src/muster/proto.css", "src/muster/pages/direcionamento.tsx"];

test("RG-M09: --app-font-sans começa por Outfit", () => {
  const m = ler("src/index.css").match(/--app-font-sans:\s*([^;]*);/);
  assert.ok(m, "--app-font-sans sumiu");
  assert.match(m![1].replace(/['"]/g, "").trim(), /^Outfit\b/);
});

test("RG-M09: a Outfit é pedida ao Google Fonts no index.html", () => {
  assert.match(ler("index.html"), /family=Outfit:wght@/);
});

test("RG-M09: nenhuma folha pede Geist", () => {
  for (const f of arquivos) assert.doesNotMatch(ler(f), /\bGeist\b/, f);
});
