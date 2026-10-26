# Runbook · migração 0022 (projetos e ambientes) · E1 · T1.10

Escopo: ensaio em **staging**. Produção só depois do ensaio verde e com OK
direto do dono do produto. Este documento não foi executado em servidor
nenhum ainda: a rodada da E1 entregou só o runbook (ver `E1` no plano).

- Up: `lib/db/drizzle/0023_projects_envs.sql` (aplicada pelo migrator no boot,
  `MIGRATE_ON_START=true` em `deploy/docker-compose.prod.yml`).
- Down: `lib/db/drizzle/down/0023_projects_envs.sql` (só à mão; fora da imagem
  e do deploy, garantido pelo `make down-guard`).
- Spec: `specs/003-tenant-projeto-ambiente/`.

Convenções: `<SHA>` = commit a implantar; comandos rodam em `/opt/muster` no
host de staging. Nada de segredo em log ou print: registre só contagens,
tempos e status.

## 0 · Pré-requisitos

- [ ] `make ci` e `make ci-integration` verdes no commit (`ci/woodpecker`).
- [ ] Imagem `sha-<SHA>` publicada.
- [ ] Janela combinada; ninguém mais mexendo em staging.
- [ ] Backup diário de staging do dia existe (`docs/BACKUP-RESTORE.md`).

## 1 · Contagens antes

```sh
docker compose -p muster exec -T postgres psql -U muster -d muster -At -c "
  SELECT 'orgs=' || (SELECT count(*) FROM organizations)
      || ' agentes=' || (SELECT count(*) FROM agents)
      || ' chaves=' || (SELECT count(*) FROM agent_api_keys)
      || ' chaves_ativas=' || (SELECT count(*) FROM agent_api_keys WHERE revoked_at IS NULL)
      || ' outbox_pendente=' || (SELECT count(*) FROM event_outbox WHERE status IN ('pending','processing'))
      || ' ai_usage_linhas=' || (SELECT count(*) FROM ai_usage_daily)
      || ' ai_usage_total=' || (SELECT coalesce(sum(est_cost_usd),0) FROM ai_usage_daily);"
```

Guarde a linha (é o "antes" do relatório).

## 2 · Backup imediatamente antes

```sh
ts=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -p muster exec -T postgres pg_dump -U muster -d muster -Fc > "backups/pre-0022-$ts.dump"
docker compose -p muster exec -T postgres pg_restore --list < "backups/pre-0022-$ts.dump" | head -3
sha256sum "backups/pre-0022-$ts.dump" > "backups/pre-0022-$ts.dump.sha256"
```

Se `MUSTER_BACKUP_S3_BUCKET` estiver configurado, rode também
`sudo systemctl start muster-backup.service` e confira o par no bucket.

## 3 · Aplicação (mede o tempo)

```sh
export MUSTER_IMAGE_TAG=sha-<SHA>
docker compose -p muster -f deploy/docker-compose.prod.yml -f deploy/docker-compose.staging.yml pull
time docker compose -p muster -f deploy/docker-compose.prod.yml -f deploy/docker-compose.staging.yml up -d
docker compose -p muster logs --since 10m muster | grep -E '0022:|migrat' | grep -v -i 'secret\|token'
```

Esperado no log do startup (T1.3), duas linhas:

```
antes 0022: orgs=N projetos=- ambientes=- agentes=M chaves=K
0022: orgs=N projetos=N ambientes=2N agentes=M chaves=K
```

Se o backfill encontrar sobra, a migração aborta inteira (uma transação) com
`0022: backfill incompleto (…)` e o banco fica como estava: vá para o passo 6.

Tempo: registre o `real` do `time` e o intervalo entre as duas linhas de log.
Referência local (Postgres 16 efêmero, base de teste pequena): a 0022 inteira
roda em menos de 1 s; o custo cresce com `agents`, `agent_api_keys` e
`event_outbox` (três `UPDATE` com join e a criação das FKs compostas).

## 4 · Contagens depois

```sh
docker compose -p muster exec -T postgres psql -U muster -d muster -At -c "
  SELECT 'orgs=' || (SELECT count(*) FROM organizations)
      || ' projetos_padrao=' || (SELECT count(*) FROM projects WHERE is_default)
      || ' ambientes=' || (SELECT count(*) FROM environments)
      || ' agentes_sem_projeto=' || (SELECT count(*) FROM agents WHERE project_id IS NULL)
      || ' chaves_prod=' || (SELECT count(*) FROM agent_api_keys k JOIN environments e ON e.id = k.environment_id WHERE e.kind = 'prod')
      || ' chaves=' || (SELECT count(*) FROM agent_api_keys)
      || ' outbox_pendente_com_projeto=' || (SELECT count(*) FROM event_outbox WHERE status IN ('pending','processing') AND project_id IS NOT NULL)
      || ' ai_usage_total=' || (SELECT coalesce(sum(est_cost_usd),0) FROM ai_usage_daily);"
```

Critérios (todos obrigatórios):

| conferência | esperado |
|---|---|
| `projetos_padrao` | = `orgs` |
| `ambientes` | = 2 × total de projetos |
| `agentes_sem_projeto` | 0 |
| `chaves_prod` | = `chaves` (toda `msk_live_` vira prod, D-E1-2) |
| `outbox_pendente_com_projeto` | = `outbox_pendente` do passo 1 (se o worker não consumiu no meio) |
| `ai_usage_total` | igual ao do passo 1 |

## 5 · Verificação funcional

1. `pnpm release:smoke -- http://127.0.0.1:8081` e `/api/healthz`.
2. E2E de agente sem alteração no script: ele emite a chave pela rota sem
   `environment` (logo `msk_live_` = prod, o comportamento antigo) e reporta:
   `MUSTER_BASE_URL=http://localhost:18081 pnpm --filter @workspace/scripts run e2e -- --token-file <arquivo-temporário>`
   (token de sessão do Clerk de desenvolvimento; apague o arquivo ao final).
   Confira também que uma chave `msk_live_` emitida **antes** da 0022 segue
   aceita: um `POST /api/agents/<id>/heartbeat` com ela devolve 202.
3. Matriz 2×2×2 contra o banco de staging **não**: ela cria e apaga dados e
   bancos auxiliares. Rode `make ci-integration` contra um Postgres descartável
   restaurado do dump do passo 2 (ensaio fiel aos dados de staging):

   ```sh
   docker run -d --rm --name muster-0022-ensaio -e POSTGRES_HOST_AUTH_METHOD=trust \
     -e POSTGRES_DB=muster -p 127.0.0.1:55432:5432 postgres:16-alpine
   docker exec -i muster-0022-ensaio pg_restore -U postgres -d muster --no-owner < backups/pre-0022-<ts>.dump
   DATABASE_URL=postgresql://postgres@127.0.0.1:55432/muster make ci-integration
   docker rm -f muster-0022-ensaio
   ```

4. Na UI de staging (pelo túnel de `docs/STAGING-PRIVADO.md`): conectar um
   agente → escolher **Sandbox** → emitir chave → conferir prefixo `msk_sbx_`.
   Prints em mobile e desktop.

## 6 · Rollback

### 6a · Só a imagem (preferível quando o schema está são)

A imagem anterior funciona sobre o schema da 0022 **com uma exceção**: os
triggers preenchem projeto/ambiente nos INSERTs antigos, mas o orçamento de IA
da imagem antiga faz `ON CONFLICT (org_id, day, feature)` em `ai_usage_daily`,
e esse índice único não existe mais (virou `(org_id, project_id, day, feature)
NULLS NOT DISTINCT`). Resultado: os insights de IA falham até o down. Se isso
não for aceitável na janela, faça 6b junto.

```sh
export MUSTER_IMAGE_TAG=sha-<SHA_ANTERIOR>
docker compose -p muster -f deploy/docker-compose.prod.yml -f deploy/docker-compose.staging.yml up -d
```

### 6b · Down manual da 0022

Ordem: volte a imagem (6a) **antes**, senão o boot da imagem nova reaplica a
0022 (o down apaga o registro dela em `drizzle.__drizzle_migrations`).

```sh
docker compose -p muster stop muster
docker compose -p muster exec -T postgres psql -U muster -d muster -v ON_ERROR_STOP=1 -1 \
  < lib/db/drizzle/down/0023_projects_envs.sql
docker compose -p muster start muster
```

O arquivo vem do checkout do commit (não está na imagem, de propósito). O down:
remove triggers/funções, junta `ai_usage_daily` por (org, dia, feature) e
recria o único antigo, remove colunas e FKs novas de `event_outbox`,
`agent_api_keys`, `agents`, apaga `environments` e `projects` e tira a 0022 do
registro do migrator. Agentes, chaves e eventos ficam.

Chaves `msk_sbx_` emitidas depois da 0022 deixam de valer após o down (o
parser antigo só aceita `msk_live_`): avise quem as recebeu.

Depois do down, repita o passo 1: as contagens de `orgs`, `agentes`, `chaves`
e `ai_usage_total` precisam bater com o "antes".

### 6c · Último recurso

Restore do dump do passo 2 com `pg_restore --clean --if-exists`, seguindo
"Restore em produção" de `docs/BACKUP-RESTORE.md` (confirmação explícita,
serviços parados, hash conferido).

## 7 · Evidências para o relatório

- Linhas de contagem antes/depois (passos 1 e 4) e as duas linhas `0022:` do log.
- Tempo da migração (passo 3).
- Saída resumida do smoke, do e2e e do `make ci-integration` no dump restaurado.
- Prints da UI (sandbox).
- Se ensaiado: contagens após o down (6b) e após reaplicar a 0022.

Ensaio verificado localmente nesta rodada (sem servidor): up → down → up em
Postgres 16 efêmero com `pg_dump --schema-only` idêntico ao da 0021 após o
down e idêntico ao da 0022 após reaplicar (`backfill-0022.integration.test.ts`
cobre o mesmo ciclo no CI).
