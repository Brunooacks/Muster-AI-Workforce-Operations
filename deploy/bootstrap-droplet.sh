#!/usr/bin/env bash
# Prepara somente os diretórios e pré-requisitos do Muster. Por segurança,
# apenas imprime o plano até receber --apply.
set -euo pipefail

apply=false
deploy_user="muster-deploy"
veltrix_health_url=""
bootstrap_root="${BOOTSTRAP_ROOT:-/opt/muster}"

usage() {
  cat <<'EOF'
Uso: bootstrap-droplet.sh [--apply] [--deploy-user <usuario>] [--veltrix-health-url <URL>]

Dry-run é o padrão. --apply cria apenas o usuário de deploy e os caminhos sob
BOOTSTRAP_ROOT (padrão: /opt/muster). A URL do healthz do Veltrix, quando
informada, é consultada somente por leitura antes e depois do plano.
EOF
}

while (($#)); do
  case "$1" in
    --apply) apply=true ;;
    --deploy-user)
      deploy_user="${2:?--deploy-user precisa de um valor}"
      shift
      ;;
    --veltrix-health-url)
      veltrix_health_url="${2:?--veltrix-health-url precisa de uma URL}"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Argumento desconhecido: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [[ ! "$bootstrap_root" = /* || "$bootstrap_root" == "/" ]]; then
  printf 'BOOTSTRAP_ROOT deve ser um caminho absoluto diferente de /.\n' >&2
  exit 2
fi
if [[ ! "$deploy_user" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]]; then
  printf 'Nome de usuário de deploy inválido.\n' >&2
  exit 2
fi

plan() {
  printf 'PLANO: %s\n' "$*"
}

run() {
  if "$apply"; then
    "$@"
  else
    plan "$(printf '%q ' "$@")"
  fi
}

check_platform() {
  local os_name os_id
  os_name="${BOOTSTRAP_OS_NAME:-$(uname -s)}"
  if [[ "$os_name" != "Linux" ]]; then
    printf 'Este bootstrap deve ser executado em Linux; encontrado: %s.\n' "$os_name" >&2
    exit 1
  fi

  os_id="${BOOTSTRAP_OS_ID:-unknown}"
  if [[ "$os_id" == "unknown" && -r /etc/os-release ]]; then
    os_id="$(. /etc/os-release && printf '%s' "${ID:-unknown}")"
  fi
  printf 'SO verificado: Linux (%s).\n' "$os_id"
}

check_docker() {
  command -v docker >/dev/null || {
    printf 'Docker não encontrado no PATH.\n' >&2
    exit 1
  }
  docker --version
  docker compose version
}

check_veltrix() {
  local stage="$1"
  if [[ -z "$veltrix_health_url" ]]; then
    printf 'Healthz do Veltrix: não verificado (informe --veltrix-health-url).\n'
    return
  fi
  printf 'Healthz do Veltrix (%s, somente leitura): ' "$stage"
  curl --fail --silent --show-error --max-time 10 "$veltrix_health_url" >/dev/null
  printf 'ok\n'
}

capacity_report() {
  local total_kib available_kib used_percent cpu_count disk_line disk_available_kib disk_target
  total_kib="${BOOTSTRAP_MEM_TOTAL_KIB:-$(awk '/MemTotal:/ { print $2; exit }' /proc/meminfo)}"
  available_kib="${BOOTSTRAP_MEM_AVAILABLE_KIB:-$(awk '/MemAvailable:/ { print $2; exit }' /proc/meminfo)}"
  cpu_count="${BOOTSTRAP_CPU_COUNT:-$(getconf _NPROCESSORS_ONLN)}"
  disk_target="$bootstrap_root"
  while [[ ! -e "$disk_target" ]]; do
    disk_target="$(dirname "$disk_target")"
  done
  disk_line="$(df -Pk "$disk_target" | awk 'NR == 2 { print $4 " " $5 }')"
  disk_available_kib="${BOOTSTRAP_DISK_AVAILABLE_KIB:-${disk_line%% *}}"
  used_percent=$(( (total_kib - available_kib) * 100 / total_kib ))

  printf 'Capacidade: RAM disponível=%s KiB; RAM usada=%s%%; CPU=%s; disco disponível=%s KiB.\n' \
    "$available_kib" "$used_percent" "$cpu_count" "$disk_available_kib"
  if (( available_kib < 2097152 || used_percent > 60 )); then
    printf 'GATILHO DE CAPACIDADE: atingido (RAM livre < 2 GiB ou uso > 60%%). Avalie migrar o Muster.\n'
  else
    printf 'Gatilho de capacidade: não atingido.\n'
  fi
}

ensure_deploy_user() {
  if id -u "$deploy_user" >/dev/null 2>&1; then
    printf 'Usuário de deploy já existe: %s.\n' "$deploy_user"
  else
    run useradd --create-home --shell /bin/bash "$deploy_user"
  fi
}

ensure_layout() {
  local env_file="$bootstrap_root/.env.production"
  run install -d -m 750 "$bootstrap_root" "$bootstrap_root/backups" "$bootstrap_root/scripts"
  if [[ -e "$env_file" ]]; then
    printf 'Arquivo de ambiente existente preservado: %s.\n' "$env_file"
  elif "$apply"; then
    umask 077
    cat > "$env_file" <<'EOF'
POSTGRES_PASSWORD=
DATABASE_URL=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
WEB_APP_URL=
CORS_ALLOWED_ORIGINS=
MUSTER_IMAGE_TAG=
EOF
    chmod 600 "$env_file"
    printf 'Template vazio criado com permissão 600: %s.\n' "$env_file"
  else
    plan "criar template vazio com permissão 600 em $env_file (sem sobrescrever)"
  fi
}

main() {
  printf 'Bootstrap do Muster: %s.\n' "$([[ "$apply" == true ]] && printf 'APPLY' || printf 'DRY-RUN')"
  check_platform
  check_veltrix antes
  check_docker
  ensure_deploy_user
  ensure_layout
  capacity_report
  printf 'GHCR: execute manualmente docker login ghcr.io com um token read-only; este script não lê nem grava tokens.\n'
  check_veltrix depois
  printf 'Bootstrap concluído.\n'
}

main
