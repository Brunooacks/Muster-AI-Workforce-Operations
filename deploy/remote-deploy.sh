#!/usr/bin/env bash
set -euo pipefail

deploy_dir="${MUSTER_DEPLOY_DIR:-/opt/muster}"
compose_file="$deploy_dir/deploy/docker-compose.prod.yml"
env_file="$deploy_dir/.env.production"
backup_dir="$deploy_dir/backups"
backup_script="${MUSTER_BACKUP_SCRIPT:-$deploy_dir/deploy/backup/muster-backup.sh}"
backup_env_file="${MUSTER_BACKUP_ENV_FILE:-$deploy_dir/.env.backup}"
target_sha="${1:?Usage: remote-deploy.sh <40-character git SHA>}"

if [[ ! "$target_sha" =~ ^[0-9a-f]{40}$ ]]; then
  printf '%s\n' "Expected a lowercase 40-character Git SHA." >&2
  exit 2
fi

if [[ ! -f "$compose_file" || ! -f "$env_file" ]]; then
  printf '%s\n' "Missing deployment compose file or environment file." >&2
  exit 2
fi

target_tag="sha-$target_sha"

# Lê uma chave do arquivo de ambiente sem executá-lo (nunca fazemos `source`
# do .env.production, que contém segredos).
read_env_value() {
  awk -F= -v key="$1" '$1 == key { print substr($0, index($0, "=") + 1) }' "$env_file" | tail -n 1
}

read_current_tag() {
  read_env_value MUSTER_IMAGE_TAG
}

# Overlays opcionais (ex.: deploy/docker-compose.public.yml para o Cloudflare
# Tunnel). Só aceitamos arquivos versionados em deploy/ com nome previsível.
compose=(docker compose --project-directory "$deploy_dir" --env-file "$env_file" -f "$compose_file")
overlays="${MUSTER_COMPOSE_OVERLAYS:-$(read_env_value MUSTER_COMPOSE_OVERLAYS)}"
for overlay in $overlays; do
  if [[ ! "$overlay" =~ ^deploy/docker-compose\.[a-z0-9-]+\.yml$ || ! -f "$deploy_dir/$overlay" ]]; then
    printf 'Overlay de compose inválido ou ausente: %s\n' "$overlay" >&2
    exit 2
  fi
  compose+=(-f "$deploy_dir/$overlay")
done

# Guarda de capacidade: o droplet é compartilhado com o Veltrix. Abaixo destes
# mínimos o deploy do Muster não começa (nenhum pull, nenhum up).
min_mem_mib="${MUSTER_MIN_MEM_AVAILABLE_MIB:-$(read_env_value MUSTER_MIN_MEM_AVAILABLE_MIB)}"
min_disk_mib="${MUSTER_MIN_DISK_FREE_MIB:-$(read_env_value MUSTER_MIN_DISK_FREE_MIB)}"
min_mem_mib="${min_mem_mib:-1024}"
min_disk_mib="${min_disk_mib:-5120}"
veltrix_health_url="${MUSTER_VELTRIX_HEALTH_URL:-$(read_env_value MUSTER_VELTRIX_HEALTH_URL)}"

mem_available_kib() {
  if [[ -n "${MUSTER_PREFLIGHT_MEM_AVAILABLE_KIB:-}" ]]; then
    printf '%s\n' "$MUSTER_PREFLIGHT_MEM_AVAILABLE_KIB"
  else
    awk '/MemAvailable:/ { print $2; exit }' /proc/meminfo
  fi
}

disk_available_kib() {
  if [[ -n "${MUSTER_PREFLIGHT_DISK_AVAILABLE_KIB:-}" ]]; then
    printf '%s\n' "$MUSTER_PREFLIGHT_DISK_AVAILABLE_KIB"
  else
    df -Pk "$deploy_dir" | awk 'NR == 2 { print $4 }'
  fi
}

veltrix_healthy() {
  [[ -z "$veltrix_health_url" ]] && return 0
  curl --fail --silent --show-error --max-time 10 "$veltrix_health_url" >/dev/null
}

preflight() {
  local mem_kib disk_kib
  if [[ ! "$min_mem_mib" =~ ^[0-9]+$ || ! "$min_disk_mib" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "Limites de capacidade inválidos (use MiB inteiros)." >&2
    exit 3
  fi
  mem_kib="$(mem_available_kib)"
  disk_kib="$(disk_available_kib)"
  if [[ ! "$mem_kib" =~ ^[0-9]+$ || ! "$disk_kib" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "Não foi possível medir memória/disco do host; deploy abortado." >&2
    exit 3
  fi
  printf 'Capacidade: memória disponível=%s MiB (mínimo %s), disco livre=%s MiB (mínimo %s).\n' \
    "$((mem_kib / 1024))" "$min_mem_mib" "$((disk_kib / 1024))" "$min_disk_mib"
  if (( mem_kib < min_mem_mib * 1024 )); then
    printf '%s\n' "Memória disponível abaixo do mínimo; deploy abortado para proteger o Veltrix." >&2
    exit 3
  fi
  if (( disk_kib < min_disk_mib * 1024 )); then
    printf '%s\n' "Disco livre abaixo do mínimo; deploy abortado para proteger o Veltrix." >&2
    exit 3
  fi
  if [[ -n "$veltrix_health_url" ]]; then
    if veltrix_healthy; then
      veltrix_was_healthy=true
      printf '%s\n' "Veltrix saudável antes do deploy."
    else
      veltrix_was_healthy=false
      printf '%s\n' "Aviso: o Veltrix já estava indisponível antes do deploy do Muster." >&2
    fi
  fi
}

veltrix_was_healthy=false

previous_tag="$(read_current_tag || true)"
rollback_started=false

wait_for_healthy() {
  local container_id status attempt

  for attempt in $(seq 1 30); do
    container_id="$(MUSTER_IMAGE_TAG="$target_tag" "${compose[@]}" ps -q muster)"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' "$container_id")"
      if [[ "$status" == "healthy" ]]; then
        return 0
      fi
    fi
    sleep 2
  done

  printf '%s\n' "Muster did not become healthy within 60 seconds." >&2
  return 1
}

backup_database() {
  local backup_file

  if ! "${compose[@]}" ps --status running --services | grep -qx postgres; then
    printf '%s\n' "No running Postgres service; skipping the pre-deploy backup." >&2
    return 0
  fi

  mkdir -p "$backup_dir"
  backup_file="$backup_dir/postgres-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  "${compose[@]}" exec -T postgres pg_dump -U muster -d muster | gzip > "$backup_file"

  # Retain the seven newest dumps. Backup names are generated above and never
  # contain whitespace, so the sortable timestamp format is safe here.
  mapfile -t stale_backups < <(
    find "$backup_dir" -maxdepth 1 -type f -name 'postgres-*.sql.gz' -printf '%T@ %p\n' |
      sort -nr |
      tail -n +8 |
      cut -d' ' -f2-
  )
  if ((${#stale_backups[@]})); then
    rm -f -- "${stale_backups[@]}"
  fi
}

backup_to_r2_when_configured() {
  # Não mostramos nem avaliamos o valor da variável: a presença no ambiente ou
  # no arquivo opcional basta para tornar o envio uma etapa obrigatória.
  if [[ -n "${MUSTER_BACKUP_S3_BUCKET:-}" ]] || \
    { [[ -f "$backup_env_file" ]] && grep -qE '^MUSTER_BACKUP_S3_BUCKET=[^[:space:]]+' "$backup_env_file"; }; then
    MUSTER_BACKUP_ENV_FILE="$backup_env_file" "$backup_script"
  fi
}

persist_current_tag() {
  local temporary_env

  temporary_env="$(mktemp "${env_file}.tmp.XXXXXX")"
  if ! awk -v tag="$target_tag" '
    /^MUSTER_IMAGE_TAG=/ { print "MUSTER_IMAGE_TAG=" tag; found = 1; next }
    { print }
    END { if (!found) print "MUSTER_IMAGE_TAG=" tag }
  ' "$env_file" > "$temporary_env"; then
    rm -f -- "$temporary_env"
    return 1
  fi

  chmod --reference="$env_file" "$temporary_env" 2>/dev/null || chmod 600 "$temporary_env"
  mv -f -- "$temporary_env" "$env_file"
}

rollback() {
  local deployment_status=$?
  trap - ERR

  if [[ "$rollback_started" == false && "$previous_tag" =~ ^sha-[0-9a-f]{40}$ && "$previous_tag" != "$target_tag" ]]; then
    rollback_started=true
    printf '%s\n' "Deployment failed; restoring the previously selected image." >&2
    if MUSTER_IMAGE_TAG="$previous_tag" "${compose[@]}" pull && \
      MUSTER_IMAGE_TAG="$previous_tag" "${compose[@]}" up -d; then
      printf '%s\n' "Rollback completed." >&2
    else
      printf '%s\n' "Rollback could not be completed automatically." >&2
    fi
  else
    printf '%s\n' "Deployment failed before a previous image tag was available; stopping the candidate app." >&2
    MUSTER_IMAGE_TAG="$target_tag" "${compose[@]}" stop muster || true
  fi

  exit "$deployment_status"
}

preflight
backup_database
backup_to_r2_when_configured

# O backup é uma pré-condição: se falhar, interrompemos antes de qualquer
# pull/up e sem acionar rollback, pois nenhuma imagem foi trocada.
trap rollback ERR
MUSTER_IMAGE_TAG="$target_tag" "${compose[@]}" pull
MUSTER_IMAGE_TAG="$target_tag" "${compose[@]}" up -d
wait_for_healthy

health_body="$(curl --fail --silent --show-error http://127.0.0.1:8081/api/healthz)"
if [[ "$health_body" != *"\"sha\":\"$target_sha\""* ]]; then
  printf '%s\n' "Health endpoint did not report the deployed Git SHA." >&2
  false
fi

MUSTER_BASE_URL=http://127.0.0.1:8081 bash "$deploy_dir/scripts/release-smoke.sh"

# Se o Veltrix estava saudável antes e deixou de responder depois da troca do
# Muster, revertemos o Muster: o Veltrix é o produto que já atende clientes.
if [[ "$veltrix_was_healthy" == true ]] && ! veltrix_healthy; then
  printf '%s\n' "O Veltrix deixou de responder após o deploy do Muster; revertendo." >&2
  false
fi

persist_current_tag

trap - ERR
printf '%s\n' "Deployment completed successfully."
