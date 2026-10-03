#!/usr/bin/env bash
set -euo pipefail

# Faz um dump lógico do Postgres do Muster e o envia a um endpoint S3 compatível.
# A imagem da AWS CLI é deliberadamente fixada por digest para que o host não
# precise instalar ferramentas nem receba atualizações implícitas da CLI.

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${MUSTER_BACKUP_COMPOSE_FILE:-$script_dir/../docker-compose.prod.yml}"
project="${MUSTER_BACKUP_COMPOSE_PROJECT:-muster}"
postgres_service="${MUSTER_BACKUP_POSTGRES_SERVICE:-postgres}"
postgres_user="${MUSTER_BACKUP_POSTGRES_USER:-muster}"
postgres_database="${MUSTER_BACKUP_POSTGRES_DATABASE:-muster}"
postgres_container="${MUSTER_BACKUP_POSTGRES_CONTAINER:-}"
backup_dir="${MUSTER_BACKUP_DIR:-/var/backups/muster}"
env_file="${MUSTER_BACKUP_ENV_FILE:-/opt/muster/.env.backup}"
prefix="${MUSTER_BACKUP_S3_PREFIX:-muster/postgres/}"
retention_days="${MUSTER_BACKUP_RETENTION_DAYS:-14}"
aws_cli_image="amazon/aws-cli@sha256:603e86d34bbbba57bb1dfe1cc2ac5ef6eef0df1e0d0b953ee9b83a0f6cac3d59"

if [[ "$prefix" != */ ]]; then
  prefix="$prefix/"
fi

fail() {
  printf 'Backup do Muster falhou: %s\n' "$1" >&2
  exit 1
}

load_env_file() {
  local mode

  [[ -e "$env_file" ]] || return 0
  [[ -f "$env_file" ]] || fail "o arquivo de ambiente de backup não é um arquivo regular."

  if mode="$(stat -c '%a' "$env_file" 2>/dev/null)"; then
    :
  elif mode="$(stat -f '%Lp' "$env_file" 2>/dev/null)"; then
    :
  else
    fail "não foi possível verificar a permissão do arquivo de ambiente de backup."
  fi

  # Apenas o proprietário pode ler/escrever/executar o arquivo (0600 ou mais restrito).
  if (( (8#$mode & 077) != 0 )); then
    fail "o arquivo de ambiente de backup deve ter permissão 0600 ou mais restrita."
  fi

  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
}

require_env() {
  [[ -n "${!1:-}" ]] || fail "a variável obrigatória $1 não foi configurada."
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

aws_cli() {
  docker run --rm \
    --env AWS_ACCESS_KEY_ID \
    --env AWS_SECRET_ACCESS_KEY \
    --env AWS_DEFAULT_REGION \
    --env AWS_EC2_METADATA_DISABLED=true \
    --volume "$backup_dir:/work" \
    "$aws_cli_image" \
    --endpoint-url "$MUSTER_BACKUP_S3_ENDPOINT" "$@"
}

cutoff_utc() {
  if date -u -d "$retention_days days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null; then
    return 0
  fi
  date -u -v-"${retention_days}"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null ||
    fail "não foi possível calcular a data de retenção."
}

dump_database() {
  if [[ -n "$postgres_container" ]]; then
    docker exec -i "$postgres_container" pg_dump -U "$postgres_user" -d "$postgres_database" -Fc
  else
    docker compose -p "$project" -f "$compose_file" exec -T "$postgres_service" \
      pg_dump -U "$postgres_user" -d "$postgres_database" -Fc
  fi
}

prune_remote_backups() {
  local cutoff records record timestamp key kept=0

  cutoff="$(cutoff_utc)"
  records="$(aws_cli s3api list-objects-v2 --bucket "$MUSTER_BACKUP_S3_BUCKET" --prefix "$prefix" \
    --query 'Contents[?ends_with(Key, `.dump`)].[LastModified,Key]' --output text)"

  # Falhar na listagem é uma falha de backup: não podemos afirmar que a retenção foi aplicada.
  if [[ -z "$records" ]]; then
    return 0
  fi

  while IFS=$'\t' read -r timestamp key; do
    [[ -n "$timestamp" && -n "$key" ]] || continue
    ((kept += 1))
    if (( kept <= 3 )) || [[ "$key" == "$remote_dump_key" ]] || [[ "$timestamp" > "$cutoff" ]]; then
      continue
    fi
    aws_cli s3api delete-object --bucket "$MUSTER_BACKUP_S3_BUCKET" --key "$key" >/dev/null
    aws_cli s3api delete-object --bucket "$MUSTER_BACKUP_S3_BUCKET" --key "${key}.sha256" >/dev/null
  done < <(printf '%s\n' "$records" | LC_ALL=C sort -r)
}

load_env_file
prefix="${MUSTER_BACKUP_S3_PREFIX:-$prefix}"
retention_days="${MUSTER_BACKUP_RETENTION_DAYS:-$retention_days}"
[[ "$prefix" == */ ]] || prefix="$prefix/"
require_env MUSTER_BACKUP_S3_ENDPOINT
require_env MUSTER_BACKUP_S3_BUCKET
require_env AWS_ACCESS_KEY_ID
require_env AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

[[ "$retention_days" =~ ^[1-9][0-9]*$ ]] || fail "MUSTER_BACKUP_RETENTION_DAYS deve ser um inteiro positivo."
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_name="muster-$timestamp.dump"
dump_path="$backup_dir/$dump_name"
checksum_path="$dump_path.sha256"
remote_dump_key="$prefix$dump_name"

umask 077
dump_database > "$dump_path"
dump_hash="$(sha256_file "$dump_path")"
printf '%s  %s\n' "$dump_hash" "$dump_name" > "$checksum_path"

aws_cli s3 cp "/work/$dump_name" "s3://$MUSTER_BACKUP_S3_BUCKET/$remote_dump_key" >/dev/null
aws_cli s3 cp "/work/${dump_name}.sha256" "s3://$MUSTER_BACKUP_S3_BUCKET/${remote_dump_key}.sha256" >/dev/null
prune_remote_backups

printf 'Backup enviado com sucesso: %s (SHA-256 verificado localmente).\n' "$remote_dump_key"
