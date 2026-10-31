import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcular, validar, ENTRADAS_PADRAO } from "./calculadora";

// RG-M02 — a calculadora pública precisa de um campo de custo por caso além do custo/hora.
test("RG-M02: custo por caso > 0 substitui custo-hora × tempo no custo humano", () => {
  const e = { ...ENTRADAS_PADRAO, custoPorCaso: 12 };
  assert.deepEqual(validar(e), {});
  const r = calcular(e);
  assert.equal(r.custoHumanoMensal, ENTRADAS_PADRAO.tarefas * 12);
  assert.ok(Math.abs((r.custoPorResultadoHumano ?? 0) - (1500 * 12) / 1050) < 1e-9);
});

test("RG-M02: custo por caso 0 mantém o cálculo pelo custo-hora", () => {
  const r = calcular(ENTRADAS_PADRAO);
  assert.equal(r.custoHumanoMensal, (1500 * 25 / 60) * 85);
});

test("RG-M02: custo por caso negativo é recusado", () => {
  assert.ok(validar({ ...ENTRADAS_PADRAO, custoPorCaso: -1 }).custoPorCaso);
});

test("RG-M02: a página renderiza o campo 'por caso' nos três idiomas", () => {
  const src = readFileSync(new URL("../pages/calculadora.tsx", import.meta.url), "utf8");
  assert.match(src, /"custoPorCaso"\]/);
  for (const rotulo of ["Custo humano por caso", "Human cost per case", "Costo humano por caso"]) {
    assert.ok(src.includes(rotulo), rotulo);
  }
});
