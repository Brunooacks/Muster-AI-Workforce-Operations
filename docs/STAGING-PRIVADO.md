# Staging privado do Muster

Este roteiro prepara um staging privado no droplet compartilhado sem domínio e
sem alterar o Veltrix. A aplicação fica limitada a `127.0.0.1:8081`; o acesso
humano é feito por túnel SSH. Não execute este roteiro até o Bruno fornecer o
acesso ao host.

## Pré-requisitos do Bruno

- Usuário SSH dedicado, com permissão `sudo` apenas para o bootstrap inicial e
  chave pública instalada no host.
- Entrada verificada em `known_hosts` para `<host>`; não aceite uma chave SSH
  desconhecida interativamente.
- Token do GHCR de leitura, usado manualmente em `docker login ghcr.io` e nunca
  salvo no repositório, em logs ou na issue.
- Chaves de desenvolvimento do Clerk configuradas exclusivamente no arquivo
  `/opt/muster/.env.production`, com URLs permitidas em `http://localhost:8081`.

## Preparação inicial

No checkout operacional em `/opt/muster`, execute primeiro o plano seco. A URL
do Veltrix é somente para leitura e deve apontar ao healthcheck já existente:

```sh
cd /opt/muster
./deploy/bootstrap-droplet.sh \
  --deploy-user <usuario-deploy> \
  --veltrix-health-url <url-healthz-veltrix>
```

Revise o plano, a RAM, CPU, disco e o resultado do healthz. Se estiver correto,
repita com `--apply`. O script não sobrescreve `.env.production`; quando o cria,
o arquivo contém somente chaves vazias e fica em modo `600`.

Faça o login no registro de forma interativa, com token read-only. Não coloque o
token em argumentos de shell ou arquivos versionados:

```sh
docker login ghcr.io
```

Preencha `/opt/muster/.env.production` localmente com os valores de staging,
incluindo `POSTGRES_PASSWORD`, `DATABASE_URL`, chaves Clerk de desenvolvimento,
origens de CORS e `MUSTER_IMAGE_TAG=sha-<SHA>`. Confirme a permissão sem exibir
o conteúdo: `stat -c '%a %n' /opt/muster/.env.production`.

## Subida manual e verificação

Antes da primeira subida, registre o healthz do Veltrix, RAM e CPU. Use a imagem
imutável do commit a implantar, sem build no host:

```sh
cd /opt/muster
export MUSTER_IMAGE_TAG=sha-<SHA>
docker compose -p muster \
  -f deploy/docker-compose.prod.yml \
  -f deploy/docker-compose.staging.yml pull
docker compose -p muster \
  -f deploy/docker-compose.prod.yml \
  -f deploy/docker-compose.staging.yml up -d
docker compose -p muster ps
pnpm release:smoke -- http://127.0.0.1:8081
```

Espere `postgres` e `muster` ficarem `healthy`. Confira `/api/healthz` e salve
somente a saída sem segredos. Em seguida abra o túnel a partir da máquina do
Bruno:

```sh
ssh -N -L 8081:127.0.0.1:8081 <usuario>@<host>
```

Com Clerk de desenvolvimento configurado para `localhost`, valide pelo túnel o
login e o fluxo mínimo: organização → agente → evento. Ao final, consulte de
novo o healthz do Veltrix e registre RAM/CPU para comparar com a medição inicial.

## Validação local do Compose

O compose de produção aceita `MUSTER_ENV_FILE` para que a validação não exija o
arquivo absoluto do host. Gere um arquivo temporário com valores descartáveis e
nunca o versione:

```sh
staging_env="$(mktemp)"
chmod 600 "$staging_env"
printf '%s\n' 'POSTGRES_PASSWORD=' 'DATABASE_URL=' 'CLERK_SECRET_KEY=' \
  'CLERK_PUBLISHABLE_KEY=' > "$staging_env"
MUSTER_ENV_FILE="$staging_env" MUSTER_IMAGE_TAG=sha-<SHA> \
  docker compose -p muster \
    -f deploy/docker-compose.prod.yml \
    -f deploy/docker-compose.staging.yml config
rm -f "$staging_env"
```

O override preserva os `mem_limit` e o bind `127.0.0.1:8081` do compose base.
Ele define `WEB_APP_URL=http://localhost:8081`, `LOG_LEVEL=info`,
`MUSTER_INVITE_ONLY=true` e o worker de telemetria contínua ativo, salvo
variáveis explicitamente fornecidas.

## Rollback manual

Se o healthcheck ou o smoke falhar, mantenha as evidências e retorne à imagem
saudável anterior. Atualize apenas o valor local de `MUSTER_IMAGE_TAG` no arquivo
de ambiente, então execute o compose com os mesmos dois arquivos:

```sh
docker compose -p muster \
  -f deploy/docker-compose.prod.yml \
  -f deploy/docker-compose.staging.yml up -d
docker compose -p muster ps
```

Não toque em Nginx, compose, rede, banco ou volumes do Veltrix.

## Checklist de evidências da MUS-163

| Critério de aceite | Evidência a registrar na issue |
| --- | --- |
| Imagem `ghcr.io/brunooacks/muster:sha-<SHA>` e containers saudáveis | SHA, saída resumida de `docker compose -p muster ps` e healthz do Muster. |
| Smoke 100% PASS no droplet | Comando `pnpm release:smoke -- http://127.0.0.1:8081`, resultado e duração. |
| Login Clerk dev e fluxo vertical pelo túnel | Confirmação do túnel e resultado de organização → agente → evento, sem dados pessoais ou segredos. |
| Veltrix preservado e capacidade registrada | Healthz antes/depois, RAM, CPU, disco e avaliação do gatilho (< 2 GiB livres ou > 60% de uso). |
| Ambiente protegido e sem vazamento | Permissão `600` confirmada sem conteúdo; confirmação de que nenhum segredo foi registrado. |

O ensaio no droplet, incluindo esses critérios, permanece pendente até que o
acesso seja fornecido pelo Bruno.
