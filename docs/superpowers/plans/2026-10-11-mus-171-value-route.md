# MUS-171 Value Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular e expor por API o custo por tarefa validada, separado por moeda e por organização.

**Architecture:** Um agregador puro reduz eventos de telemetria a tarefas e delega cada moeda à métrica existente. A rota autenticada verifica a posse do agente, busca a janela de eventos e serializa a agregação segundo o contrato OpenAPI gerado.

**Tech Stack:** TypeScript, Express 5, Drizzle ORM, Zod/Orval e Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-mus-171-value-route-design.md`

## Global Constraints

- Não converter moeda; BRL e USD permanecem em métricas distintas.
- Preservar o escopo da organização para agente e eventos.
- Não adicionar dependências, UI ou migrações.

## Review Focus

- Feedback sem execução não pode criar custo ou inflar contagens.
- Sem `currency`, a tarefa precisa ser sinalizada e excluída dos totais.
- O último feedback da janela deve determinar a validação da tarefa.
- A janela inclui exatamente os limites `from` e `to`.
- Um ID conhecido de outra organização deve responder 404.

### Task 1: Métrica por tarefa e moeda

**Files:**
- Create: `artifacts/api-server/src/lib/value/task-value.ts`
- Test: `artifacts/api-server/src/lib/value/task-value.test.ts`
- Modify: `artifacts/api-server/src/lib/value/cost-per-validated-task.ts`

**Interfaces:**
- Produces: `aggregateTaskValue(events)` com métricas por moeda, contagens de validação e tarefas sem moeda.

- [x] Escrever testes de falha para agrupamento por tarefa, feedback e moedas.
- [x] Executar o teste e confirmar a falha por módulo ausente.
- [x] Implementar o agregador e generalizar a métrica para manter a moeda de saída.
- [x] Executar o teste e confirmar sucesso.
- [x] Commitar a métrica e seus testes.

### Task 2: Rota e contrato público

**Files:**
- Modify: `artifacts/api-server/src/routes/agents.ts`
- Create: `artifacts/api-server/src/routes/agent-value.test.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Modify: `lib/api-zod/src/generated/*`
- Modify: `lib/api-client-react/src/generated/*`

**Interfaces:**
- Consumes: `aggregateTaskValue(events)` da Task 1.
- Produces: `GET /agents/{agentId}/value?from&to`.

- [x] Escrever testes de falha para 200, 404 cross-org e filtros da janela.
- [x] Executar o teste e confirmar a falha pela rota ausente.
- [x] Adicionar o contrato OpenAPI, regenerar clients e implementar a rota com escopo por organização.
- [x] Executar testes de rota e confirmar sucesso.
- [ ] Commitar rota, contrato gerado e testes.
