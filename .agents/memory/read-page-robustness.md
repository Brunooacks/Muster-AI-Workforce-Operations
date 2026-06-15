---
name: Read-page robustness convention
description: How authenticated read pages in artifacts/cohort handle query errors, empty states, and filters.
---

# Read-page robustness convention (Cohort web app)

Every authenticated read page (dashboard, agents, agent-detail, connectors, alerts) follows this pattern:

- Destructure `isError` + `refetch` from the TanStack Query hook and render the shared
  `ErrorState` (`@/components/query-state`) with `onRetry={() => refetch()}` when a read fails.
  Only destructure the query fields you actually use (unused vars are TS errors here).
- Distinguish **filtered-empty** ("Nenhum … para os filtros atuais") from **truly-empty**
  ("Nenhum … encontrado") — check `data && data.length > 0` for the filtered-out case.
- Client-side filters (verdict on agents, severity+status on alerts) compute a derived
  `filtered*` list; the table maps over the filtered list, not the raw data.
- Guard `name.charAt(0)` as `name?.charAt(0) ?? "?"` and any month/array index lookups
  (`months[i] ?? fallback`) — seed/DTO data is not guaranteed complete.
- Child components that own their own query (e.g. `MetricChart`) must handle their own
  `isLoading`/`isError`, not just the empty case, or transient failures show as false "no data".

**Why:** user asked for the internal front-end + functionality to be more robust; a stale
"AlertTriangle is not defined" crash and missing error/empty handling were the trigger.

**How to apply:** when adding a new read page or query-backed component, replicate this
pattern rather than only handling loading + success.
