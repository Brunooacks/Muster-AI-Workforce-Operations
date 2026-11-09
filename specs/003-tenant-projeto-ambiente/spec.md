# Spec 003 · Tenant conta > projeto > ambiente > chave

Status: rascunho para revisão do Arquiteto SaaS (E1 · T1.1).
Branch: `feat/e1-tenant-projeto-ambiente` (empilhada sobre `feat/e0-ci-woodpecker`).
Origem: plano E0+E1 aprovado em 24/10 (decisões D-E1-1..5).

## Contexto

Hoje o tenant do Muster é só a organização (`organizations`). Toda chave de
agente (`msk_live_…`) é implicitamente de produção e todo evento cai no mesmo
balde da organização. Cliente que quer testar um agente antes de ligá-lo em
produção não tem onde fazer isso sem sujar a frota real, e não há como separar
dois produtos da mesma conta.

## Vocabulário

| Termo na API nova | Tabela | Observação |
|---|---|---|
| conta | `organizations` | não é renomeada; muda só o vocabulário |
| projeto | `projects` | toda conta tem um projeto "Padrão" (`is_default`) |
| ambiente | `environments` | exatamente `sandbox` e `prod` por projeto |
| chave | `agent_api_keys` | pertence a um agente, um projeto e um ambiente |

## Histórias

1. **Como admin da conta**, crio um projeto e ele já nasce com os ambientes
   `sandbox` e `prod`.
2. **Como admin da conta**, emito para um agente uma chave de sandbox
   (`msk_sbx_…`) ou de produção (`msk_live_…`); sem escolher, ela é de produção
   (compatível com o comportamento atual).
3. **Como agente** autenticado por chave, só leio e escrevo no meu projeto e no
   ambiente da minha chave. Uma chave de sandbox nunca alcança produção.
4. **Como cliente atual**, minhas chaves `msk_live_…` continuam funcionando sem
   nenhuma ação: viram chaves do projeto Padrão, ambiente prod.
5. **Como operador**, consigo aplicar e reverter a migração 0022 com contagens
   conferidas antes e depois.

## Regras (decisões fechadas)

- **D-E1-1** O ambiente pertence à chave e ao evento (depois à tarefa e ao run).
  O agente é do projeto e vale para os dois ambientes. Config por ambiente, se
  um dia precisar, vira tabela de override (fora da E1).
- **D-E1-2** Todas as chaves `msk_live_` atuais viram **prod** no backfill.
- **D-E1-3** Só `agents`, `agent_api_keys` e `event_outbox` ganham projeto, mais
  `project_id` **anulável** em `ai_usage_daily`. As demais tabelas-raiz seguem
  org-wide.
- **D-E1-4** Códigos para quem entra com chave de agente:
  - chave ausente, malformada, inválida, revogada ou com prefixo divergente do
    ambiente registrado → **401**;
  - recurso de outro projeto ou de outra conta → **404**, com corpo idêntico ao
    de recurso inexistente;
  - chave sandbox pedindo recurso/evento prod → **403**
    `{"error":"Chave de sandbox não acessa produção."}`.
- **D-E1-5** `lib/db/drizzle/down/` fica fora do caminho do drizzle e do deploy;
  o `make ci` falha se o deploy tocar em `down/` (guarda da T0.7).
- **Decisão em aberto 1 (adotada como proposta)** Chave **prod** pedindo
  recurso **sandbox** do mesmo projeto → **404** (o recurso não existe naquele
  ambiente). Fica marcada para confirmação do Arquiteto.

## Ordem de avaliação (credencial de agente)

1. Token: formato, prefixo de ambiente, hash e revogação → 401.
2. Projeto/conta do recurso pedido ≠ projeto/conta da chave → 404.
3. Ambiente pedido (`environment` na query ou no corpo; ausente = o da chave):
   sandbox→prod 403; prod→sandbox 404.
4. Agente do caminho ≠ agente da chave → 404 (antes era 401).
5. Segue para a rota.

A ordem importa: 404 de projeto vem antes do 403 de ambiente, então quem não
pertence ao projeto não descobre nada sobre os ambientes dele.

## Contratos (rotas novas e alteradas)

| Rota | Auth | Mudança |
|---|---|---|
| `POST /api/agents/:agentId/events` | chave de agente | grava `project_id`/`environment_id` da chave no outbox; aceita `environment` opcional; 404 em vez de 401 para agente de outra chave |
| `POST /api/agents/:agentId/heartbeat` | chave de agente | idem (aceita `environment`) |
| `GET /api/runtime/agents` | chave de agente | **nova** · agentes do projeto da chave (`?project=`, `?environment=`) |
| `GET /api/runtime/agents/:agentId` | chave de agente | **nova** · o próprio agente |
| `GET /api/runtime/agents/:agentId/events` | chave de agente | **nova** · eventos do outbox do agente no ambiente da chave |
| `GET /api/runtime/agents/:agentId/api-keys` | chave de agente | **nova** · chaves (mascaradas) do agente no ambiente da chave |
| `GET /api/agents/:agentId/api-keys` | sessão | resposta ganha `projectId`, `environment` |
| `POST /api/agents/:agentId/api-keys` | sessão admin | aceita `environment: "sandbox" \| "prod"` (padrão `prod`) |
| `POST /api/agents` | sessão | aceita `projectId` (padrão: projeto Padrão da conta) |
| `GET /api/projects` | sessão | **nova** · projetos da conta |
| `POST /api/projects` | sessão admin | **nova** · cria projeto + 2 ambientes |
| `GET /api/projects/:projectId/environments` | sessão | **nova** · ambientes do projeto |

Sessões humanas (Clerk) seguem org-wide; `?project=` opcional fica para quando
a UI tiver seletor de projeto (fora da E1).

Envelope de tarefa (T1.8): `lib/api-spec/task-envelope.schema.json` com
`task_id`, `org_id`, `project_id`, `environment`, `agent_id`, `stage`, `attempt`,
`max_attempts` (padrão 8, D-E3-1), `idempotency_key`, `payload`. Só contrato; a
E3 consome.

## Critério de saída

- Matriz 2 contas × 2 projetos × 2 ambientes sem leitura nem escrita cruzada:
  outro projeto/conta 404, sandbox→prod 403, prod→sandbox 404, mesma célula 2xx;
  chave revogada e forjada 401 em todas as rotas.
- `up → down → up` reversível, com schema após o down idêntico ao da 0021.
- Chaves `msk_live_` atuais seguem funcionando.

## Fora do escopo

- Renomear `organizations`; RLS no Postgres; UI de seletor de projeto.
- Projeto/ambiente nas demais tabelas-raiz (areas, teams, purposes, connectors,
  journeys, catalog_metrics…).
- Aplicar em staging ou prod (T1.10 entrega só o runbook nesta rodada).
