#!/usr/bin/env bash
set -euo pipefail

# Cópia off-site gratuita dos backups locais do Muster: roda FORA do droplet
# (por exemplo, no Mac do Bruno, via launchd ou manualmente), puxa os pares
# muster-<UTC>.dump + .sha256 por rsync/SSH, confere cada SHA-256 e mantém só
# os N mais recentes. Não usa root, não lê .env e não toca no Veltrix.
#
# Uso: muster-backup-pull.sh <usuario>@<host> [diretorio-local]

remote="${1:?Uso: muster-backup-pull.sh <usuario>@<host> [diretorio-local]}"
local_dir="${2:-${MUSTER_BACKUP_PULL_DIR:-$HOME/muster-backups}}"
remote_dir="${MUSTER_BACKUP_REMOTE_DIR:-/var/backups/muster}"
keep="${MUSTER_BACKUP_PULL_KEEP:-14}"

fail() {
  printf 'Cópia off-site do Muster falhou: %s\n' "$1" >&2
  exit 1
}

[[ "$remote" =~ ^[a-z_][a-z0-9_-]*@[A-Za-z0-9.-]+$ ]] || fail "destino SSH inválido (use usuario@host)."
[[ "$keep" =~ ^[1-9][0-9]*$ ]] || fail "MUSTER_BACKUP_PULL_KEEP deve ser inteiro positivo."

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

umask 077
mkdir -p "$local_dir"

# StrictHostKeyChecking=yes: nunca aceitar uma chave de host desconhecida.
rsync -a --chmod=F600 \
  -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" \
  --include='muster-*.dump' --include='muster-*.dump.sha256' --exclude='*' \
  "$remote:$remote_dir/" "$local_dir/"

verified=0
while IFS= read -r dump; do
  checksum="$dump.sha256"
  [[ -f "$checksum" ]] || fail "checksum ausente para $(basename "$dump")."
  expected="$(awk '{print $1}' "$checksum")"
  actual="$(sha256_file "$dump")"
  [[ "$expected" == "$actual" ]] || fail "SHA-256 divergente em $(basename "$dump")."
  verified=$((verified + 1))
done < <(find "$local_dir" -maxdepth 1 -type f -name 'muster-*.dump' -print | LC_ALL=C sort)

(( verified > 0 )) || fail "nenhum dump encontrado em $remote:$remote_dir."

kept=0
while IFS= read -r dump; do
  kept=$((kept + 1))
  if (( kept > keep )); then
    rm -f -- "$dump" "$dump.sha256"
  fi
done < <(find "$local_dir" -maxdepth 1 -type f -name 'muster-*.dump' -print | LC_ALL=C sort -r)

printf 'Cópia off-site concluída: %s dumps verificados; mantidos até %s em %s.\n' "$verified" "$keep" "$local_dir"
