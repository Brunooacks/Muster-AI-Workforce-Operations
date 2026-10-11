# MUS-171 — agregação e rota de valor por tarefa

## Objetivo

Expor o custo por tarefa validada de um agente, dentro de uma janela temporal
e isolado pela organização autenticada, sem converter nem somar moedas.

## Desenho

O módulo de valor transforma as linhas de `agent_events` em tarefas por
`task_run_id`. Apenas uma tarefa com ao menos uma execução (`execution`,
`error` ou `escalation`) entra no cálculo; seus custos são somados e o
feedback mais recente fornece `metadata.validation`. Tarefas sem feedback são
`unvalidated`; feedback sem execução não cria tarefa. As tarefas com BRL e USD
são enviadas separadamente para `calculateCostPerValidatedTask`; tarefas sem
moeda são sinalizadas, mas não entram em nenhum total monetário.

A rota `GET /agents/{agentId}/value?from&to` exige autenticação e organização.
Ela primeiro busca o agente por `id` e `org_id`, devolvendo 404 tanto para
agente inexistente quanto de outra organização. Em seguida filtra eventos do
agente por `ts >= from` e `ts <= to`, e devolve as métricas por moeda, as
contagens dos três status e o sinalizador de moeda ausente. `from` e `to` são
timestamps ISO obrigatórios e pertencem ao contrato OpenAPI gerado.

## Limites

Não há conversão FX, referência de custo humano, UI, migração nem alteração no
contrato de ingestão. O RBAC de leitura segue as rotas vizinhas: `requireAuth`
e `requireOrg`, que confirma a associação à organização ativa.

## Testes

Testes puros cobrem múltiplas tarefas, moeda mista, falta de validação e
feedback sem execução. Testes de rota, com o limite de banco simulado, cobrem
200, 404 cross-org e os limites temporais da janela. A geração do OpenAPI e os
testes/tipo/build do pacote API confirmam o contrato público.
