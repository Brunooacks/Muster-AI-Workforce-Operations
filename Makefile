# Muster · alvos de CI reproduzíveis (substitui o GitHub Actions).
# `make ci` roda localmente e no Woodpecker com o mesmo resultado; para fixar
# Node 24 / pnpm 9.15.0 sem depender da máquina, use `make ci-container`.

SHELL := bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

NODE_MAJOR := 24
PNPM_VERSION := 9.15.0

define step
	@printf '\n==> [%s] %s\n' "$$(date -u +%H:%M:%S)" "$(1)"
endef

.PHONY: help ci ci-core ci-container toolchain install typecheck test build go-test down-guard name-gate hooks

help:
	@printf '%s\n' \
	  'make ci            install, typecheck, test, build, go-test, down-guard e name-gate' \
	  'make ci-core       o mesmo que ci, sem o name-gate (step separado no Woodpecker)' \
	  'make ci-container  make ci dentro de node:$(NODE_MAJOR)-bookworm (toolchain fixa)' \
	  'make name-gate     gate de nomes bloqueados (lista fora do repo)' \
	  'make hooks         instala os hooks de scripts/hooks (pre-push)'

ci: ci-core name-gate
	$(call step,ci concluído)

# Ordem do antigo .github/workflows/ci.yml: install → typecheck → test → build.
ci-core: toolchain install typecheck test build go-test down-guard

ci-container:
	bash scripts/ci/run-in-container.sh make ci

toolchain:
	$(call step,toolchain)
	@node_major="$$(node -p 'process.versions.node.split(".")[0]')"; \
	  printf 'node %s · pnpm %s\n' "$$(node -v)" "$$(pnpm -v)"; \
	  if [[ "$$node_major" != "$(NODE_MAJOR)" ]]; then \
	    printf 'Aviso: o CI usa Node $(NODE_MAJOR); este ambiente usa Node %s (use make ci-container para reproduzir exatamente).\n' "$$node_major" >&2; \
	  fi; \
	  if [[ "$$(pnpm -v)" != "$(PNPM_VERSION)" ]]; then \
	    printf 'Aviso: o CI usa pnpm $(PNPM_VERSION) (corepack prepare pnpm@$(PNPM_VERSION) --activate).\n' >&2; \
	  fi

install:
	$(call step,install)
	pnpm install --frozen-lockfile

typecheck:
	$(call step,typecheck)
	pnpm run typecheck

test:
	$(call step,test)
	pnpm test

build:
	$(call step,build)
	pnpm -r --if-present run build

# Só existe a partir da E2; até lá a etapa é pulada sem falhar.
go-test:
	$(call step,go-test)
	@if [[ -d core ]]; then (cd core && go test ./...); else echo 'core/ ausente; go test pulado.'; fi

down-guard:
	$(call step,down-guard)
	pnpm --filter @workspace/scripts exec vitest run ci/down-guard.test.mjs

name-gate:
	$(call step,name-gate)
	bash scripts/ci/name-gate.sh

hooks:
	git config core.hooksPath scripts/hooks
	@echo 'Hooks instalados (core.hooksPath=scripts/hooks).'
