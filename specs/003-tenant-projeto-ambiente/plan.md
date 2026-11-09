# Plan · 003 tenant-projeto-ambiente

Base: `~/.veltrix-tmp/planos/e0-e1-tasks.md`, seção E1 (aprovada em 24/10).

## Abordagem

1. **Schema primeiro** (T1.2–T1.4): migração 0022 única, em três fases
   (cria nullable → backfill → `SET NOT NULL` + FKs compostas + índices), com
   down separado em `lib/db/drizzle/down/`. `drizzle-kit generate` produz o
   esqueleto e o snapshot; o SQL é reordenado à mão nas três fases.
2. **Escopo no código** (T1.5): `tenant-scope.ts` ganha `TenantScope`,
   `inProject`, `inEnv` e a regra de ambiente (`decidirAmbiente`). O scanner
   passa a conhecer as tabelas com projeto e registra, como lista fechada, as
   leituras org-wide que ainda existem (sessões humanas, que seguem org-wide por
   decisão). Leitura nova só com `ofOrg` numa tabela com projeto quebra o teste.
3. **Credencial** (T1.6): a chave resolve `(org, projeto, ambiente)`; o
   middleware aplica a ordem 401 → 404 → 403/404 → 404 da spec.
4. **Rotas** (T1.7): chave com `environment`, agente com `projectId`, outbox e
   `ai_usage_daily` com projeto, rotas `/projects` e leitura de runtime para o
   agente. OpenAPI + Zod + cliente regenerados com orval.
5. **Contrato de tarefa** (T1.8): JSON Schema + Zod escrito à mão (o orval só
   gera a partir do OpenAPI), com teste que confere os dois.
6. **Isolamento** (T1.9): matriz 2×2×2 em `tenant-security.integration.test.ts`
   contra um app Express real (rotas de agente, sem Clerk), em Postgres efêmero;
   também roda depois de `up → down → up`.
7. **Staging** (T1.10): só o runbook nesta rodada.

## Riscos e mitigação

| risco | mitigação |
|---|---|
| inserts antigos sem projeto quebram (seed, scripts, fixtures) | triggers de compatibilidade preenchem projeto/ambiente padrão |
| chave `msk_live_` antiga deixar de funcionar | backfill → prod; parser segue aceitando `msk_live_`; teste com chave antiga |
| 404 vazar existência por corpo diferente | corpo único por tipo de recurso; teste compara bytes |
| down deixar resíduo | diff de `pg_dump --schema-only` 0021 × (0022 + down) |
| `ON CONFLICT` em `ai_usage_daily` com `project_id` NULL | `UNIQUE NULLS NOT DISTINCT` (PG 16) e teste de integração do orçamento |

## Verificação

- `make ci` (typecheck, testes unitários, build, down-guard, name-gate).
- `pnpm test:integration` com Postgres 16 efêmero via docker.
- `drizzle-kit check` sem drift; `generate` sem mudanças após a 0022.
