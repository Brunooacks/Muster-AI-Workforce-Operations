# Data model · 003 tenant-projeto-ambiente (migração 0022)

## Tabelas novas

### `projects`
| coluna | tipo | regra |
|---|---|---|
| `id` | text PK | uuid |
| `org_id` | text NOT NULL | FK `organizations(id)` ON DELETE CASCADE |
| `name` | text NOT NULL | |
| `slug` | text NOT NULL | único em `(org_id, slug)` |
| `is_default` | boolean NOT NULL DEFAULT false | índice parcial único `(org_id) WHERE is_default` |
| `created_at`, `updated_at` | timestamptz NOT NULL DEFAULT now() | |

Restrição auxiliar `UNIQUE (id, org_id)` (`projects_id_org_unique`): alvo das
FKs compostas.

### `environments`
| coluna | tipo | regra |
|---|---|---|
| `id` | text PK | uuid |
| `org_id` | text NOT NULL | denormalizado; FK `organizations(id)` CASCADE |
| `project_id` | text NOT NULL | FK composta `(project_id, org_id) → projects(id, org_id)` ON DELETE CASCADE |
| `kind` | text NOT NULL | `CHECK (kind IN ('sandbox','prod'))` |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Único `(project_id, kind)`. Restrição auxiliar `UNIQUE (id, project_id, org_id)`.
A FK composta impede ambiente apontar para projeto de outra conta.

## Colunas novas

| tabela | coluna | nulo? | FK |
|---|---|---|---|
| `agents` | `project_id` | NOT NULL | `(project_id, org_id) → projects(id, org_id)` |
| `agent_api_keys` | `project_id` | NOT NULL | `(agent_id, project_id, org_id) → agents(id, project_id, org_id)` |
| `agent_api_keys` | `environment_id` | NOT NULL | `(environment_id, project_id, org_id) → environments(id, project_id, org_id)` |
| `event_outbox` | `project_id` | NULL | `(project_id, org_id) → projects(id, org_id)` |
| `event_outbox` | `environment_id` | NULL | `(environment_id, project_id, org_id) → environments(…)` + `CHECK (environment_id IS NULL OR project_id IS NOT NULL)` |
| `ai_usage_daily` | `project_id` | NULL | `(project_id, org_id) → projects(id, org_id)` |

`agents` ganha `UNIQUE (id, project_id, org_id)` para a FK da chave: assim a
chave não pode ser de um projeto diferente do agente dela. Consequência: mover
agente de projeto exige reemitir as chaves (não há rota para isso na E1).

FKs para `projects`/`environments` usam `NO ACTION` (checadas no fim do
comando), então apagar a organização continua cascateando tudo de uma vez.

## Índices

- `agents_org_project_idx (org_id, project_id)`
- `agent_api_keys_org_project_env_idx (org_id, project_id, environment_id)`
- `event_outbox_org_project_env_idx (org_id, project_id, environment_id, created_at)`
- `ai_usage_daily_org_project_day_idx (org_id, project_id, day)`
- `ai_usage_daily`: o único `ai_usage_daily_org_day_feature_idx (org_id, day, feature)`
  vira a restrição `ai_usage_daily_org_project_day_feature_unique
  UNIQUE NULLS NOT DISTINCT (org_id, project_id, day, feature)` (Postgres 15+;
  o repo usa 16). Linhas sem projeto continuam colidindo entre si como antes.

## Compatibilidade (triggers)

Para que todo `INSERT` existente (rotas, seed, scripts, fixtures de teste)
continue válido sem conhecer projeto, a 0022 cria três triggers:

| trigger | quando | faz |
|---|---|---|
| `organizations_default_project_trg` | AFTER INSERT em `organizations` | cria o projeto "Padrão" + `sandbox`/`prod` (`ON CONFLICT DO NOTHING`) |
| `agents_default_project_trg` | BEFORE INSERT em `agents` | `project_id` NULL → projeto Padrão da org |
| `agent_api_keys_scope_trg` | BEFORE INSERT em `agent_api_keys` | `project_id` NULL → projeto do agente; `environment_id` NULL → ambiente `prod` do projeto (D-E1-2) |

No Drizzle essas colunas são `notNull()` com `$defaultFn(() => sql\`default\`)`:
o tipo de insert as aceita opcionais e o SQL envia `DEFAULT`, que o trigger
preenche. Quem sabe o projeto (rota de chave, criação de agente com
`projectId`) passa o valor explícito.

## Backfill (dentro da 0022, idempotente)

1. 1 projeto `Padrão` (`slug = 'padrao'`, `is_default = true`) por organização.
2. 2 ambientes (`sandbox`, `prod`) por projeto.
3. `agents.project_id` = projeto Padrão da org.
4. `agent_api_keys` → projeto do agente + ambiente **prod**.
5. `event_outbox` pendentes → Padrão/prod; processados ficam NULL.
6. `ai_usage_daily` sem backfill (histórico NULL).

"Pendente" = `status IN ('pending','processing')`; `completed` e `dead-letter`
são processados e ficam NULL.

Guarda: bloco `DO $$` aborta a migração se sobrar `project_id` NULL em `agents`
ou `agent_api_keys`, `environment_id` NULL em `agent_api_keys`, ou se
`count(projetos default) <> count(organizations)`.

## Down (`lib/db/drizzle/down/0022_projects_envs.sql`)

Ordem inversa: triggers e funções → restrição/índices novos de
`ai_usage_daily` (recria o único antigo) → FKs/índices/colunas de
`event_outbox`, `agent_api_keys`, `agents` → `environments` → `projects`.
Dados de agentes e chaves são preservados (só as colunas novas saem).
