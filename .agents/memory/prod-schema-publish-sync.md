---
name: Prod DB schema syncs only on publish
description: Why the live app 500s with "column does not exist" while dev works fine after a schema change
---

# Production schema lags until re-publish

After adding/changing Drizzle columns in dev (e.g. new `agents` columns), the **development** app works immediately once you `pnpm --filter @workspace/db run push`, but the **published** app keeps 500ing on every query that selects the new column — deployment logs show `error: column "<name>" does not exist` (a `_DrizzleQueryError`).

**Why:** Replit manages the production database schema *only* through the Publish flow. Publish diffs dev schema → prod and applies the delta. Until the user re-publishes, prod runs the old schema against the new code/queries.

**How to apply:**
- Diagnose by reading deployment logs (`fetch_deployment_logs`), not dev logs — dev will look healthy.
- Fix = have the user **re-publish**. Do NOT write migration scripts, startup DDL, or run DDL against prod (prod is read-only outside publish).
- To prove the dev backend itself is fine, bundle a repro with the api-server's esbuild in **CJS** format (`--format=cjs`, ESM trips on pg's dynamic require) and run it with node.
