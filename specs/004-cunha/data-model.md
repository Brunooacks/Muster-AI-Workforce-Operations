# Data model · 004 cunha

Migrações 0023–0026, cada uma com down manual em `lib/db/drizzle/down/`
(fora do migrator e da imagem, D-E1-5).

## 0023 · `agent_events` no formato do envelope (C1.2)

Colunas novas, todas anuláveis:

| coluna | tipo | regra |
|---|---|---|
| `org_id`, `project_id`, `environment_id` | text | da credencial; backfill pelo agente; ambiente histórico = prod. Trigger preenche conta/projeto quando o INSERT não informa |
| `task_id` | text | `x-veltrix-task` |
| `run_id` | text | `x-veltrix-run` |
| `attempt` | int | `CHECK attempt >= 1` |
| `retry_of` | text | `run_id` da tentativa anterior |
| `expected`, `actual` | jsonb | esperado × obtido (camada 2) |
| `accepted_by` | text | quem decidiu (pessoa ou regra) |
| `accepted_by_kind` | text | `CHECK IN ('human','auto')` |
| `accepted_rule_version` | text | `CHECK accepted_by_kind <> 'auto' OR accepted_rule_version IS NOT NULL` |
| `accepted_at` | timestamptz | não nulo = tarefa aceita por este evento |
| `capabilities` | jsonb | `{tools, vision, contextWindow}` usados na tarefa |
| `rework_count` | int | `CHECK >= 0` |
| `human_minutes` | numeric(8,2) | revisão (em `human_review`) ou retrabalho (demais kinds); `CHECK >= 0` |
| `context_tokens` | int | tokens de contexto dentro de `tokens_in` |
| `model` | text | modelo usado no run |

Kind novo: `human_review` (sem CHECK de kind na tabela; o tipo TS e o OpenAPI
mudam). Em `human_review`, `success` = decisão (1 aprovado, 0 rejeitado),
`accepted_by` = revisor, `accepted_by_kind = 'human'`, `accepted_at` só quando
aprovado.

Restrições e índices:

- FKs compostas `(project_id, org_id) → projects`, `(environment_id,
  project_id, org_id) → environments` e `(agent_id, project_id, org_id) →
  agents`; `CHECK environment_id IS NULL OR project_id IS NOT NULL`.
- `agent_events_org_project_env_ts_idx (org_id, project_id, environment_id, ts)`.
- `agent_events_task_attempt_idx` único parcial `(org_id, task_id, attempt)
  WHERE task_id IS NOT NULL AND kind IN ('execution','error')` — um resultado
  terminal por tentativa; `escalation`, `feedback` e `human_review` anotam a
  tentativa e podem repetir.
- `agent_events_org_run_idx (org_id, run_id) WHERE run_id IS NOT NULL` (busca do
  `retryOf`).

## 0024 · `agent_contracts` (C2.1)

`id, org_id, project_id, agent_id, version, metric_key, unit, direction
('up'|'down'), baseline numeric, target numeric, "limit" numeric?, deadline
date, owner_member_id → organization_members, status ('draft'|'active'|
'superseded'), created_by, created_at, superseded_at?, reference_human_minutes
numeric?, require_human_accept bool default false, reference_model text?`.

- Único `(agent_id, version)`; único parcial `(agent_id) WHERE status = 'active'`.
- FK composta `(agent_id, project_id, org_id) → agents`.
- Trigger `agent_contracts_immutable`: UPDATE só muda `status`/`superseded_at`
  (transições `draft→active`, `draft→superseded`, `active→superseded`); DELETE
  é recusado, exceto em cascata da exclusão do agente/conta.
- `verdicts` ganha `contract_id → agent_contracts` e `contract_version`,
  anuláveis (vereditos antigos ficam nulos).

## 0025 · `role_rates` e `off_invoice_costs` (C3.1)

`role_rates`: `id, org_id, area_id?, role, hourly_cost_cents int, currency
('BRL'|'USD'), valid_from date, valid_to date?, created_by, created_at`.
CHECKs: valor ≥ 0, `valid_to >= valid_from`.

`off_invoice_costs`: `id, org_id, project_id?, agent_id?, category
('license'|'infra'|'integration'|'other'), amount_cents int, currency,
period_start, period_end, allocation ('agent'|'project'|'per_task'),
description?, created_by, created_at`. CHECKs: valor ≥ 0, fim ≥ início,
`allocation = 'agent'` exige `agent_id`, `allocation = 'project'` exige
`project_id`.

Sem seed e sem default global (R4). Ambas são tabelas-raiz (escopo `inOrg`).

## 0026 · `outcome_snapshots` (C4.4)

`id, org_id, project_id, environment_id?, agent_id, period ('YYYY-MM'),
layer1, layer2, signals jsonb, contract_id?, contract_version?, calc_version,
inputs_hash, inputs jsonb, role_rates_snapshot jsonb, prices_snapshot jsonb?,
reference_model?, price_version?, task_coverage numeric?, created_at`.

- Único `(agent_id, period, calc_version, inputs_hash)`.
- Imutável: trigger recusa UPDATE e DELETE (exceto cascata).
- `inputs` guarda as tarefas normalizadas usadas no cálculo: com `inputs`,
  `role_rates_snapshot` e `prices_snapshot` o cálculo é reproduzido sem ler
  outras tabelas (desvio aditivo do plano, que só pedia o hash).
