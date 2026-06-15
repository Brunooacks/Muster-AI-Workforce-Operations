---
name: Orval codegen collision
description: Why a single API operation must not mix path params and query params in this repo
---
- An operation that declares BOTH a path parameter and a query parameter makes orval generate a `<Operation>Params` zod schema (for the path) AND a `<Operation>Params` type (for the query), which collide in `lib/api-zod/src/index.ts` barrel (`export *` of both api + types) → TS2308.
- **Why:** orval names the path-params zod const `<Op>Params` and the query-params react-query type `<Op>Params`; they only clash when one op has both kinds.
- **How to apply:** make each operation path-only OR query-only. e.g. moved `window` from query to a path segment on `/agents/{agentId}/metrics/{window}`. Endpoints with only query params (listAgents) or only path params (getAgent) are fine.

## orval hangs during `clean`/generate when dev workflows are watching the generated dirs
- Symptom: `orval` prints `api-client-react Cleaning output folder` then hangs forever (codegen times out), even though manual `rm -rf` of the generated dirs is instant.
- **Why:** the `api-server` (esbuild watch) and `cohort` (vite) dev workflows watch `lib/api-client-react` / `lib/api-zod`; their re-optimize churn starves/blocks orval mid-generation.
- **How to apply:** before running codegen, stop those two dev workflows (kill the processes / let the workflow go to `failed`), run codegen, then `restart_workflow` both. mockup-sandbox doesn't import the generated dirs and can stay running.
