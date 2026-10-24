# A4 — Dependências vulneráveis (críticas/altas) em produção

## Problema

`pnpm audit --prod` em `main` (38ed109) reporta 7 vulnerabilidades: 1 crítica
(`proxy-addr@2.0.7`, spoofing de IP via sub-rede IPv4-mapeada em IPv6),
2 altas (`body-parser@2.2.2` — DoS por `limit` inválido e por bytes extras após
corpo comprimido; `zod@3.25.76` — exaustão de memória) e 4 moderadas/baixas
(`qs`, `body-parser`). Todas no caminho do `api-server` (express /
`@clerk/express`), exceto o zod.

Achado lateral: o repo fixa `pnpm@9.15.0` (packageManager e Dockerfile), e o
pnpm 9 **ignora** `overrides` declarados em `pnpm-workspace.yaml` (recurso do
pnpm 10). O lockfile não tinha seção `overrides`, ou seja, os overrides já
existentes no workspace (ex.: `esbuild: 0.27.3`) nunca foram aplicados.

## Decisão

- Upgrade direto de `express` `^5.2.1` → `^5.3.0` no `api-server` (já depende
  de `proxy-addr ^2.0.8`, `qs ^6.16.0`).
- `pnpm.overrides` no `package.json` raiz (o lugar que o pnpm 9 respeita), com
  faixas restritas à linha vulnerável, para garantir mínimos seguros mesmo via
  `@clerk/express`: `proxy-addr >=2.0.8`, `body-parser 2.x >=2.4.0`,
  `qs >=6.16.1`.
- Dev/build-only, só patch/minor compatível: `fast-uri 3.x >=3.1.9`,
  `js-yaml`, `brace-expansion`, `markdown-it`, `linkify-it`, `nanoid`,
  `postcss`, `source-map-js`, `browserslist`; catálogo `vite ^7.3.7`.
- Fora de escopo (exigem major/migração): `zod` 3→4, `vitest` 2→3+ (e
  `tinypool`, `vite@5` interno), `orval` 8.9→≥8.22 (regera clientes).
- `@modelcontextprotocol/sdk` e `dompurify` não fazem parte do grafo deste repo.

## Critérios de aceite

- [x] `pnpm audit --prod` sem críticas; altas apenas `zod` (pendência registrada).
- [x] `pnpm install --frozen-lockfile` passa com o lockfile novo.
- [x] `pnpm run typecheck` e `pnpm test` com os mesmos resultados de antes.
- [x] Build do `api-server` e do `muster` (cohort) passam.
- [x] Nenhuma alteração em `.github/workflows`.
