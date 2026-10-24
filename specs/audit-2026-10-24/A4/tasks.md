# A4 — Tarefas

- [x] Linha de base: `pnpm audit --prod`, `pnpm audit`, typecheck e testes em `main`.
- [x] Verificar versões corrigidas publicadas há mais de 1 dia (`minimumReleaseAge`).
- [x] `api-server`: `express` → `^5.3.0`.
- [x] `pnpm.overrides` no `package.json` raiz (prod: proxy-addr, body-parser 2.x, qs).
- [x] Overrides dev-only de patch (fast-uri, js-yaml, brace-expansion, markdown-it,
      linkify-it, nanoid, postcss, source-map-js, browserslist); catálogo `vite ^7.3.7`.
- [x] Confirmar que o pnpm 9 grava `overrides` no lockfile (o YAML era ignorado).
- [x] Pós-mudança: audit, `install --frozen-lockfile`, typecheck, testes, builds.
- [ ] Pendência: migrar `zod` 3 → 4 (advisory alto, prod).
- [ ] Pendência: `vitest` 2 → ≥3.2.6 (crítico, dev) e `orval` → ≥8.22 (crítico, dev).
- [ ] Pendência: decidir sobre os overrides antigos em `pnpm-workspace.yaml`
      (inativos no pnpm 9) — migrar para `package.json` ou subir para pnpm 10.
