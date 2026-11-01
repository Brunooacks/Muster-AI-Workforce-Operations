/**
 * RG-M18 (01/11): área logada mostrava selos de migração do protótipo
 * ("EVOLUI" no cabeçalho, "JUNTA" em Configurações, "NOVO"/"SUBSTITUI" nos
 * blocos). São anotação do mapa de redesenho (/mapa): só no laboratório.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lab = readFileSync(new URL("../pages/workforce-os-lab.tsx", import.meta.url), "utf8");
const mod = readFileSync(new URL("../pages/workforce-os-modules.tsx", import.meta.url), "utf8");

test("RG-M18: selo do cabeçalho só com labMode", () => {
  assert.match(lab, /\{labMode && selo && \(/);
});

test("RG-M18: selo de Configurações no rodapé só com labMode", () => {
  assert.match(lab, /\{labMode && \(\s*<span[^>]*>\s*\{SHELL_RODAPE\.selo\}/);
});

test("RG-M18: selos dos blocos da Visão geral só fora do modo operacional", () => {
  assert.match(mod, /<SelosVisiveis\.Provider value=\{!operational\}>/);
  assert.match(mod, /\{selosVisiveis && <span/);
});
