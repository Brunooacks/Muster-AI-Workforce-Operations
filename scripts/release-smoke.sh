#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--" ]]; then
  shift
fi

base_url="${1:-${MUSTER_BASE_URL:-http://localhost:8080}}"
base_url="${base_url%/}"

if [[ "${MUSTER_REQUIRE_TLS:-}" == "true" ]]; then
  if [[ "$base_url" != https://* ]]; then
    printf 'FAIL MUSTER_REQUIRE_TLS=true exige URL https:// (recebida: %s)\n' "$base_url" >&2
    exit 1
  fi
fi

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

if [[ -n "${MUSTER_EXPECTED_SHA:-}" ]]; then
  if ! grep -Fq "\"sha\":\"${MUSTER_EXPECTED_SHA}\"" <<<"$health"; then
    printf 'FAIL /api/healthz expected sha=%s\n' "$MUSTER_EXPECTED_SHA" >&2
    exit 1
  fi
  printf 'PASS /api/healthz sha=%s\n' "$MUSTER_EXPECTED_SHA"
fi

if [[ "${MUSTER_REQUIRE_TLS:-}" == "true" ]]; then
  tls_headers="$(mktemp)"
  curl --silent --show-error --location --dump-header "$tls_headers" --output /dev/null "$base_url/api/healthz"
  printf 'PASS TLS certificate validated\n'
  hsts="$(awk 'tolower($0) ~ /^strict-transport-security:/ { sub(/\r$/, ""); print; exit }' "$tls_headers")"
  if [[ -n "$hsts" ]]; then
    printf 'INFO %s\n' "$hsts"
  fi
  rm -f "$tls_headers"
fi

worker="$(request /api/healthz/worker 200)"
grep -q '"worker"' <<<"$worker"

if [[ "${MUSTER_CHECK_AUTH:-}" == "true" ]]; then
  protected="$(request /api/organizations 401)"
  grep -q '"error"' <<<"$protected"
  printf 'PASS /api/organizations status=401\n'
fi

if [[ "${MUSTER_CHECK_SSE:-}" == "true" ]]; then
  sse_body="$(mktemp)"
  sse_status="$(curl --silent --show-error --location --max-time 5 --header 'Accept: text/event-stream' --output "$sse_body" --write-out '%{http_code}' "$base_url/api/telemetry/activity/stream")"
  if [[ "$sse_status" != "401" ]]; then
    printf 'FAIL /api/telemetry/activity/stream expected=401 actual=%s\n' "$sse_status" >&2
    cat "$sse_body" >&2
    rm -f "$sse_body"
    exit 1
  fi
  printf 'PASS /api/telemetry/activity/stream status=401 within=5s\n'
  rm -f "$sse_body"
fi

for route in / /sign-in /comando /metricas /equipes /jornadas /benchmarks /governanca /conectores /relatorios; do
  page="$(request "$route" 200 'text/html,application/xhtml+xml')"
  grep -qi '<title>Muster' <<<"$page"
done

unknown="$(request /api/not-a-route 404)"
grep -q '"error"' <<<"$unknown"

protected="$(request /api/organizations 401)"
grep -q '"error":"Unauthorized"' <<<"$protected"

printf 'Release smoke aprovado em %s\n' "$base_url"
