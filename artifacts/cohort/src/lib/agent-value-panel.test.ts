import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentValueResponse } from "@workspace/api-client-react";
import { AgentValuePanel } from "../components/agent-value-panel";

Object.assign(globalThis, { React });

function response(overrides: Partial<AgentValueResponse> = {}): AgentValueResponse {
  return {
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-10-11T00:00:00.000Z",
    metrics: {
      BRL: {
        status: "available",
        currency: "BRL",
        totalCost: { cents: 1234, currency: "BRL", provenance: { kind: "observed", sources: ["execution"] } },
        costPerValidatedTask: { cents: 617, currency: "BRL", provenance: { kind: "derived", sources: ["validation"] } },
        humanCostPerTask: null,
        breakEven: null,
        validationBySource: {},
      },
      USD: {
        status: "available",
        currency: "USD",
        totalCost: { cents: 900, currency: "USD", provenance: { kind: "observed", sources: ["execution"] } },
        costPerValidatedTask: { cents: 450, currency: "USD", provenance: { kind: "derived", sources: ["validation"] } },
        humanCostPerTask: null,
        breakEven: null,
        validationBySource: {},
      },
    },
    validationByStatus: { validated: 2, rejected: 1, unvalidated: 3 },
    tasksWithoutCurrency: { count: 1, taskRunIds: ["run-sem-moeda"] },
    ...overrides,
  };
}

function render(props: Parameters<typeof AgentValuePanel>[0]) {
  return renderToStaticMarkup(createElement(AgentValuePanel, props));
}

test("mostra carregamento enquanto busca o custo por tarefa", () => {
  const html = render({ window: "30d", isLoading: true });

  assert.match(html, /Carregando custo por tarefa validada/);
});

test("trata erro e agente não encontrado sem confundir os estados", () => {
  const erro = render({ window: "30d", isError: true, error: { status: 500 } });
  const notFound = render({ window: "30d", isError: true, error: { status: 404 } });

  assert.match(erro, /Não foi possível carregar o custo por tarefa validada/);
  assert.match(notFound, /Agente não encontrado para este painel/);
});

test("orienta o envio de validação quando não há tarefas validadas", () => {
  const html = render({
    window: "30d",
    data: response({ validationByStatus: { validated: 0, rejected: 1, unvalidated: 2 } }),
  });

  assert.match(html, /Ainda não há tarefas validadas nesta janela/);
  assert.match(html, /href="\/docs\/validacao-de-tarefas\.html"/);
  assert.match(html, /Como enviar validação/);
});

test("separa BRL e USD e mostra contagens e aviso de moeda ausente", () => {
  const html = render({ window: "30d", data: response() });

  assert.match(html, /R\$\s*6,17/);
  assert.match(html, /US\$\s*4,50/);
  assert.match(html, /2 validadas/);
  assert.match(html, /1 rejeitada/);
  assert.match(html, /3 não validadas/);
  assert.match(html, /1 tarefa sem moeda única/);
  assert.match(html, />7d</);
  assert.match(html, />30d</);
  assert.match(html, />90d</);
});

test("explica quando a moeda ainda não tem evidência observada suficiente", () => {
  const html = render({
    window: "30d",
    data: response({
      metrics: { BRL: { status: "insufficient_evidence", reason: "no_observed_validations" } },
      validationByStatus: { validated: 1, rejected: 0, unvalidated: 0 },
      tasksWithoutCurrency: { count: 0, taskRunIds: [] },
    }),
  });

  assert.match(html, />BRL</);
  assert.match(html, /Sem evidência observada suficiente/);
});
