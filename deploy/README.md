# Deploy do Muster

O Compose de produção usa o projeto Docker `muster`, a imagem imutável
`ghcr.io/brunooacks/muster:sha-<SHA>` e uma rede/volume exclusivos do Muster.
Ele não publica a porta do Postgres e expõe a aplicação somente em
`127.0.0.1:8081`. O arquivo `deploy/nginx/muster.conf.template` é reservado
para a fase de produção; não deve ser habilitado no staging privado.

No droplet, a cópia operacional do repositório fica em `/opt/muster`. O arquivo
`/opt/muster/.env.production`, criado fora do Git com permissões restritas,
fornece os segredos e valores de runtime, inclusive `POSTGRES_PASSWORD`,
`DATABASE_URL`, as chaves do Clerk e `MUSTER_IMAGE_TAG=sha-<SHA-anterior>`.
Não há valores de exemplo reais neste repositório.

## Validação e dry-run

Com o arquivo de ambiente provisionado no host, valide o Compose sem subir
serviços:

```sh
MUSTER_IMAGE_TAG=sha-<SHA-de-40-caracteres> \
  docker compose -f deploy/docker-compose.prod.yml config
```

O workflow `deploy.yml` só é acionado depois de uma execução bem-sucedida do
workflow `CI` em `main`, ou manualmente com um SHA completo, e permanece
inativo até que `vars.MUSTER_DEPLOY_ENABLED` seja exatamente `true`. Esse kill
switch bloqueia inclusive o build e o push da imagem para o GHCR.

## Ordem de ativação do staging

1. Crie o environment `staging` e configure um required reviewer.
2. Adicione os secrets de deploy ao environment: host, usuário, chave SSH e
   known hosts.
3. Somente depois defina a variável do environment
   `MUSTER_DEPLOY_ENABLED=true`.

A execução remota faz backup local do Postgres, mantém somente os sete dumps
mais recentes, espera o healthcheck, exige que `/api/healthz` informe o SHA e
roda o smoke local. Em qualquer falha após uma versão anterior conhecida, ela
restaura a tag anterior.

Nesta preparação não foi feito SSH, deploy nem execução real do workflow. Para
o staging privado, mantenha o bind em `127.0.0.1:8081` e acesse apenas por túnel
SSH até a configuração posterior do vhost público.

O procedimento completo e o checklist de evidências do staging privado estão em
[STAGING-PRIVADO.md](../docs/STAGING-PRIVADO.md).
