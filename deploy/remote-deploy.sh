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
compose=(docker compose --project-directory "$deploy_dir" --env-file "$env_file" -f "$compose_file")

read_current_tag() {
  awk -F= '$1 == "MUSTER_IMAGE_TAG" { print substr($0, index($0, "=") + 1) }' "$env_file" | tail -n 1
}

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

trap rollback ERR

backup_database
backup_to_r2_when_configured
MUSTER_IMAGE_TAG="$target_tag" "${compose[@]}" pull
MUSTER_IMAGE_TAG="$target_tag" "${compose[@]}" up -d
wait_for_healthy

health_body="$(curl --fail --silent --show-error http://127.0.0.1:8081/api/healthz)"
if [[ "$health_body" != *"\"sha\":\"$target_sha\""* ]]; then
  printf '%s\n' "Health endpoint did not report the deployed Git SHA." >&2
  false
fi

MUSTER_BASE_URL=http://127.0.0.1:8081 bash "$deploy_dir/scripts/release-smoke.sh"
persist_current_tag

trap - ERR
printf '%s\n' "Deployment completed successfully."
