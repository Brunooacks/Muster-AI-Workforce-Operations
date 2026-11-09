import assert from "node:assert/strict";
import test from "node:test";
import {
  ABAS_RELATORIO,
  RELATORIO_DEMO,
  copyRelatorioVazio,
  relatorioValido,
  secoesDoModelo,
} from "./relatorios";

const CHAVES = ["outcomes", "risk-governance", "decisions", "outlook"];

test("resposta vazia não vira relatório (o bug do 'reading filter')", () => {
  assert.equal(relatorioValido(undefined), null);
  assert.equal(relatorioValido(null), null);
  assert.equal(relatorioValido(""), null);
  assert.equal(relatorioValido("<html>404</html>"), null);
  assert.equal(relatorioValido({}), null);
  assert.equal(relatorioValido([]), null);
  assert.equal(relatorioValido({ sections: [] }), null);
  assert.equal(relatorioValido({ ...RELATORIO_DEMO, sections: undefined }), null);
  assert.equal(relatorioValido({ ...RELATORIO_DEMO, quality: undefined }), null);
  assert.equal(relatorioValido({ ...RELATORIO_DEMO, metrics: null }), null);
});

test("relatório completo passa e mantém as seções", () => {
  const relatorio = relatorioValido(RELATORIO_DEMO);
  assert.ok(relatorio);
  assert.equal(relatorio.period, "2026-10");
  assert.ok(Array.isArray(relatorio.sections));
  assert.ok(relatorio.insights.length > 0);
});

test("secoesDoModelo filtra pelo modelo e nunca quebra", () => {
  assert.deepEqual(secoesDoModelo(null, CHAVES), []);
  assert.deepEqual(secoesDoModelo(RELATORIO_DEMO, []), []);
  const doModelo = secoesDoModelo(RELATORIO_DEMO, CHAVES);
  assert.equal(doModelo.length, 4);
  assert.ok(doModelo.every((secao) => CHAVES.includes(secao.key)));
  assert.equal(secoesDoModelo(RELATORIO_DEMO, ["inexistente"]).length, 0);
});

test("estado vazio fala quanto tempo de dados falta", () => {
  assert.match(copyRelatorioVazio(), /Nenhum relatório ainda/);
  assert.match(copyRelatorioVazio(7), /após 7 dias de dados/);
  assert.equal(copyRelatorioVazio(7), copyRelatorioVazio());
});

test("abas em pt-BR na ordem do resumo primeiro", () => {
  assert.deepEqual(
    ABAS_RELATORIO.map((aba) => aba.label),
    ["Resumo do mês", "Detalhes (indicadores)"],
  );
});
