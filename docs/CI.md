# CI do Muster (Woodpecker + `make ci`)

O CI saiu do GitHub Actions (E0). Tudo o que o CI roda está no `Makefile` e
pode ser reproduzido na máquina local com o mesmo resultado.

## Alvos

| Alvo | O que faz |
| --- | --- |
| `make ci` | `ci-core` + `name-gate` (o mesmo que o Woodpecker roda) |
| `make ci-core` | toolchain → install → typecheck → test → build → go-test → down-guard |
| `make ci-container` | `make ci` dentro de `node:24-bookworm` com pnpm 9.15.0 |
| `make name-gate` | gate de nomes bloqueados nos arquivos versionados |
| `make down-guard` | garante que `lib/db/drizzle/down/` fica fora do journal, da imagem e do deploy |
| `make hooks` | `git config core.hooksPath scripts/hooks` (instala o pre-push) |

A ordem segue o antigo `ci.yml`: `pnpm install --frozen-lockfile`,
`pnpm run typecheck`, `pnpm test`, `pnpm -r --if-present run build`.
`go test ./...` só roda quando existir `core/` (a partir da E2). O antigo job
`actionlint` deixou de existir junto com os workflows.

`make ci` avisa (sem falhar) quando o Node local não é o 24. Para reproduzir
exatamente o CI, use `make ci-container` (precisa de Docker). Ele copia só os
arquivos versionados, com as alterações locais deles; arquivos novos precisam
de `git add` antes. O store do pnpm fica no volume `muster-pnpm-store`.

## Gate de nomes bloqueados

`scripts/ci/name-gate.sh` procura termos de uma lista que **nunca entra no
repo** (nomes pessoais e dados regulados). A busca é literal e não diferencia
maiúsculas. Ignora `node_modules`, `dist` e `pnpm-lock.yaml`; inclui
`attached_assets/`, `.agents/memory/` e `.replit-artifact/` quando versionados.

Origem da lista, nesta ordem:

1. `MUSTER_BLOCKLIST` com o conteúdo da lista (no Woodpecker, segredo
   `muster_blocklist`, exposto só ao step `name-gate`);
2. `MUSTER_BLOCKLIST_FILE` com o caminho de um arquivo;
3. `~/.config/muster/blocklist`.

Formato: um termo por linha; linhas vazias e começadas por `#` são ignoradas.
Sem lista, ou com lista vazia, o gate falha (código 3). Com ocorrências, falha
(código 1) e mostra só `arquivo:linha`, nunca o termo. Caminhos de arquivo que
contêm o termo são apenas contados.

```bash
mkdir -p ~/.config/muster && chmod 700 ~/.config/muster
$EDITOR ~/.config/muster/blocklist && chmod 600 ~/.config/muster/blocklist
make name-gate
```

## Hook pre-push

`make hooks` instala `scripts/hooks/pre-push`. A cada push, o hook roda
`name-gate.sh --commits` sobre os commits que o remoto ainda não tem: linhas
adicionadas, mensagem e autor/committer. Sem lista local o push é recusado.
Com `MUSTER_PREPUSH_FULL=1`, o hook também roda `make ci` antes de enviar.

## Woodpecker

Pipeline em `.woodpecker/ci.yml`, em PR para `main` e push em `main`:

- step `name-gate`: `make name-gate`, com o segredo `muster_blocklist`;
- step `ci`: `make ci-core` em `node:24-bookworm` com pnpm 9.15.0 e o store do
  pnpm no volume `muster-pnpm-store` do agent (o repo precisa estar marcado
  como *trusted* para aceitar volumes).

Configuração do servidor que este repo pressupõe (T0.4, droplet isolado):

- `WOODPECKER_STATUS_CONTEXT=ci/woodpecker` e
  `WOODPECKER_STATUS_CONTEXT_FORMAT={{ .context }}`, para que o status no
  GitHub seja exatamente `ci/woodpecker` (o padrão acrescenta evento e nome do
  workflow, e a proteção de branch não reconheceria);
- segredo `muster_blocklist` cadastrado no repo, disponível só para a imagem
  `node:24-bookworm` e sem acesso a PRs de fork;
- nenhum segredo de produção no Woodpecker.

## Proteção de branch

`scripts/branch-protection.sh` exige só o contexto `ci/woodpecker` (veja
`docs/BRANCH-PROTECTION.md`). Aplicar a proteção é ação manual na conta do
GitHub.

## O que saiu do GitHub Actions

- `ci.yml` → `.woodpecker/ci.yml` + `make ci`.
- `deploy.yml` → deploy manual por `deploy/remote-deploy.sh <SHA>` (veja
  `deploy/README.md`); build e push da imagem também são manuais.
- `uptime.yml` → health check do Cloudflare sobre `/api/healthz`, configurado à
  mão no painel (Traffic → Health Checks): intervalo de 15 min ou menor,
  `GET` com código esperado 200 e notificação por e-mail para o responsável.
