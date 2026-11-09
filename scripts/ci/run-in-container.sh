#!/usr/bin/env bash
# Roda um comando (padrão: make ci) dentro de node:24-bookworm com pnpm 9.15.0,
# a mesma imagem do Woodpecker. Copia só os arquivos versionados (com as
# alterações locais deles) para dentro do container, para que node_modules do
# host nunca se misture com os binários Linux. Arquivos novos precisam de
# `git add` antes. O exit code é o do comando.
set -euo pipefail

readonly IMAGE="${MUSTER_CI_IMAGE:-node:24-bookworm}"
readonly PNPM_VERSION="9.15.0"
readonly STORE_VOLUME="${MUSTER_CI_STORE_VOLUME:-muster-pnpm-store}"

repo_root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
(($# > 0)) || set -- make ci

# A lista de bloqueio fica fora do repo: repassa a variável ou monta só o
# arquivo, somente leitura, no mesmo caminho padrão dentro do container.
env_args=()
mount_args=()
if [[ -n "${MUSTER_BLOCKLIST:-}" ]]; then
  env_args+=(-e MUSTER_BLOCKLIST)
fi
list_file="${MUSTER_BLOCKLIST_FILE:-${HOME}/.config/muster/blocklist}"
if [[ -f "$list_file" ]]; then
  mount_args+=(-v "$list_file:/root/.config/muster/blocklist:ro")
fi

# O tar é montado no host e entra pelo stdin: em worktrees, o .git é um
# arquivo que aponta para fora do repo e não funcionaria dentro do container.
cd "$repo_root"
git ls-files -z --cached |
  while IFS= read -r -d "" file; do
    if [[ -e "$file" || -L "$file" ]]; then printf '%s\0' "$file"; fi
  done |
  COPYFILE_DISABLE=1 tar --null -T - -cf - |
  docker run --rm -i \
  -v "$STORE_VOLUME:/pnpm-store" \
  -e npm_config_store_dir=/pnpm-store \
  -e CI=true \
  ${env_args[@]+"${env_args[@]}"} \
  ${mount_args[@]+"${mount_args[@]}"} \
  -w /work \
  "$IMAGE" \
  bash -euo pipefail -c '
    tar --warning=no-unknown-keyword -xf -
    git init -q && git add -A
    corepack enable && corepack prepare "pnpm@'"$PNPM_VERSION"'" --activate >/dev/null
    exec "$@"
  ' bash "$@"
