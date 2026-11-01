/**
 * RG-M16 (01/11): Visão geral de org nova mostrava "—" (barra preta no tipo
 * display) antes de "entregas registradas" e "saúde média de 0%" com 0
 * profissionais. Vazio mostra "0" e esconde a saúde sem agentes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { leituraOperacional } from "./visao-geral";

test("RG-M16: número do vazio é 0, nunca traço", () => {
  const l = leituraOperacional({ periodo: "Este mês", agents: [], alertas: [], totalAgents: 0, saudeMedia: 0 });
  assert.equal(l.numero.valor, "0");
});

test("RG-M16: sem agentes não fala de saúde média", () => {
  const l = leituraOperacional({ periodo: "Este mês", agents: [], alertas: [], totalAgents: 0, saudeMedia: 0 });
  assert.doesNotMatch(l.frase, /saúde média/);
  assert.doesNotMatch(l.frase, /\b0 profissionais/);
});

test("RG-M16: agentes sem entregas não mostram saúde 0%", () => {
  const l = leituraOperacional({ periodo: "Este mês", agents: [], alertas: [], totalAgents: 3, saudeMedia: 0 });
  assert.match(l.frase, /3 profissionais monitorados/);
  assert.doesNotMatch(l.frase, /saúde média de 0%/);
  const um = leituraOperacional({ periodo: "Este mês", agents: [], alertas: [], totalAgents: 1, saudeMedia: 0 });
  assert.match(um.frase, /1 profissional monitorado;/);
});
