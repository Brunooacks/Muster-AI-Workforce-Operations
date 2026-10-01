#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--" ]]; then
  shift
fi

base_url="${1:-${MUSTER_BASE_URL:-http://localhost:8080}}"
base_url="${base_url%/}"

request() {
  local path="$1"
  local expected_status="$2"
  local accept="${3:-application/json}"
  local body_file
  body_file="$(mktemp)"
  local status
  status="$(curl --silent --show-error --location --header "Accept: $accept" --output "$body_file" --write-out '%{http_code}' "$base_url$path")"
  if [[ "$status" != "$expected_status" ]]; then
    printf 'FAIL %s expected=%s actual=%s\n' "$path" "$expected_status" "$status" >&2
    cat "$body_file" >&2
    rm -f "$body_file"
    return 1
  fi
  printf 'PASS %s status=%s\n' "$path" "$status"
  cat "$body_file"
  rm -f "$body_file"
}

health="$(request /api/healthz 200)"
grep -q '"status":"ok"' <<<"$health"

worker="$(request /api/healthz/worker 200)"
grep -q '"worker"' <<<"$worker"

for route in / /sign-in /comando /metricas /equipes /jornadas /benchmarks /governanca /conectores /relatorios; do
  page="$(request "$route" 200 'text/html,application/xhtml+xml')"
  grep -qi '<title>Muster' <<<"$page"
done

unknown="$(request /api/not-a-route 404)"
grep -q '"error"' <<<"$unknown"

protected="$(request /api/organizations 401)"
grep -q '"error":"Unauthorized"' <<<"$protected"

printf 'Release smoke aprovado em %s\n' "$base_url"
