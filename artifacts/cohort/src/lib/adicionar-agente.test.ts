import assert from "node:assert/strict";
import test from "node:test";
import {
  ETAPAS,
  FORM_VAZIO,
  etapaPorId,
  etapasConcluidas,
  faltantes,
  orcamentoValido,
  problemaDaEtapa,
  progressoEtapa,
  type FormAdicionarAgente,
} from "./adicionar-agente";

const rotulos = (form: FormAdicionarAgente, etapaId: string) =>
  faltantes(form, etapaPorId(etapaId)).map((campo) => campo.rotulo);

test("são 4 etapas, na ordem e com o nome da referencia", () => {
  assert.equal(ETAPAS.length, 4);
  assert.deepEqual(
    ETAPAS.map((etapa) => etapa.titulo),
    ["1. Quem é", "2. O que entrega", "3. Limites e orçamento", "4. Conectar"],
  );
  assert.deepEqual(ETAPAS.map((etapa) => etapa.numero), [1, 2, 3, 4]);
  assert.equal(progressoEtapa(1), "Etapa 1 de 4");
  assert.equal(progressoEtapa(4), "Etapa 4 de 4");
});

test("campos obrigatorios ficam marcados e o responsavel e opcional", () => {
  const etapa1 = etapaPorId("quem-e");
  assert.deepEqual(
    etapa1.campos.filter((campo) => campo.obrigatorio).map((campo) => campo.rotulo),
    ["Nome do agente", "O que ele faz (1 frase)", "Plataforma"],
  );
  assert.equal(
    etapa1.campos.find((campo) => campo.chave === "responsavel")?.obrigatorio,
    false,
  );
});

test("etapa vazia aponta o que falta, na ordem da tela", () => {
  assert.deepEqual(rotulos(FORM_VAZIO, "quem-e"), [
    "Nome do agente",
    "O que ele faz (1 frase)",
    "Plataforma",
  ]);
  assert.equal(
    problemaDaEtapa(FORM_VAZIO, etapaPorId("quem-e")),
    "Falta preencher: Nome do agente, O que ele faz (1 frase), Plataforma",
  );
  assert.equal(
    problemaDaEtapa(FORM_VAZIO, etapaPorId("o-que-entrega")),
    "Falta preencher: Que entrega conta como pronta?",
  );
});

test("responsavel em branco nao bloqueia a etapa 1", () => {
  const form: FormAdicionarAgente = {
    ...FORM_VAZIO,
    nome: "Sofia",
    funcao: "Resolve tickets de primeira resposta",
    plataforma: "zendesk-ai",
  };
  assert.deepEqual(rotulos(form, "quem-e"), []);
  assert.equal(problemaDaEtapa(form, etapaPorId("quem-e")), null);
  assert.equal(etapasConcluidas(form, 2), 1);
});

test("etapa 4 nao tem campo obrigatorio", () => {
  assert.equal(etapaPorId("conectar").campos.length, 0);
  assert.equal(problemaDaEtapa(FORM_VAZIO, etapaPorId("conectar")), null);
});

test("orcamento aceita formato em real e recusa texto", () => {
  assert.equal(orcamentoValido("96"), true);
  assert.equal(orcamentoValido("96,00"), true);
  assert.equal(orcamentoValido("R$ 96,00"), true);
  assert.equal(orcamentoValido("1.234,56"), true);
  assert.equal(orcamentoValido(""), false);
  assert.equal(orcamentoValido("abc"), false);
  assert.equal(orcamentoValido("96,000"), false);

  const form: FormAdicionarAgente = { ...FORM_VAZIO, orcamento: "muito" };
  assert.equal(
    problemaDaEtapa(form, etapaPorId("limites")),
    "Orçamento mensal (R$) precisa ser um número, como 96,00",
  );
});

test("etapa completa de limites passa direto", () => {
  const form: FormAdicionarAgente = { ...FORM_VAZIO, orcamento: "R$ 96,00" };
  assert.equal(problemaDaEtapa(form, etapaPorId("limites")), null);
});

test("formulário inteiro preenchido conclui as 3 primeiras etapas", () => {
  const form: FormAdicionarAgente = {
    nome: "Sofia",
    funcao: "Resolve tickets de primeira resposta",
    plataforma: "zendesk-ai",
    responsavel: "Patrícia Lima",
    entregaPronta: "Ticket respondido com a política certa.",
    comoConfirma: "Prova na origem e nota de quem recebeu.",
    orcamento: "96,00",
    naoPode: "Não efetuar baixa financeira.",
    chamaHumano: "Cobrança contestada.",
  };
  assert.equal(etapasConcluidas(form, 4), 3);
  assert.equal(problemaDaEtapa(form, etapaPorId("quem-e")), null);
  assert.equal(problemaDaEtapa(form, etapaPorId("o-que-entrega")), null);
  assert.equal(problemaDaEtapa(form, etapaPorId("limites")), null);
});
