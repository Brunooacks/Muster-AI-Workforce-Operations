---
name: Carteira de Trabalho (agent-detail) intelligence sourcing
description: Where the agent-detail page's "visão e inteligência" data comes from — frontend-derived, not schema fields
---

The agent-detail page (`artifacts/cohort/src/pages/agent-detail.tsx`) renders the full
"Carteira de Trabalho" as a single-scroll 5-section layout with a Gestor/Platform
audience toggle. The dual-audience dictionary + presentational primitives live in
`artifacts/cohort/src/components/carteira.tsx`.

Key sourcing decisions (do NOT add schema/openapi fields for these):
- **Detector de Vitória Ilusória** = the existing `alerts` table, fetched via
  `useListFleetAlerts` (fleet-wide) and filtered client-side by `agentId` + `status==="active"`.
  There is no agent-scoped alerts endpoint; the Alert DTO carries `agentId`/`agentName`.
- **Histórico timeline** = 3 snapshots derived client-side from `useGetAgentMetrics(id,"30d")`
  (pick first/mid/last points), with per-snapshot verdict from the same score thresholds
  as server `scoreEvaluation`.
- **Per-metric targets** = domain-constant map `METRIC_TARGETS` keyed by metric label
  (defaults from the product spec Parte 2). NOT data — do not compute severity from
  value-vs-target because seeded metric values are random and not calibrated to targets.

**Why:** keeps the rich UI faithful to the reference without schema/codegen churn (and
avoids merge conflicts with the still-pending "Telas complementares" task). Targets/timeline
are domain knowledge + computation over real data, which is legitimate, not mocked.
