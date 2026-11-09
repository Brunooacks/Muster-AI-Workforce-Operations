import test from "node:test";
import assert from "node:assert/strict";
import {
  calcular,
  validar,
  formatBRL,
  formatNumero,
  parseEntrada,
  ENTRADAS_PADRAO,
  type EntradasCalculadora,
} from "./calculadora";

const base: EntradasCalculadora = {
  agentes: 8,
  gastoMensal: 4800,
  tarefas: 1500,
  aceitacao: 70,
  custoHora: 85,
  minutosPorTarefa: 25,
  custoPorCaso: 0,
};

test("resultados validados = tarefas × aceitação", () => {
  const r = calcular(base);
  assert.equal(r.resultadosValidados, 1050);
});

test("custo por resultado do agente = gasto mensal ÷ resultados validados", () => {
  const r = calcular(base);
  assert.ok(r.custoPorResultadoAgente !== null);
  assert.ok(Math.abs((r.custoPorResultadoAgente ?? 0) - 4800 / 1050) < 1e-9);
});

test("custo por resultado humano usa tempo × custo-hora sobre os mesmos resultados", () => {
  const r = calcular(base);
  const humanoMensal = (1500 * 25) / 60 * 85;
  assert.ok(Math.abs(r.custoHumanoMensal - humanoMensal) < 1e-9);
  assert.ok(Math.abs((r.custoPorResultadoHumano ?? 0) - humanoMensal / 1050) < 1e-9);
});

test("aceitação menor derruba resultado validado e sobe o custo dos dois lados", () => {
  const alto = calcular({ ...base, aceitacao: 90 });
  const baixo = calcular({ ...base, aceitacao: 40 });
  assert.ok(baixo.resultadosValidados < alto.resultadosValidados);
  assert.ok((baixo.custoPorResultadoAgente ?? 0) > (alto.custoPorResultadoAgente ?? 0));
  assert.ok((baixo.custoPorResultadoHumano ?? 0) > (alto.custoPorResultadoHumano ?? 0));
});

test("gasto zero dá custo zero por resultado, sem dividir por zero", () => {
  const r = calcular({ ...base, gastoMensal: 0 });
  assert.equal(r.custoPorResultadoAgente, 0);
  assert.ok((r.custoPorResultadoHumano ?? 0) > 0);
  assert.equal(r.agenteMaisBarato, true);
});

test("tarefas ou aceitação zeradas devolvem custo por resultado nulo (sem NaN)", () => {
  const semTarefas = calcular({ ...base, tarefas: 0 });
  assert.equal(semTarefas.custoPorResultadoAgente, null);
  assert.equal(semTarefas.custoPorResultadoHumano, null);
  assert.equal(semTarefas.economiaMensal, null);
  assert.equal(semTarefas.agenteMaisBarato, null);

  const semAceite = calcular({ ...base, aceitacao: 0 });
  assert.equal(semAceite.resultadosValidados, 0);
  assert.equal(semAceite.custoPorResultadoAgente, null);
});

test("custo médio por agente usa o número de agentes", () => {
  const r = calcular(base);
  assert.equal(r.custoMedioPorAgente, 600);
  assert.equal(calcular({ ...base, agentes: 0 }).custoMedioPorAgente, null);
});

test("economia mensal = custo humano − gasto com agente", () => {
  const r = calcular(base);
  assert.ok(Math.abs((r.economiaMensal ?? 0) - (r.custoHumanoMensal - 4800)) < 1e-9);

  const caro = calcular({ ...base, gastoMensal: 10_000_000 });
  assert.ok((caro.economiaMensal ?? 0) < 0);
  assert.equal(caro.agenteMaisBarato, false);
});

test("entrada padrão é válida e tem custo humano acima do agente", () => {
  assert.deepEqual(validar(ENTRADAS_PADRAO), {});
  const r = calcular(ENTRADAS_PADRAO);
  assert.equal(r.agenteMaisBarato, true);
  assert.ok((r.custoPorResultadoAgente ?? 0) < (r.custoPorResultadoHumano ?? 0));
});

test("validação cobre campos vazios, negativos, faixa e não-inteiros", () => {
  assert.equal(validar({ ...base, tarefas: Number.NaN }).tarefas, "Falta preencher");
  assert.ok(validar({ ...base, aceitacao: 0 }).aceitacao);
  assert.ok(validar({ ...base, aceitacao: 101 }).aceitacao);
  assert.ok(validar({ ...base, agentes: 2.5 }).agentes);
  assert.ok(validar({ ...base, gastoMensal: -1 }).gastoMensal);
  assert.ok(validar({ ...base, minutosPorTarefa: 0 }).minutosPorTarefa);
  assert.ok(validar({ ...base, minutosPorTarefa: 900 }).minutosPorTarefa);
  assert.deepEqual(validar(base), {});
});

test("parse de entrada aceita vírgula decimal e vazio vira NaN", () => {
  assert.equal(parseEntrada("1.500,5"), 1500.5);
  assert.equal(parseEntrada("4800"), 4800);
  assert.equal(parseEntrada("4.800"), 4800);
  assert.equal(parseEntrada("1.500.000"), 1500000);
  assert.equal(parseEntrada("1.5"), 1.5);
  assert.ok(Number.isNaN(parseEntrada("")));
});

test("formatação em reais e números no padrão pt-BR", () => {
  assert.equal(formatBRL(4.571428), "R$ 4,57");
  assert.equal(formatBRL(48_325, false), "R$ 48.325");
  assert.equal(formatBRL(Number.NaN), "—");
  assert.equal(formatNumero(1050), "1.050");
  assert.equal(formatNumero(50.6, 1), "50,6");
});

test("resultado muda na direção certa quando só o gasto muda", () => {
  const barato = calcular({ ...base, gastoMensal: 2000 });
  const caro = calcular({ ...base, gastoMensal: 9000 });
  assert.ok((barato.custoPorResultadoAgente ?? 0) < (caro.custoPorResultadoAgente ?? 0));
  assert.equal(barato.custoHumanoMensal, caro.custoHumanoMensal);
});
