/**
 * RG-M17 (01/11): rótulo de período fixo "out/26" em 01/11/2026 (BRT).
 * Mês corrente vem do relógio no fuso America/Sao_Paulo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotuloMes, chaveMesAtual } from "./periodo-atual";
import { rotulosPeriodo } from "./visao-geral";

const NOV_1_0048_BRT = new Date("2026-11-01T03:48:00Z");
const OUT_31_2230_BRT = new Date("2026-11-01T01:30:00Z"); // já é nov em UTC, ainda out em SP

test("RG-M17: 01/11/2026 00:48 BRT é nov/26 e mês passado out/26", () => {
  const r = rotulosPeriodo(NOV_1_0048_BRT);
  assert.equal(r["Este mês"], "nov/26");
  assert.equal(r["Mês passado"], "out/26");
  assert.equal(chaveMesAtual(NOV_1_0048_BRT), "2026-11");
});

test("RG-M17: usa o fuso de SP, não UTC", () => {
  assert.equal(rotuloMes(0, OUT_31_2230_BRT), "out/26");
  assert.equal(chaveMesAtual(OUT_31_2230_BRT), "2026-10");
  assert.equal(rotuloMes(-1, new Date("2027-01-15T12:00:00Z")), "dez/26");
});

test("RG-M17: nenhum mês fixo no código das telas logadas", () => {
  for (const f of ["visao-geral.ts", "../pages/workforce-os-lab.tsx", "../pages/executive-reports-workforce.tsx"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /["`]out\/26|· out\/26/, f);
    assert.doesNotMatch(src, /getFullYear\(\)\}-\$\{String\(now\.getMonth/, f);
  }
});
