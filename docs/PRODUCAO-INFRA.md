# Infra de produção do Muster (decisão de 11/10/2026)

Este documento fecha a decisão de hospedagem do Muster para os design partners
e lista o que já está pronto no repositório e o que só o Bruno pode fazer.
Nada aqui foi executado no droplet: não houve deploy, `sudo`, leitura de
`.env` nem mudança no Veltrix.

## Decisão

**Mesmo droplet do Veltrix (143.198.113.231), com isolamento estrito e
entrada pública por Cloudflare Tunnel.** Sem custo novo.

| Opção | Custo | Risco ao Veltrix | Esforço | Veredito |
| --- | --- | --- | --- | --- |
| Mesmo droplet + Cloudflare Tunnel (escolhida) | R$ 0 | Baixo, limitado pelos tetos abaixo | Baixo: só containers do projeto `muster` | **Sim** |
| Mesmo droplet + vhost no Nginx do host (plano original da MUS-158) | R$ 0 | Médio: o Nginx e o certificado são do Veltrix; um reload com erro derruba os dois | Médio: root, Origin Certificate, `nginx -t` | Plano B |
| Droplet separado | ~US$ 6–12/mês | Nenhum | Médio | Não: custo novo recusado |
| Opções grátis fora da DigitalOcean (Fly/Render/Railway free) | R$ 0 com limites | Nenhum | Alto: Postgres grátis expira ou dorme; sem SLA | Não para produção |

Por que o túnel: o `cloudflared` roda como mais um container do projeto
`muster`, abre só conexões de **saída** para a Cloudflare e entrega o tráfego
em `http://muster:8080` pela rede interna `muster-internal`. Não abre porta no
droplet, não toca no Nginx (`api.veltrixplatform.com` é servido pelo
`nginx/1.18.0` do host, sem proxy da Cloudflare), não precisa de certificado
de origem e funciona com SSE (o stream já manda keep-alive). O túnel é grátis
e não exige cartão na Cloudflare.

## Capacidade medida (11/10/2026 01:06 BRT, somente leitura)

Comandos: `free -m`, `nproc`, `df -h /`, `docker stats --no-stream`, pelo
usuário `veltrix` que já faz os deploys do Veltrix (sem `sudo`).

| Recurso | Total | Em uso | Livre |
| --- | --- | --- | --- |
| vCPU | 2 | Veltrix ~0,5% em repouso | — |
| RAM | 3.911 MiB | 1.017 MiB (+2.576 de cache) | **2.559 MiB disponíveis** |
| Swap | 0 | — | **não há swap** |
| Disco `/` | 78 GB | 62 GB (79%) | **17 GB** |

Containers do Veltrix: `veltrix-api-1` 75 MiB (limite 768 MiB),
`veltrix-postgres-1` 76 MiB (**sem limite**), `veltrix-redis-1` 8 MiB
(**sem limite**).

## Orçamento do Muster e o que impede o Muster de derrubar o Veltrix

| Container | Memória (teto rígido) | CPU (teto) | Outros |
| --- | --- | --- | --- |
| `postgres` (Muster) | 256 MiB, sem swap | 0,5 vCPU | `shared_buffers=64MB`, `max_connections=40`, `pids_limit` |
| `muster` (API + SPA) | 512 MiB, sem swap; heap Node 384 MiB | 0,75 vCPU | `pids_limit` |
| `cloudflared` | 128 MiB | 0,25 vCPU | `read_only`, `no-new-privileges` |
| **Total no pior caso** | **896 MiB** | **1,5 de 2 vCPU** | — |

Com o Muster no teto, sobram ~1,6 GiB disponíveis para o Veltrix. Proteções:

1. **Tetos rígidos** de memória e CPU por container (`deploy/docker-compose.prod.yml`
   e `deploy/docker-compose.public.yml`). O Muster nunca usa mais de 1,5 vCPU,
   então sempre sobra pelo menos meio núcleo para o Veltrix.
2. **`oom_score_adj: 500`** nos três containers do Muster: se o host ficar sem
   memória (não há swap), o kernel escolhe um processo do Muster antes do Veltrix.
3. **Guarda de capacidade no deploy** (`deploy/remote-deploy.sh`): o deploy não
   começa (nenhum pull, nenhum up) se houver menos de 1 GiB de memória
   disponível ou menos de 5 GiB de disco livre (`MUSTER_MIN_MEM_AVAILABLE_MIB`,
   `MUSTER_MIN_DISK_FREE_MIB`).
4. **Guarda do Veltrix no deploy**: com `MUSTER_VELTRIX_HEALTH_URL` configurada
   (sugestão: `https://api.veltrixplatform.com/api/healthz`), o script mede o
   healthz do Veltrix antes e depois; se ele estava saudável e caiu depois da
   troca do Muster, o Muster volta à imagem anterior automaticamente.
5. **Nada compartilhado**: projeto Docker `muster`, rede `muster-internal`,
   volume `muster-postgres-data`, banco e usuário próprios, arquivos de
   ambiente próprios em `/opt/muster` (o token do túnel fica num arquivo
   separado). O Muster não publica porta além de `127.0.0.1:8081`.
6. **Logs com rotação** (10 MiB × 5) para não encher o disco.

Riscos que continuam e como tratar:

- **Disco em 79%.** É o recurso mais apertado. Postgres do Muster + imagens +
  backups locais devem ficar abaixo de 3 GB no início. Gatilho para migrar o
  Muster para outro host: disco livre < 5 GiB, RAM disponível < 2 GiB de forma
  sustentada ou CPU do host > 60% em média (o `bootstrap-droplet.sh` já mede).
- **Postgres e Redis do Veltrix sem limite de memória.** Não é risco criado
  pelo Muster, mas um pico neles pode, em tese, pressionar o host. Sugestão
  (fora do escopo do Muster, decisão do Bruno): limitar também no compose do
  Veltrix.
- **Sem swap.** Criar 1–2 GiB de swap exige root e reduz o risco de OOM para
  os dois produtos. Recomendado, decisão do Bruno.
- **Ponto único de falha.** Se o droplet cair, Muster e Veltrix caem juntos.
  Aceitável para design partners convidados; o uptime check
  (`.github/workflows/uptime.yml`) abre issue em até 15 minutos.

## Arquivos

| Arquivo | Para quê |
| --- | --- |
| `deploy/docker-compose.prod.yml` | Base: Postgres + Muster, tetos, `oom_score_adj`, bind só em `127.0.0.1:8081` |
| `deploy/docker-compose.public.yml` | Overlay de produção: `cloudflared` + variáveis de produção |
| `deploy/docker-compose.staging.yml` | Overlay do staging privado (túnel SSH) — sem mudança |
| `deploy/remote-deploy.sh` | Deploy por SHA: guarda de capacidade, backup, pull/up, healthz com SHA, smoke, guarda do Veltrix, rollback automático |
| `deploy/backup/muster-backup.sh` | Backup diário: modo `local` (sem custo) ou `s3` (R2) |
| `deploy/backup/muster-backup-pull.sh` | Cópia off-site grátis: puxa os dumps para fora do droplet e confere o SHA-256 |
| `deploy/backup/muster-restore-test.sh` | Ensaio de restore em container descartável |
| `.github/workflows/deploy.yml` | Build da imagem `ghcr.io/brunooacks/muster:sha-<SHA>` com `GIT_SHA` e deploy por SSH (desligado até `MUSTER_DEPLOY_ENABLED=true`) |

`/opt/muster/.env.production` ganha, além das chaves já listadas no
`STAGING-PRIVADO.md`:

```dotenv
MUSTER_COMPOSE_OVERLAYS=deploy/docker-compose.public.yml
MUSTER_VELTRIX_HEALTH_URL=https://api.veltrixplatform.com/api/healthz
MUSTER_MIN_MEM_AVAILABLE_MIB=1024
MUSTER_MIN_DISK_FREE_MIB=5120
WEB_APP_URL=https://<dominio>
CORS_ALLOWED_ORIGINS=https://<dominio>
```

`/opt/muster/.env.tunnel` (0600) contém só `TUNNEL_TOKEN=<token do túnel>`.

## Versão identificável

`GET /api/healthz` devolve `{"status":"ok","version":...,"sha":"<GIT_SHA>"}`.
O `GIT_SHA` entra na imagem pelo `deploy.yml` (`build-args`), o
`remote-deploy.sh` recusa a release se o healthz não informar o SHA esperado e
o smoke aceita `MUSTER_EXPECTED_SHA` para conferir pelo domínio público.

## Backup e restore

**Padrão sem custo (`MUSTER_BACKUP_MODE=local`)**: dump diário às 03:30 UTC
(`muster-backup.timer`), validado com `pg_restore --list`, com SHA-256, 7 pares
mantidos em `/var/backups/muster`. Para não depender só do droplet, a cópia
off-site roda fora dele:

```sh
deploy/backup/muster-backup-pull.sh muster-deploy@143.198.113.231 ~/muster-backups
```

O script usa `StrictHostKeyChecking=yes`, confere cada SHA-256 e mantém 14
dumps. Para os arquivos ficarem legíveis pelo usuário de deploy, configure
`MUSTER_BACKUP_FILE_OWNER=muster-deploy:muster-deploy` no `.env.backup`.

**Opcional (`MUSTER_BACKUP_MODE=s3`, Cloudflare R2)**: 10 GB grátis, mas a
Cloudflare **exige cartão cadastrado** para ativar o R2. Só usar se o Bruno
aceitar cadastrar o cartão.

Além do diário, cada deploy faz um `pg_dump` antes da troca de imagem
(`/opt/muster/backups`, 7 mais recentes).

Restore: ensaio com `deploy/backup/muster-restore-test.sh`; restore real
conforme `docs/BACKUP-RESTORE.md` (janela, dump extra antes, `pg_restore --clean
--if-exists`, validação).

## Rollback

1. **Automático**: o `remote-deploy.sh` volta para a tag anterior se o
   container não ficar saudável em 60 s, se o healthz não trouxer o SHA, se o
   smoke falhar ou se o Veltrix cair depois da troca.
2. **Manual (imagem)**: em `/opt/muster`, trocar `MUSTER_IMAGE_TAG` no
   `.env.production` para a tag anterior (o histórico fica no log do workflow e
   em `docker images ghcr.io/brunooacks/muster`) e rodar:
   ```sh
   docker compose -p muster --env-file .env.production \
     -f deploy/docker-compose.prod.yml -f deploy/docker-compose.public.yml up -d
   MUSTER_EXPECTED_SHA=<sha-anterior> scripts/release-smoke.sh http://127.0.0.1:8081
   ```
3. **Migração de banco**: as migrações do Drizzle só avançam. Se uma release
   com migração precisar voltar, restaure o dump pré-deploy da própria release
   (`/opt/muster/backups/postgres-<UTC>.sql.gz`, SQL puro comprimido:
   `gunzip -c <arquivo> | docker compose -p muster ... exec -T postgres psql -U muster -d muster`
   num banco recriado) seguindo a janela e as confirmações do restore real.
4. **Tirar o Muster do ar sem afetar o Veltrix**:
   `docker compose -p muster -f deploy/docker-compose.prod.yml -f deploy/docker-compose.public.yml stop`.
   O túnel cai junto e o domínio passa a mostrar erro da Cloudflare; nada do
   Veltrix é tocado.

## Passos únicos que dependem do Bruno

Ver a lista com tempo estimado em `docs/PRODUCAO-CHECKLIST.md`.
