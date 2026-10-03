#!/usr/bin/env bash

# Gera, confere ou (mediante confirmação explícita) aplica a proteção de main.
# A aplicação é uma operação manual do responsável pelo repositório.
set -euo pipefail

readonly REPOSITORY="Brunooacks/Muster-AI-Workforce-Operations"
readonly ENDPOINT="repos/${REPOSITORY}/branches/main/protection"
readonly DEFAULT_CHECKS="typecheck · test · build,actionlint"

mode="print"
checks_source="${REQUIRED_CHECKS:-$DEFAULT_CHECKS}"
enforce_admins="${ENFORCE_ADMINS:-true}"

usage() {
  cat <<'EOF'
Uso: scripts/branch-protection.sh [--print|--payload|--check|--apply] [opções]

Gera a proteção de main para Brunooacks/Muster-AI-Workforce-Operations.

Opções:
  --checks <lista>          Checks separados por vírgula (ou REQUIRED_CHECKS).
  --enforce-admins <bool>   true ou false (ou ENFORCE_ADMINS; padrão: true).
  --print                   Imprime o payload e o comando gh api (padrão).
  --payload                 Imprime somente o payload JSON.
  --check                   Faz somente GET e compara a proteção remota.
  --apply                   Exige confirmação interativa antes de fazer PUT.
  -h, --help                Exibe esta ajuda.
EOF
}

fail() {
  printf 'Erro: %s\n' "$*" >&2
  exit 2
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

while (($# > 0)); do
  case "$1" in
    --checks)
      (($# >= 2)) || fail '--checks exige uma lista.'
      checks_source="$2"
      shift 2
      ;;
    --enforce-admins)
      (($# >= 2)) || fail '--enforce-admins exige true ou false.'
      enforce_admins="$2"
      shift 2
      ;;
    --print|--payload|--check|--apply)
      mode="${1#--}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "opção desconhecida: $1"
      ;;
  esac
done

case "$enforce_admins" in
  true|false) ;;
  *) fail 'ENFORCE_ADMINS/--enforce-admins deve ser true ou false.' ;;
esac

IFS=',' read -r -a raw_checks <<< "$checks_source"
checks=()
for raw_check in "${raw_checks[@]}"; do
  check="$(trim "$raw_check")"
  [[ -n "$check" ]] || fail 'A lista de checks não pode conter nomes vazios.'
  checks+=("$check")
done
((${#checks[@]} > 0)) || fail 'Informe ao menos um check obrigatório.'

payload="$({
  node -e '
    const [enforceAdmins, ...contexts] = process.argv.slice(1);
    const payload = {
      required_status_checks: { strict: true, contexts },
      enforce_admins: enforceAdmins === "true",
      required_pull_request_reviews: {
        dismissal_restrictions: { users: [], teams: [], apps: [] },
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false,
        required_approving_review_count: 1,
        require_last_push_approval: false,
        bypass_pull_request_allowances: { users: [], teams: [], apps: [] },
      },
      restrictions: null,
      required_linear_history: false,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: true,
      lock_branch: false,
      allow_fork_syncing: false,
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  ' "$enforce_admins" "${checks[@]}"
} )"

print_payload() {
  printf '%s\n' "$payload"
}

compare_remote_protection() {
  local current="$1"
  DESIRED_PAYLOAD="$payload" CURRENT_PROTECTION="$current" node -e '
    function enabled(value) {
      return typeof value === "object" && value !== null ? value.enabled === true : value === true;
    }
    function allowances(value) {
      return {
        users: value?.users ?? [],
        teams: value?.teams ?? [],
        apps: value?.apps ?? [],
      };
    }
    function normalize(value) {
      const reviews = value.required_pull_request_reviews;
      return {
        required_status_checks: value.required_status_checks === null ? null : {
          strict: value.required_status_checks?.strict === true,
          contexts: [...(value.required_status_checks?.contexts ?? [])].sort(),
        },
        enforce_admins: enabled(value.enforce_admins),
        required_pull_request_reviews: reviews === null ? null : {
          dismissal_restrictions: allowances(reviews?.dismissal_restrictions),
          dismiss_stale_reviews: reviews?.dismiss_stale_reviews === true,
          require_code_owner_reviews: reviews?.require_code_owner_reviews === true,
          required_approving_review_count: reviews?.required_approving_review_count ?? 0,
          require_last_push_approval: reviews?.require_last_push_approval === true,
          bypass_pull_request_allowances: allowances(reviews?.bypass_pull_request_allowances),
        },
        restrictions: value.restrictions ?? null,
        required_linear_history: enabled(value.required_linear_history),
        allow_force_pushes: enabled(value.allow_force_pushes),
        allow_deletions: enabled(value.allow_deletions),
        block_creations: enabled(value.block_creations),
        required_conversation_resolution: enabled(value.required_conversation_resolution),
        lock_branch: enabled(value.lock_branch),
        allow_fork_syncing: enabled(value.allow_fork_syncing),
      };
    }
    const desired = normalize(JSON.parse(process.env.DESIRED_PAYLOAD));
    const current = normalize(JSON.parse(process.env.CURRENT_PROTECTION));
    if (JSON.stringify(desired) !== JSON.stringify(current)) {
      console.error("A proteção remota difere do payload desejado.");
      console.error(`Desejado: ${JSON.stringify(desired)}`);
      console.error(`Remoto: ${JSON.stringify(current)}`);
      process.exit(1);
    }
    console.log("Proteção remota confere com o payload desejado.");
  '
}

case "$mode" in
  payload)
    print_payload
    ;;
  print)
    print_payload
    printf '\n# Comando que o responsável pelo repositório rodaria:\n'
    printf 'gh api --method PUT "%s" --input <(scripts/branch-protection.sh --payload)\n' "$ENDPOINT"
    ;;
  check)
    current_protection="$(gh api "$ENDPOINT")"
    compare_remote_protection "$current_protection"
    ;;
  apply)
    [[ -t 0 ]] || fail '--apply exige confirmação interativa; use --print para revisão.'
    read -r -p 'Digite APLICAR para atualizar a proteção de main: ' confirmation
    [[ "$confirmation" == 'APLICAR' ]] || fail 'Aplicação cancelada; nenhuma chamada ao GitHub foi feita.'
    printf '%s\n' "$payload" | gh api --method PUT "$ENDPOINT" --input -
    ;;
esac
