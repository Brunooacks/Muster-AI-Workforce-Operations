#!/usr/bin/env bash
# Copia para <destino> só o que o migrator do Drizzle lê: os .sql do nível de
# cima de lib/db/drizzle e a pasta meta/ (com o _journal.json). A pasta down/
# fica de fora de propósito (D-E1-5): downs são aplicados só à mão.
set -euo pipefail

source_dir="${1:?Uso: package-migrations.sh <origem> <destino>}"
target_dir="${2:?Uso: package-migrations.sh <origem> <destino>}"

[[ -f "$source_dir/meta/_journal.json" ]] || {
  echo "package-migrations: $source_dir/meta/_journal.json ausente." >&2
  exit 2
}

mkdir -p "$target_dir"
find "$source_dir" -maxdepth 1 -type f -name '*.sql' -exec cp -- {} "$target_dir/" \;
cp -R -- "$source_dir/meta" "$target_dir/meta"
