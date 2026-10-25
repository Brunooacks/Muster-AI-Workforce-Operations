# Tasks · 003 tenant-projeto-ambiente

Formato Spec Kit. `[x]` = feito e commitado nesta branch (um commit por tarefa).

- [x] **T1.1** Spec, plan, data-model e tasks em `specs/003-tenant-projeto-ambiente/`
- [x] **T1.2** Migração 0022 (up) + schema Drizzle (`projects`, `environments`, colunas novas, FKs compostas, índices; snapshot e journal)
- [x] **T1.3** Backfill idempotente na 0022 + guarda `DO $$` + log de contagens no startup + `ai-budget` gravando `project_id` quando conhecido + `backfill-0022.test.ts`
- [ ] **T1.4** Down 0022 em `lib/db/drizzle/down/` + `tenant-security-migration.test.ts` estendido + up→down→up com diff de schema
- [ ] **T1.5** `tenant-scope.ts`: `TenantScope`, `inProject`, `inEnv`, tabelas com projeto, scanner exigindo `inProject`
- [ ] **T1.6** Credencial resolve `(org, projeto, ambiente)`; `msk_sbx_`; códigos 401/404/403
- [ ] **T1.7** Rotas e queries (chaves com ambiente, agente com projeto, outbox, `/projects`, runtime do agente, OpenAPI + Zod + cliente, seletor de ambiente na tela de chaves)
- [ ] **T1.8** Envelope de tarefa (`task-envelope.schema.json` + Zod + teste)
- [ ] **T1.9** Matriz de isolamento 2×2×2 + `make ci-integration` + step no Woodpecker
- [ ] **T1.10** Runbook `docs/runbooks/0022-projects-envs.md` (sem aplicar em servidor)
