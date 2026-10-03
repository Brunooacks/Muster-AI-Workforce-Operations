# Runbook operacional do MVP

Este é o procedimento operacional do Muster para o MVP. Ele cobre a operação
no droplet compartilhado sem alterar nenhum recurso da Veltrix.

## 1. Visão e limites operacionais

- O projeto Compose é `muster` e a cópia operacional do repositório fica em
  `/opt/muster`.
- A aplicação publica apenas `127.0.0.1:8081`; o PostgreSQL não é exposto.
  O acesso de staging permanece privado até a configuração posterior do vhost.
- O host é compartilhado, mas a rede, o volume e os containers do Muster usam
  os recursos `muster-*`. Não operar nem reiniciar serviços de outro projeto.
- Os environments `staging` e `production` devem ter aprovadores configurados
  antes de habilitar qualquer entrega. O workflow atualmente entrega pelo
  environment `staging`; o mesmo critério de aprovação se aplica quando a
  produção for habilitada.
- `MUSTER_DEPLOY_ENABLED` é o kill switch. Enquanto não for exatamente `true`,
  o workflow de deploy não inicia nem o build/push da imagem no GHCR.

## 2. Deploy normal e de emergência

### Fluxo normal

1. Confirme que o CI do commit em `main` terminou verde.
2. O evento `workflow_run` do workflow `CI` em `main` inicia o workflow
   **Deploy**, desde que `MUSTER_DEPLOY_ENABLED=true`.
3. O aprovador do environment autoriza a execução. O workflow constrói e envia
   `ghcr.io/brunooacks/muster:sha-<SHA>` e chama `remote-deploy.sh` no SHA exato.
4. A execução remota faz o backup local, sobe a imagem imutável, espera o
   healthcheck, valida o SHA no health endpoint e executa o smoke release.

### Emergência pelo GitHub

Use **Actions → Deploy → Run workflow**, informando somente o SHA completo de
40 caracteres, em minúsculas. Aguarde a aprovação do environment e preserve o
registro da execução. Não use tag móvel como entrada.

### Emergência sem GitHub

Um operador com acesso já autorizado ao host deve executar, em `/opt/muster`:

```sh
./deploy/remote-deploy.sh <SHA-de-40-caracteres>
```

Esse é o equivalente manual aprovado: o script aplica `sha-<SHA>`, cria o
backup pré-deploy, aguarda a saúde, executa `scripts/release-smoke.sh`, persiste
a tag somente após sucesso e aciona rollback automático em falha. Não copie,
imprima nem edite o conteúdo de `.env.production` no terminal ou em tickets.

## 3. Rollback

### Automático

`remote-deploy.sh` lê a tag selecionada antes da tentativa. Se o candidate não
fica saudável, não devolve o SHA solicitado por `/api/healthz` ou falha no
smoke, ele volta à tag anterior conhecida. Se não houver tag anterior válida,
o candidate é parado; trate esse caso como incidente.

### Manual

Primeiro identifique no histórico operacional a tag anterior
`sha-<SHA-anterior>`. No host, use o mesmo arquivo Compose e a tag imutável:

```sh
MUSTER_IMAGE_TAG=sha-<SHA-anterior> \
  docker compose --project-directory /opt/muster \
  --env-file /opt/muster/.env.production \
  -f /opt/muster/deploy/docker-compose.prod.yml pull

MUSTER_IMAGE_TAG=sha-<SHA-anterior> \
  docker compose --project-directory /opt/muster \
  --env-file /opt/muster/.env.production \
  -f /opt/muster/deploy/docker-compose.prod.yml up -d

curl -s 127.0.0.1:8081/api/healthz | jq .sha
```

O valor retornado deve ser `<SHA-anterior>`. Em seguida, rode o smoke local:

```sh
MUSTER_BASE_URL=http://127.0.0.1:8081 bash scripts/release-smoke.sh
```

Registre o SHA restaurado, a causa e o resultado no incidente. Se o healthcheck
ou o smoke falhar, mantenha a mitigação e escale; não tente uma terceira tag sem
uma hipótese documentada.

## 4. Backup e restore

Antes de cada deploy, `deploy/remote-deploy.sh` cria em
`/opt/muster/backups` um dump compactado do PostgreSQL e mantém os sete mais
recentes. Confirme a presença e o timestamp sem abrir o conteúdo:

```sh
ls -lht /opt/muster/backups/postgres-*.sql.gz
```

O backup diário no R2 e os procedimentos de restore são entregues pela
MUS-161, nos caminhos `deploy/backup/*` e
[`docs/BACKUP-RESTORE.md`](BACKUP-RESTORE.md). Quando essa entrega estiver
disponível, siga-a nesta ordem:

1. Escolha o dump e valide o restore em um banco descartável.
2. Registre a integridade funcional do banco descartável e o tempo:
   `<preencher no ensaio>`.
3. Obtenha a aprovação explícita para a janela de produção.
4. Execute o procedimento de restore em produção daquele guia e repita
   `/api/healthz` e o smoke release.
5. Registre o tempo total de produção: `<preencher no ensaio>`.

O ensaio depende da MUS-161 e do staging da MUS-163; não foi executado neste
documento nem deve ser marcado como concluído antes desse acesso.

## 5. Rotação de segredos

As regras específicas e o inventário de segredos ficam em
[`docs/SEGREDOS.md`](SEGREDOS.md), entrega paralela da PR #27. Até ela estar
disponível, use este procedimento genérico:

1. Abra uma mudança com owner, escopo, janela e plano de reversão; nunca inclua
   o valor do segredo nela.
2. Gere o novo valor no provedor autorizado e atualize o secret/environment
   correspondente, com acesso restrito.
3. Reinicie ou redeploye somente o Muster no environment aprovado.
4. Valide `/api/healthz`, o smoke e o fluxo que usa a credencial rotacionada.
5. Revogue o valor anterior somente depois da validação; registre o horário e
   o responsável, sem registrar valores.

## 6. Incidente

### Triagem

Comece pelo horário, impacto, `requestId` e `orgId`. Os logs estruturados de
auditoria carregam `requestId`, `orgId` e `userId`; o `x-request-id` recebido é
preservado quando tem formato válido.

```sh
docker compose -p muster logs --since 30m muster \
  | jq -Rrc 'fromjson? | select(.requestId == "<REQUEST_ID>" or .orgId == "<ORG_ID>")'
```

Para um problema do worker, confira também:

```sh
curl -s 127.0.0.1:8081/api/healthz/worker | jq .
```

Esse endpoint retorna degradação quando houver dead letter, fila pendente por
mais de 60 segundos ou worker habilitado que não esteja rodando.

### Pausar telemetria contínua

No arquivo de ambiente restrito, defina
`CONTINUOUS_TELEMETRY_WORKER_ENABLED=false` e aplique apenas o serviço Muster:

```sh
docker compose --project-directory /opt/muster \
  --env-file /opt/muster/.env.production \
  -f /opt/muster/deploy/docker-compose.prod.yml up -d muster
```

Confirme que `/api/healthz/worker` informa `worker.enabled: false`. Para
retomar, remova o opt-out ou defina o valor habilitado conforme a política e
repita o restart. Pausar o worker não autoriza apagar eventos ou filas.

### Desligar IA

Defina `AI_MONTHLY_BUDGET_USD=0` no ambiente restrito e reinicie o Muster com o
mesmo comando acima. O orçamento passa a indisponível: recursos de IA devolvem
o resultado determinístico, a UI mostra **Sem insight de IA** e a operação não
deve responder 5xx por isso. Para retomar, restaure um teto positivo aprovado e
valide o fluxo; preço, modelo, endpoint e credenciais continuam obrigatórios.

### Comunicação e uptime

Envie aos design partners uma atualização curta, sem IDs de outras organizações
nem detalhes de credenciais:

> Identificamos uma instabilidade no Muster em `<HORÁRIO>`. O impacto atual é
> `<IMPACTO>`; a mitigação aplicada foi `<MITIGAÇÃO>`. Próxima atualização até
> `<HORÁRIO>`. Para suporte, responda nesta conversa com o `requestId`, se
> disponível.

O workflow **Uptime** verifica `MUSTER_HEALTH_URL` a cada 15 minutos. Quando a
URL configurada falha, ele abre ou atualiza a issue GitHub `Uptime check failed`
com o label `uptime`; quando normaliza, fecha a mesma issue. Vincule essa issue
ao incidente em vez de criar alertas duplicados.

## 7. Capacidade do droplet compartilhado

O Compose limita Postgres a `256m` e Muster a `512m`. Planeje a saída do droplet
compartilhado se, com o Muster em pé, a RAM livre ficar abaixo de 2 GB ou o uso
de memória superar 60% de forma sustentada. Meça antes de decidir:

```sh
free -h
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
docker compose -p muster ps
```

Registre horário, memória disponível, uso por container, carga e tendência. A
mudança de capacidade ou de host requer planejamento separado; não altere
serviços vizinhos no droplet.

## 8. Checklist de ensaio em staging

Preencher somente durante o ensaio autorizado após MUS-163 e MUS-161. Não
registre segredos, tokens, URLs privadas nem conteúdo de dumps.

| Procedimento         | Comando de referência                                   | Evidência esperada                                                   | Tempo / saída           |
| -------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- |
| Deploy normal        | Execução do workflow **Deploy** após CI verde em `main` | aprovação, imagem `sha-<SHA>`, health e smoke verdes                 | `<preencher no ensaio>` |
| Deploy de emergência | `./deploy/remote-deploy.sh <SHA-de-40-caracteres>`      | mesmo SHA em `/api/healthz` e smoke verde                            | `<preencher no ensaio>` |
| Rollback automático  | induzir falha controlada aprovada no ensaio             | retorno à tag anterior e health com SHA anterior                     | `<preencher no ensaio>` |
| Rollback manual      | comandos da seção 3                                     | `curl -s 127.0.0.1:8081/api/healthz \| jq .sha` retorna SHA anterior | `<preencher no ensaio>` |
| Backup pré-deploy    | `ls -lht /opt/muster/backups/postgres-*.sql.gz`         | dump novo e retenção de até sete arquivos                            | `<preencher no ensaio>` |
| Restore descartável  | procedimento de `deploy/backup/*`                       | banco restaurado e validação funcional                               | `<preencher no ensaio>` |
| Pausa do worker      | `CONTINUOUS_TELEMETRY_WORKER_ENABLED=false` + restart   | `worker.enabled: false` em `/api/healthz/worker`                     | `<preencher no ensaio>` |
| IA desligada         | `AI_MONTHLY_BUDGET_USD=0` + restart                     | resultado determinístico, sem 5xx e sem insight de IA                | `<preencher no ensaio>` |
| Uptime               | disparo manual do workflow **Uptime**                   | issue `uptime` criada/atualizada ou encerrada                        | `<preencher no ensaio>` |
| Capacidade           | `free -h` e `docker stats --no-stream`                  | memória livre e uso registrados                                      | `<preencher no ensaio>` |
