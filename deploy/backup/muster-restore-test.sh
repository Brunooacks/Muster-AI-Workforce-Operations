#!/usr/bin/env bash
set -euo pipefail

# Restaura um dump remoto em um Postgres descartável. Nunca aponta para a base
# de produção; não há publicação de porta, pois toda validação usa docker exec.

env_file="${MUSTER_BACKUP_ENV_FILE:-/opt/muster/.env.backup}"
prefix="${MUSTER_BACKUP_S3_PREFIX:-muster/postgres/}"
work_dir="${MUSTER_RESTORE_WORK_DIR:-$(mktemp -d)}"
restore_container="${MUSTER_RESTORE_CONTAINER:-muster-mus161-restore}"
postgres_image="${MUSTER_RESTORE_POSTGRES_IMAGE:-postgres:16-alpine}"
aws_cli_image="amazon/aws-cli@sha256:603e86d34bbbba57bb1dfe1cc2ac5ef6eef0df1e0d0b953ee9b83a0f6cac3d59"

if [[ "$prefix" != */ ]]; then
  prefix="$prefix/"
fi

started_at="$(date +%s)"
restore_started_at=0
restore_seconds=0
restore_password=""

fail() {
  printf 'Ensaio de restore do Muster falhou: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  docker rm -f "$restore_container" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

load_env_file() {
  local mode
  [[ -e "$env_file" ]] || return 0
  [[ -f "$env_file" ]] || fail "o arquivo de ambiente de backup não é um arquivo regular."
  if mode="$(stat -c '%a' "$env_file" 2>/dev/null)"; then :; elif mode="$(stat -f '%Lp' "$env_file" 2>/dev/null)"; then :; else
    fail "não foi possível verificar a permissão do arquivo de ambiente de backup."
  fi
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
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}

aws_cli() {
  docker run --rm --env AWS_ACCESS_KEY_ID --env AWS_SECRET_ACCESS_KEY --env AWS_DEFAULT_REGION \
    --env AWS_EC2_METADATA_DISABLED=true --volume "$work_dir:/work" "$aws_cli_image" \
    --endpoint-url "$MUSTER_BACKUP_S3_ENDPOINT" "$@"
}

latest_remote_key() {
  local records
  records="$(aws_cli s3api list-objects-v2 --bucket "$MUSTER_BACKUP_S3_BUCKET" --prefix "$prefix" \
    --query 'Contents[?ends_with(Key, `.dump`)].[LastModified,Key]' --output text)"
  [[ -n "$records" ]] || fail "nenhum dump foi encontrado no prefixo configurado."
  printf '%s\n' "$records" | LC_ALL=C sort -r | head -n 1 | cut -f2-
}

load_env_file
prefix="${MUSTER_BACKUP_S3_PREFIX:-$prefix}"
[[ "$prefix" == */ ]] || prefix="$prefix/"
require_env MUSTER_BACKUP_S3_ENDPOINT
require_env MUSTER_BACKUP_S3_BUCKET
require_env AWS_ACCESS_KEY_ID
require_env AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
restore_password="$(openssl rand -hex 24)" || fail "não foi possível gerar a senha descartável do restore."

remote_key="${MUSTER_RESTORE_S3_KEY:-$(latest_remote_key)}"
[[ "$remote_key" == "$prefix"muster-*.dump ]] || fail "a chave de restore deve ser um dump do prefixo configurado."
backup_name="${remote_key##*/}"
backup_path="$work_dir/$backup_name"
checksum_path="$backup_path.sha256"
mkdir -p "$work_dir"
chmod 700 "$work_dir"

aws_cli s3 cp "s3://$MUSTER_BACKUP_S3_BUCKET/$remote_key" "/work/$backup_name" >/dev/null
aws_cli s3 cp "s3://$MUSTER_BACKUP_S3_BUCKET/${remote_key}.sha256" "/work/${backup_name}.sha256" >/dev/null
expected_hash="$(awk 'NR == 1 { print $1 }' "$checksum_path")"
actual_hash="$(sha256_file "$backup_path")"
[[ -n "$expected_hash" && "$expected_hash" == "$actual_hash" ]] || fail "a verificação SHA-256 do dump falhou."

docker rm -f "$restore_container" >/dev/null 2>&1 || true
docker run --detach --rm --name "$restore_container" \
  --env POSTGRES_DB=muster --env POSTGRES_USER=muster --env POSTGRES_PASSWORD="$restore_password" \
  "$postgres_image" >/dev/null

for attempt in $(seq 1 30); do
  if docker exec "$restore_container" pg_isready -U muster -d muster >/dev/null 2>&1; then break; fi
  sleep 1
  [[ "$attempt" -lt 30 ]] || fail "o Postgres descartável não ficou pronto a tempo."
done

restore_started_at="$(date +%s)"
docker exec -i "$restore_container" pg_restore -U muster -d muster --clean --if-exists < "$backup_path"
restore_seconds="$(( $(date +%s) - restore_started_at ))"

table_count="$(docker exec "$restore_container" psql -U muster -d muster -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")"
[[ "$table_count" =~ ^[1-9][0-9]*$ ]] || fail "a restauração não criou tabelas públicas."
docker exec "$restore_container" psql -U muster -d muster -Atqc "SELECT 1 FROM information_schema.tables WHERE table_schema IN ('drizzle', 'public') AND table_name = '__drizzle_migrations';" | grep -qx 1
docker exec "$restore_container" psql -U muster -d muster -Atqc 'SELECT count(*) FROM organizations;' >/dev/null

total_seconds="$(( $(date +%s) - started_at ))"
printf 'Ensaio de restore aprovado: tabelas=%s restore=%ss total=%ss.\n' "$table_count" "$restore_seconds" "$total_seconds"
