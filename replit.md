# Cohort

Cohort é uma plataforma plug-and-play que dá às frotas de agentes de IA (multi-plataforma) identidade, carteira de trabalho, análise de desempenho em 5 camadas e governança — para decidir entre **Promover, Mentorar ou Aposentar** cada agente.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port via `PORT`)
- `pnpm --filter @workspace/cohort run dev` — run the web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only; interactive — see Gotchas)
- Required env: `DATABASE_URL` — Postgres connection string. Clerk auth is Replit-managed (no manual keys).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (pino logging — never `console.log`, use `req.log`/`logger`)
- Web: React + Vite + wouter + TanStack Query + shadcn/ui + Clerk (`@clerk/react`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — Drizzle tables (source of truth for DB schema)
- `lib/api-zod/src/generated/api.ts` — generated Zod response schemas (source of truth for API shapes)
- `artifacts/api-server/src/app.ts` — Express app: Clerk proxy + middleware, `/api` router, global error handler
- `artifacts/api-server/src/routes/` — `health`, `fleet`, `agents`, `connectors`
- `artifacts/api-server/src/lib/discovery.ts` — `PLATFORM_CATALOG`, `buildProposedMetrics`, deterministic `scoreEvaluation`
- `artifacts/api-server/src/lib/seed.ts` — `ensureSeed` (runs on boot only if agents table empty)
- `artifacts/api-server/src/lib/serializers.ts` — DB row → API DTO mappers
- `artifacts/cohort/src/App.tsx` — Clerk wiring + routes

## Architecture decisions

- **Shared org-wide fleet by design** — Cohort intentionally has NO per-tenant scoping on the fleet; all authenticated users see the same shared fleet. (Architect flagged tenant-scoping; left out deliberately.)
- **Deterministic evaluation** — `scoreEvaluation` uses a seeded RNG keyed by agent `externalId`, so verdicts/scores are reproducible across seed runs.
- **Connector architecture is plug-ready** — `PLATFORM_CATALOG` models discovered agents per platform so a real connector can be swapped in later without UI changes.
- **No Replit-specific coupling** in app logic — only the Clerk-managed auth integration.
- **Auth required everywhere** — every `/api` route except `/healthz` uses `requireAuth` (returns 401 unauthenticated).

## Product

- **Admissão** — descobrir agentes via conectores e admiti-los na frota com identidade e carteira de trabalho.
- **Avaliação** — análise de 5 camadas: eficácia, eficiência, adoção, governança, valor.
- **Veredito** — Promover / Mentorar / Aposentar, com confiança, janela de execução e plano de ação.
- **Detector de Vitória Ilusória** — sinaliza padrões enganosos de sucesso.
- **Comitê / Governança da Frota** — donos de negócio/técnico/sponsor por agente.
- UI inteiramente em português do Brasil. Design "Neutro Notion": fundo papel quente, monocromático + leve acento sage.

## User preferences

- **Design:** "Neutro Notion" (fundo papel quente, monocromático + acento sage suave). O usuário **rejeitou** dark-amber.
- **Idioma da UI:** português do Brasil.
- **Vocabulário do produto:** Frota, Carteira de Trabalho, Veredito, Admissão, Comitê, Detector de Vitória Ilusória.
- **Sem acoplamento específico do Replit** na lógica do produto.

## Gotchas

- `drizzle-kit push` is **interactive** and fails without a TTY when a change touches existing rows (e.g. adding a `.unique()` to a populated column) — even with `--force`, it prompts to truncate. For such cases apply the SQL directly with the same constraint name Drizzle expects (e.g. `agents_external_id_unique`) so future pushes stay in sync.
- `zod/v4` is **not resolvable** from `api-server` (it has no direct `zod` dep; `@workspace/api-zod` re-exports v3 namespace). Duck-type `ZodError` (`err.name === "ZodError"` + `Array.isArray(err.issues)`) instead of importing it.
- Orval codegen can hang while dev workflows watch files — stop `api-server` + `cohort` workflows before running codegen. See `.agents/memory/orval-codegen.md`.
- Both dev workflows are artifact-managed (env `PORT`/`BASE_PATH` injected) — never remove them; restart instead.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
