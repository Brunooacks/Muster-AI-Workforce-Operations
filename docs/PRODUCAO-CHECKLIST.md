# Checklist de produção do Muster (design partners convidados)

Situação em **11/10/2026, 08:00 BRT**, base `origin/main` `a47f1de`. Legenda:
✅ pronto com evidência · 🟡 pronto no repositório, falta execução/aceite ·
⛔ bloqueado (depende do Bruno ou de outro PR) · ❌ não existe.

A decisão de go/no-go continua seguindo `docs/GO-NO-GO-MVP.md` e a MUS-162;
este checklist só mostra o que falta para chegar lá. Decisão de infra e
limites: `docs/PRODUCAO-INFRA.md`.

## Infraestrutura

| Item | Status | Evidência / o que falta |
| --- | --- | --- |
| Hospedagem decidida | ✅ | Mesmo droplet do Veltrix, isolado, com Cloudflare Tunnel (`docs/PRODUCAO-INFRA.md`). |
| Capacidade do droplet medida | ✅ | 11/10 01:06 BRT: 2 vCPU, 2.559 MiB disponíveis, sem swap, disco 79% (17 GB livres). |
| Tetos de CPU/memória e prioridade de OOM | 🟡 | `deploy/docker-compose.prod.yml` e `.public.yml`; `docker compose config` validado localmente. Falta subir no droplet. |
| Guarda de capacidade e do Veltrix no deploy | 🟡 | `deploy/remote-deploy.sh` + 5 testes novos em `scripts/remote-deploy.test.mjs` (macOS e Linux). |
| Entrada pública (TLS) | ⛔ | Overlay do `cloudflared` pronto; falta o Bruno criar o túnel e o hostname. |
| Domínio | ⛔ | Decisão do Bruno (MUS-158). |
| Clerk de produção | ⛔ | Instância, domínio e chaves só o Bruno cria (MUS-158). |
| Acesso só por convite | ⛔ | Na `main`, `MUSTER_INVITE_ONLY` não é lido por nenhum código. Implementação no PR #27 (MUS-166, rascunho, CI verde). Até o merge: modo "Restricted" no Clerk de produção. |
| Imagem no GHCR com SHA | 🟡 | `deploy.yml` builda `ghcr.io/brunooacks/muster:sha-<SHA>` com `GIT_SHA`; nenhuma imagem publicada ainda (pacote não existe). |
| `healthz` com SHA real | ✅ | `routes/health.ts` devolve `sha` de `GIT_SHA`; teste em `routes/health.test.ts`; `remote-deploy.sh` exige o SHA. |
| Deploy automatizado com rollback | 🟡 | `deploy.yml` desligado (`MUSTER_DEPLOY_ENABLED` não existe; nenhum environment criado no GitHub). Rollback automático coberto por testes. |
| Backup diário | 🟡 | Modo `local` sem custo (novo) + modo `s3`/R2 (R2 exige cartão). Timer systemd pronto; falta instalar (root). |
| Cópia off-site | 🟡 | `deploy/backup/muster-backup-pull.sh` (rsync + SHA-256), com teste. Falta agendar fora do droplet. |
| Restore ensaiado | ⛔ | `muster-restore-test.sh` pronto; ensaio real depende do host. |
| Uptime | 🟡 | `.github/workflows/uptime.yml` roda a cada 15 min, mas `MUSTER_HEALTH_URL` está vazio (pula). |
| CI | ✅ | Último CI da `main` verde (11/10 00:52 BRT, 52 s). |
| CI de integração com Postgres e smoke da imagem | ⛔ | PRs #23 e #19 em rascunho com o job novo falhando. |
| E2E autenticado (Clerk) | ⛔ | PR #24 em rascunho, falhando; pré-requisito da MUS-162. |

## Produto e dados

| Item | Status | Evidência / o que falta |
| --- | --- | --- |
| Ingestão universal (envelope v1) | ✅ | `POST /api/integrations/agent-events` com chave por conector, idempotência e testes de integração. |
| Envelope v2 com `taskRunId` e validação (MUS-171) | 🟡 | Em andamento noutra sessão (fatias 1 e 2). |
| Conector Langfuse de leitura | 🟡 | Fatia 1 (mapeador, PR #50) e fatia 2 (cliente) em PR rascunho; coleta automática entra depois do envelope v2 na `main`. |
| Endpoint OTLP GenAI | ❌ | Só desenho + esqueleto de extração com allowlist (PR #49, `docs/CONECTOR-OTLP-GENAI.md`), sem receber conteúdo bruto. |
| Isolamento entre organizações | 🟡 | Testes de tenant na `main`; prova no domínio real é do roteiro manual da MUS-162. |
| Segredos de conectores criptografados | ✅ | AES-256-GCM (`credential-crypto.ts`), chave `MUSTER_CREDENTIAL_ENCRYPTION_KEY` só no host. |
| Contrato NTT (não concorrência) | ⛔ | Bloqueante comercial: compradores naturais são clientes da NTT. Só o Bruno. |

## O que o Bruno precisa fazer (uma vez)

| # | Passo | Onde | Tempo |
| --- | --- | --- | --- |
| 1 | Escolher o domínio (sugestão sem custo: `muster.veltrixplatform.com`; ou um domínio próprio do Muster, se aceitar comprar) | decisão | 5 min |
| 2 | Revisar e mergear o PR de infra e o #27 (convite) | GitHub | 20 min |
| 3 | Criar o túnel `muster-prod` em Networking > Tunnels, copiar o token e adicionar a rota `<dominio>` → `http://muster:8080` | Cloudflare | 10 min |
| 4 | (Opcional, grátis) 1 regra de rate limiting para `/api/agents/*` e `/api/integrations/*` | Cloudflare > Security | 5 min |
| 5 | Criar a instância de produção do Clerk no domínio, cadastrar os CNAMEs como DNS-only, ligar o modo "Restricted" e anotar `pk_live`/`sk_live` | Clerk + Cloudflare DNS | 30 min (+ propagação) |
| 6 | Bootstrap com root: `deploy/bootstrap-droplet.sh --deploy-user muster-deploy --veltrix-health-url https://api.veltrixplatform.com/api/healthz` (dry-run, depois `--apply`), instalar a chave SSH do deploy, `usermod -aG docker muster-deploy`, instalar o timer de backup e (recomendado) criar 2 GiB de swap | droplet (SSH root) | 20 min |
| 7 | Preencher `/opt/muster/.env.production` (senha do Postgres, `DATABASE_URL`, chaves Clerk, `MUSTER_CREDENTIAL_ENCRYPTION_KEY` com cópia offline, `WEB_APP_URL`/`CORS_ALLOWED_ORIGINS`, chaves de guarda) e `/opt/muster/.env.tunnel` com o token | droplet | 10 min |
| 8 | No GitHub: environment `staging` (é o nome fixo no `deploy.yml` hoje; serve para este host) com revisor obrigatório, secrets `MUSTER_DEPLOY_HOST/USER/SSH_KEY/KNOWN_HOSTS`, variáveis `VITE_CLERK_PUBLISHABLE_KEY` e `MUSTER_HEALTH_URL`; por último `MUSTER_DEPLOY_ENABLED=true` | GitHub Settings | 15 min |
| 9 | Tornar público o pacote `ghcr.io/brunooacks/muster` depois do primeiro build (o repositório já é público e a imagem só tem código público + chave publicável), ou fazer `docker login ghcr.io` no droplet com token só-leitura | GitHub Packages | 5 min |
| 10 | Agendar a cópia off-site no Mac (`muster-backup-pull.sh`, launchd semanal) | Mac | 10 min |
| 11 | Conferir o contrato com a NTT antes do primeiro design partner pagante | jurídico | — |

Total de mão do Bruno: **~2 h** (sem contar o item 11 e a propagação de DNS).
