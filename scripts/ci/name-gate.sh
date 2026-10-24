#!/usr/bin/env bash
# Gate de nomes bloqueados (nomes pessoais e dados regulados).
#
# A lista nunca entra no repo. Ordem de leitura:
#   1. MUSTER_BLOCKLIST       conteúdo da lista (no Woodpecker, segredo muster_blocklist)
#   2. MUSTER_BLOCKLIST_FILE  caminho de um arquivo com a lista
#   3. ~/.config/muster/blocklist
# Um termo por linha; linhas vazias e começadas por # são ignoradas. A busca é
# por texto literal, sem diferenciar maiúsculas. Sem lista (ou lista vazia) o
# gate falha. O relatório mostra só arquivo:linha, nunca o termo encontrado.
#
# Uso:
#   name-gate.sh                         varre os arquivos versionados
#   name-gate.sh --commits <rev-list…>   varre linhas adicionadas e autor/committer
#                                        dos commits (ex.: HEAD ^origin/main)
#
# Saída: 0 = limpo · 1 = ocorrências · 2 = uso inválido · 3 = lista ausente.
set -euo pipefail

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
}

mode="files"
rev_args=()
case "${1:-}" in
  "") ;;
  --commits)
    shift
    (($# > 0)) || { echo 'name-gate: --commits exige argumentos do git rev-list.' >&2; exit 2; }
    mode="commits"
    rev_args=("$@")
    ;;
  -h|--help) usage; exit 0 ;;
  *) echo "name-gate: opção desconhecida: $1" >&2; exit 2 ;;
esac

work="$(mktemp -d "${TMPDIR:-/tmp}/muster-name-gate.XXXXXX")"
trap 'rm -rf -- "$work"' EXIT
chmod 700 "$work"
terms="$work/terms"

load_terms() {
  local source_label
  if [[ -n "${MUSTER_BLOCKLIST:-}" ]]; then
    printf '%s\n' "$MUSTER_BLOCKLIST" > "$work/raw"
    source_label="variável MUSTER_BLOCKLIST"
  elif [[ -n "${MUSTER_BLOCKLIST_FILE:-}" ]]; then
    [[ -r "$MUSTER_BLOCKLIST_FILE" ]] || {
      echo 'name-gate: MUSTER_BLOCKLIST_FILE aponta para um arquivo inexistente ou ilegível.' >&2
      exit 3
    }
    cat -- "$MUSTER_BLOCKLIST_FILE" > "$work/raw"
    source_label="arquivo MUSTER_BLOCKLIST_FILE"
  elif [[ -r "${HOME:-/nonexistent}/.config/muster/blocklist" ]]; then
    cat -- "$HOME/.config/muster/blocklist" > "$work/raw"
    source_label="~/.config/muster/blocklist"
  else
    cat >&2 <<'EOF'
name-gate: nenhuma lista de bloqueio configurada; o gate não passa em silêncio.
Defina MUSTER_BLOCKLIST (segredo muster_blocklist no Woodpecker), MUSTER_BLOCKLIST_FILE
ou crie ~/.config/muster/blocklist (um termo por linha). Veja docs/CI.md.
EOF
    exit 3
  fi

  tr -d '\r' < "$work/raw" |
    sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' |
    grep -v -e '^#' -e '^$' > "$terms" || true
  rm -f -- "$work/raw"

  local count
  count="$(wc -l < "$terms" | tr -d ' ')"
  if [[ "$count" == "0" ]]; then
    echo "name-gate: a lista de bloqueio ($source_label) está vazia." >&2
    exit 3
  fi
  echo "name-gate: $count termo(s) carregado(s) de $source_label."
}

# Caminhos que não são varridos: dependências, saídas de build e lockfile.
pathspec=(-- . ':(exclude)pnpm-lock.yaml' ':(exclude)**/pnpm-lock.yaml'
  ':(exclude)node_modules/**' ':(exclude)**/node_modules/**'
  ':(exclude)dist/**' ':(exclude)**/dist/**')

findings="$work/findings"
: > "$findings"

scan_files() {
  local file
  # Conteúdo: git grep acha os arquivos; grep dá só o número da linha.
  while IFS= read -r -d '' file; do
    { grep -n -I -i -F -f "$terms" -- "$file" || true; } | cut -d: -f1 |
      while IFS= read -r line; do printf '%s:%s\n' "$file" "$line"; done >> "$findings"
  done < <(git grep -z -l -I -i -F -f "$terms" "${pathspec[@]}" || true)

  # Nomes de arquivo: o próprio caminho revelaria o termo, então só contamos.
  local path_hits
  path_hits="$(git ls-files "${pathspec[@]}" | grep -c -i -F -f "$terms" || true)"
  if [[ "$path_hits" != "0" ]]; then
    printf '(caminho) %s arquivo(s) versionado(s) com termo bloqueado no nome; confira localmente com git ls-files | grep -n -i -F -f <lista>\n' "$path_hits" >> "$findings"
  fi
}

# Monta dois arquivos paralelos: o texto a verificar e o rótulo de cada linha.
scan_commits() {
  local text="$work/text" labels="$work/labels" commit short
  : > "$text"
  : > "$labels"
  while IFS= read -r commit; do
    short="${commit:0:12}"
    git show -s --format='%an%n%ae' "$commit" >> "$text"
    printf 'commit %s autor\ncommit %s autor\n' "$short" "$short" >> "$labels"
    git show -s --format='%cn%n%ce' "$commit" >> "$text"
    printf 'commit %s committer\ncommit %s committer\n' "$short" "$short" >> "$labels"
    git show -s --format='%B' "$commit" | awk -v c="$short" -v t="$text" -v l="$labels" \
      '{ print >> t; print "commit " c " mensagem:" NR >> l }'
    git show --format= -U0 --no-color --no-ext-diff --no-renames "$commit" "${pathspec[@]}" |
      awk -v c="$short" -v t="$text" -v l="$labels" '
        /^diff --git / { header = 1; file = ""; next }
        header && /^\+\+\+ / { file = substr($0, 5); sub(/^b\//, "", file); next }
        /^@@ / {
          header = 0
          split($3, range, ",")
          line = substr(range[1], 2) + 0
          next
        }
        header { next }
        /^\+/ {
          if (file != "" && file != "/dev/null") {
            print substr($0, 2) >> t
            print "commit " c " " file ":" line >> l
          }
          line++
        }'
  done < <(git rev-list "${rev_args[@]}")

  grep -n -i -F -f "$terms" -- "$text" | cut -d: -f1 |
    while IFS= read -r index; do sed -n "${index}p" "$labels"; done >> "$findings" || true
}

load_terms
if [[ "$mode" == "files" ]]; then
  scan_files
else
  scan_commits
fi

if [[ -s "$findings" ]]; then
  count="$(sort -u "$findings" | wc -l | tr -d ' ')"
  echo "name-gate: FALHOU · $count ocorrência(s) de termo bloqueado (o termo não é exibido):"
  sort -u "$findings" | sed 's/^/  /'
  exit 1
fi
echo "name-gate: ok, nenhuma ocorrência."
