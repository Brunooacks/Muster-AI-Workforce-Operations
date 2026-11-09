import assert from "node:assert/strict";
import test from "node:test";
import {
  PERIODOS,
  classificarQuadrante,
  custoPorEntrega,
  leituraIlustrativa,
  leituraOperacional,
  linhaDaMatriz,
  posicaoRelativa,
} from "./visao-geral";

test("custo por entrega aceita é gasto ÷ aceitas e protege divisão por zero", () => {
  assert.equal(custoPorEntrega(68.9, 287), 68.9 / 287);
  assert.equal(custoPorEntrega(0, 0), null);
  assert.equal(custoPorEntrega(null, 287), null);
  assert.equal(custoPorEntrega(68.9, null), null);
});

test("quadrantes da matriz custo × resultado cobrem os quatro casos", () => {
  assert.equal(classificarQuadrante(0.2, 85, 0.3, 75), "Ampliar");
  assert.equal(classificarQuadrante(0.4, 85, 0.3, 75), "Corrigir");
  assert.equal(classificarQuadrante(0.2, 60, 0.3, 75), "Observar");
  assert.equal(classificarQuadrante(0.4, 60, 0.3, 75), "Desligar");
});

test("posição relativa deixa a linha de corte em 50% e limita as bordas", () => {
  assert.equal(posicaoRelativa(0.3, 0.3), 48);
  assert.ok(posicaoRelativa(0, 0.3) <= 4);
  assert.ok(posicaoRelativa(1, 0.3) <= 96);
  assert.equal(posicaoRelativa(0.3, 0), 50);
});

test("linha da matriz usa mediana de custo e resultado", () => {
  const linha = linhaDaMatriz([
    { nome: "a", custo: 0.2, resultado: 80 },
    { nome: "b", custo: 0.4, resultado: 60 },
    { nome: "c", custo: 0.3, resultado: 70 },
    { nome: "d", custo: 0.5, resultado: 50 },
  ]);
  assert.equal(linha.custo, 0.35);
  assert.equal(linha.resultado, 65);
});

test("leitura ilustrativa muda com o período e traz blocos 1 a 5", () => {
  const mes = leituraIlustrativa("Este mês");
  const noventa = leituraIlustrativa("Últimos 90 dias");
  assert.ok(mes.entregas.total! > 0 && mes.entregas.total! < noventa.entregas.total!);
  assert.equal(mes.acoes.length, 3);
  assert.ok(mes.prova.comProva! <= mes.prova.aceitas!);
  assert.equal(mes.custo.porEntrega, 0.24);
  assert.ok(mes.custo.serie.length >= 6);
  assert.equal(mes.tarefaResultado.noPrazo, 98);
  assert.equal(mes.tarefaResultado.resultado, 61);
  assert.equal(mes.matriz.length, 4);
  assert.equal(PERIODOS.length, 3);
});

test("leitura ilustrativa confere gasto, orçamento e custo por entrega", () => {
  for (const periodo of PERIODOS) {
    const leitura = leituraIlustrativa(periodo);
    assert.equal(
      leitura.custo.percentual,
      Math.round((leitura.custo.gasto! / leitura.custo.orcamento!) * 100),
      periodo,
    );
    assert.ok(leitura.custo.porEntrega! <= leitura.custo.meta!, `${periodo}: custo dentro da meta`);
    assert.ok(leitura.prova.percentual! <= 100, periodo);
  }
});

test("leitura operacional diz quando não há dado em vez de mostrar zero", () => {
  const vazia = leituraOperacional({ periodo: "Este mês", agents: [], alertas: [] });
  assert.equal(vazia.entregas.total, null);
  assert.equal(vazia.entregas.aceitas, null);
  assert.equal(vazia.custo.gasto, null);
  assert.equal(vazia.percepcao.nota, null);
  assert.equal(vazia.tarefaResultado.noPrazo, null);
  assert.equal(vazia.matriz.length, 0);
  assert.ok(vazia.entregas.vazio && vazia.entregas.vazio.length > 0);

  const cheia = leituraOperacional({
    periodo: "Este mês",
    agents: [
      { id: "a", name: "Sofia", role: "Suporte", monthlyVolume: 200, monthlyCost: 48, evidenceConfidence: 92, contractFulfillment: 84 },
      { id: "b", name: "Dora", role: "Prospecção", monthlyVolume: 100, monthlyCost: 41, evidenceConfidence: 88, contractFulfillment: 62 },
    ],
    alertas: [
      { id: "x", agentName: "Sofia", pattern: "reabertura subiu", recommendation: "revisar base", assignedTo: "Patrícia", dueAt: "2026-10-30T12:00:00.000Z" },
      { id: "y", agentName: "Dora", pattern: "custo alto", recommendation: "reduzir escopo" },
    ],
    totalAgents: 2,
    saudeMedia: 84,
  });
  assert.equal(cheia.entregas.total, 300);
  assert.equal(cheia.entregas.aceitas, null);
  assert.equal(cheia.custo.gasto, 89);
  assert.equal(cheia.custo.porEntrega, 89 / 300);
  assert.equal(cheia.custo.orcamento, null);
  assert.equal(cheia.prova.percentual, null);
  assert.match(cheia.prova.nota, /90% de confiança/);
  assert.equal(cheia.acoes.length, 2);
  assert.equal(cheia.acoes[0]!.responsavel, "Patrícia");
  assert.equal(cheia.acoes[1]!.responsavel, "sem responsável");
  assert.equal(cheia.matriz.length, 2);
  assert.ok(cheia.frase.includes("300"));
});
