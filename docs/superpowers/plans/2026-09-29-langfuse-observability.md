# Langfuse Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Langfuse Cloud and v4 self-hosted as an optional, secure Muster connector that turns explicitly correlated observations and scores into audit-ready evidence, re-evaluation signals, recommendations, and action plans.

**Architecture:** Langfuse remains the observability source and Muster the control plane. A native connector polls public read APIs, normalizes only allowed metadata and numerical signals, then invokes a shared in-process materializer that preserves existing event/outbox/reevaluation behavior. Durable sync state and a source-receipt ledger make overlap, retry, restart, and unmapped traces safe.

**Tech Stack:** TypeScript, Express 5, Drizzle/PostgreSQL, Zod/OpenAPI/Orval, React/Vite/TanStack Query, Vitest, Playwright, Node fetch.

**Spec:** `/Users/brunooliveira/dev/Muster-AI-Workforce-Operations/docs/superpowers/specs/2026-09-29-langfuse-observability-design.md`

## Global Constraints

- Implement from `/Users/brunooliveira/dev/Muster-AI-Workforce-Operations` at `codex/feat/gauntlet-1-validator`, not the older detached worktree used to create this plan.
- Support Langfuse Cloud and self-hosted v4 only; use only Observations v2, Scores v3, and Metrics v2 public APIs.
- Polling is near-real-time: expose observed freshness and never call it strict real time.
- Encrypt the complete v1 credential bundle using the existing connector-credential cipher; never return it to browser or logs.
- HTTPS is required except loopback HTTP in local laboratory mode. Reject embedded URL credentials, redirects to another host, and addresses blocked by SSRF policy.
- Attribute source data only with `muster.agent_external_id`, `muster.org_id`, and a tenant-scoped `agent_connector_links` record. Never infer identity from names/models/users.
- Never persist I/O, prompt, retrieved document, tool argument, attachment, secret, or unallowlisted metadata.
- Preserve source currency as metric evidence; do not populate `costCents` or convert to BRL without an explicit versioned FX policy.
- No irreversible automatic action; regressions only create/update the existing approval-gated recommendation and plan workflow.

## Review Focus

- A validated self-hosted URL redirecting to another/private host must be rejected before credentials are sent (Task 1).
- An unmapped trace must be counted and deduplicated without creating an event, evidence, agent, or link (Task 4).
- Late records in an overlap window must materialize once; an identical retry after restart must not duplicate anything (Task 4).
- Text or unmapped categorical scores must remain explanatory lineage, not silently become numeric KPIs (Task 3).
- Non-BRL cost must remain source-currency evidence and not affect legacy monthly-cost arithmetic (Task 3).

---

### Task 1: Secure Langfuse credential and HTTP client boundary

**Files:**
- Create: `artifacts/api-server/src/lib/connectors/langfuse-client.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse-client.test.ts`
- Modify: `artifacts/api-server/src/lib/connectors/types.ts`
- Modify: `artifacts/api-server/src/lib/connectors/credential-crypto.ts`
- Modify: `artifacts/api-server/src/lib/connectors/redaction.ts`

**Interfaces:**
- Produce `LangfuseCredentialBundleV1`, `parseLangfuseCredentialBundle(serialized)`, `validateLangfuseBaseUrl(raw)`, and `LangfusePublicClient`.
- The client exposes `testConnection()`, `listObservations(query)`, `listScores(query)`, and `queryMetrics(query)`; it accepts injected `fetch` for fixtures.
- GitHub's existing `ConnectorCredential` remains compatible; only Langfuse receives a parsed bundle.

- [x] **Step 1: Write failing tests**
  - Validate a bundle with `version: 1`, Cloud and self-hosted HTTPS, local loopback HTTP, encryption/redaction, request fields, and safe error codes.
  - Reject non-loopback HTTP, embedded credentials, malformed URL, redirect host change, private DNS address, oversized response, timeout, 401/403/404/429/5xx, and incompatible endpoint.
- [x] **Step 2: Verify failure**
  - Run: `pnpm --filter @workspace/api-server exec vitest run src/lib/connectors/langfuse-client.test.ts`
  - Expected: FAIL because the client does not exist.
- [x] **Step 3: Implement the boundary**
  - Define the exact bundle as `{ version: 1; baseUrl: string; publicKey: string; secretKey: string; environment?: string }`.
  - Serialize the entire bundle before existing AES-GCM encryption; parse only after in-memory decryption.
  - Use Basic auth on a canonical validated origin, `redirect: "manual"`, timeout, response-size cap, and field allowlist excluding `io`.
- [x] **Step 4: Verify pass**
  - Run: `pnpm --filter @workspace/api-server exec vitest run src/lib/connectors/langfuse-client.test.ts src/lib/connectors/credential-crypto.test.ts src/lib/connectors/redaction.test.ts`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add secure Langfuse public API client"`

### Task 2: Persist sync state, leases, and source receipts

**Files:**
- Create: `lib/db/drizzle/0020_langfuse_connector_sync.sql`
- Create: `lib/db/drizzle/down/0020_langfuse_connector_sync.sql`
- Modify: `lib/db/drizzle/meta/_journal.json`
- Modify: `lib/db/src/schema/index.ts`
- Create: `artifacts/api-server/src/lib/langfuse-sync-state.ts`
- Create: `artifacts/api-server/src/lib/langfuse-sync-state.test.ts`

**Interfaces:**
- Produce `langfuseSyncStates`, `langfuseSyncRuns`, `langfuseSourceReceipts`, and `langfuseScoreMappings`.
- Produce `claimLangfuseSync(connectorId, now)`, `completeLangfuseSync(input)`, and `recordLangfuseSourceReceipt(input): "new" | "duplicate"`.

- [ ] **Step 1: Write failing state tests**
  - Cover clamped initial window, 30-second overlap, exclusive lease, persisted cursor, retry/backoff, checkpoint only after transaction, and receipt dedupe with nullable `agentId`.
- [ ] **Step 2: Verify failure**
  - Run: `pnpm --filter @workspace/api-server exec vitest run src/lib/langfuse-sync-state.test.ts`
  - Expected: FAIL because no sync persistence exists.
- [ ] **Step 3: Add reversible schema and helpers**
  - State owns watermarks/cursors, counters, safe last error, consecutive failures, next attempt, freshness, and lease.
  - Runs are append-only. Receipts are unique on `(connectorId, sourceType, externalId)`; score mappings are explicit per org/connector/name/config/dataType.
  - Use database lease/lock and keep the bounded page cursor on any failed page; do not advance a watermark per row because v2 observations are newest-first.
- [ ] **Step 4: Verify pass**
  - Run: `pnpm --filter @workspace/db run generate && pnpm --filter @workspace/api-server exec vitest run src/lib/langfuse-sync-state.test.ts`
  - Expected: schema current and PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: persist Langfuse sync state and receipts"`

### Task 3: Normalize Langfuse rows into Muster-safe signals

**Files:**
- Create: `artifacts/api-server/src/lib/connectors/langfuse-normalizer.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse-normalizer.test.ts`
- Modify: `artifacts/api-server/src/lib/connectors/types.ts`
- Modify: `artifacts/api-server/src/lib/metric-catalog.ts`

**Interfaces:**
- Produce `normalizeLangfuseObservation(row, context)` and `normalizeLangfuseScore(score, mapping, context)`.
- Use source IDs `langfuse:observation:<id>` and `langfuse:score:<id>`; preserve `traceId` only as `source.reference`.

- [ ] **Step 1: Write failing fixture tests**
  - Cover root success/error/escalation, tool failure, missing correlation, org mismatch, latency/TTFT/tokens/USD cost, numeric/boolean/category/text scores, mapped and unmapped categories.
- [ ] **Step 2: Verify failure**
  - Run: `pnpm --filter @workspace/api-server exec vitest run src/lib/connectors/langfuse-normalizer.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement correlation and mapping**
  - Read correlation only from metadata; preserve release/version/environment/model/prompt identifiers and score config in lineage; drop all else.
  - Map numbers directly; booleans to 1/0 with unit `boolean`; categories only through explicit mapping; keep text/correction as redacted explanation.
  - Emit operational evidence for latency, TTFT, tokens, volume, errors/tool failures, and source-currency cost. Never derive `costCents`.
- [ ] **Step 4: Verify pass and commit**
  - Run: `pnpm --filter @workspace/api-server exec vitest run src/lib/connectors/langfuse-normalizer.test.ts src/lib/evidence/evidence.test.ts`
  - Expected: PASS.
  - Commit: `git commit -m "feat: normalize Langfuse signals into evidence"`

### Task 4: Share materialization and implement manual pull sync

**Files:**
- Create: `artifacts/api-server/src/lib/integration-event-materializer.ts`
- Create: `artifacts/api-server/src/lib/integration-event-materializer.integration.test.ts`
- Create: `artifacts/api-server/src/lib/langfuse-sync-service.ts`
- Create: `artifacts/api-server/src/lib/langfuse-sync-service.integration.test.ts`
- Modify: `artifacts/api-server/src/routes/telemetry.ts`
- Modify: `artifacts/api-server/src/lib/agent-telemetry-reevaluation.ts`

**Interfaces:**
- Extract `materializeIntegrationEnvelope(tx, input): Promise<MaterializationResult>` from the existing authenticated ingestion route.
- Produce `runLangfuseSync({ connectorId, triggeredBy: "manual" | "worker" }): Promise<LangfuseSyncRunResult>`.

- [ ] **Step 1: Write failing materializer integration tests**
  - Prove mapped event/evidence/receipt/outbox are atomic; retry adds nothing; two organizations cannot resolve each other's link.
- [ ] **Step 2: Extract materializer preserving current route behavior**
  - Leave bearer authentication and HTTP response semantics in `routes/telemetry.ts`; move its transaction to the shared service.
  - Run: `RUN_CONNECTOR_INGESTION_DB_TESTS=true pnpm --filter @workspace/api-server exec vitest run src/lib/connector-ingestion.integration.test.ts`
  - Expected: existing test remains PASS.
- [ ] **Step 3: Write failing sync-service fake-server test**
  - Fixture includes two professionals, releases with regression, success/error/escalation/tool rows, scores, cursor pages, source-currency cost, unmapped trace, repeated sync, and interrupted restart.
- [ ] **Step 4: Implement exactly-once pull sync**
  - Resolve only tenant-scoped `agent_connector_links`; record unmapped receipts/counts without an agent/event/evidence.
  - Materialize mapped rows through the shared service and let existing outbox worker re-evaluate.
  - Add release-regression recommendation only with comparable sample/freshness; it remains approval-gated.
- [ ] **Step 5: Verify pass and commit**
  - Run: `RUN_LANGFUSE_SYNC_DB_TESTS=true pnpm --filter @workspace/api-server exec vitest run src/lib/integration-event-materializer.integration.test.ts src/lib/langfuse-sync-service.integration.test.ts src/lib/connector-ingestion.integration.test.ts`
  - Expected: PASS.
  - Commit: `git commit -m "feat: sync Langfuse through Muster telemetry"`

### Task 5: Expose registration, mapping, discovery, and manual-sync APIs

**Files:**
- Modify: `lib/api-spec/openapi.yaml`
- Modify: `artifacts/api-server/src/routes/connectors.ts`
- Modify: `artifacts/api-server/src/lib/connectors/registry.ts`
- Modify: `artifacts/api-server/src/lib/connectors/capabilities.ts`
- Create: `artifacts/api-server/src/routes/langfuse-connectors.test.ts`
- Regenerate: `lib/api-zod/src/generated/**`, `lib/api-client-react/src/generated/**`

**Interfaces:**
- Add registration with `platform: "langfuse"`, credential bundle, and optional cadence.
- Add `POST /connectors/{connectorId}/sync`, `GET /connectors/{connectorId}/sync-status`, and `GET|PUT /connectors/{connectorId}/score-mappings`.
- Extend connector test status with `connected | empty_project | unauthorized | incompatible | timeout | rate_limited | unavailable | rejected_url`.

- [ ] **Step 1: Write failing route/contract tests**
  - Cover org-admin guard, encrypted storage, no secret in response, every test classification, manual-sync counts/freshness, discovery with no auto-admit, mapping data-type validation, and tenant denial.
- [ ] **Step 2: Update OpenAPI first and regenerate clients**
  - Define all request/response schemas before routes; run project code generation.
- [ ] **Step 3: Implement endpoint behavior**
  - Register the adapter only when its secure test/sync flows pass. Group discovery by explicit correlation; return environments/releases/models/activity/scores/gaps.
- [ ] **Step 4: Verify pass and commit**
  - Run: `pnpm --filter @workspace/api-server exec vitest run src/routes/langfuse-connectors.test.ts && pnpm run typecheck`
  - Expected: PASS with generated clients in sync.
  - Commit: `git commit -m "feat: expose Langfuse connector APIs"`

### Task 6: Run continuous sync safely

**Files:**
- Create: `artifacts/api-server/src/lib/langfuse-sync-worker.ts`
- Create: `artifacts/api-server/src/lib/langfuse-sync-worker.test.ts`
- Modify: `artifacts/api-server/src/index.ts`
- Modify: `artifacts/api-server/src/routes/health.ts`
- Modify: `lib/api-spec/openapi.yaml`

**Interfaces:**
- Produce `startLangfuseSyncWorker(config?): () => void` and `getLangfuseSyncWorkerDiagnostics()`.
- Default cadence is 30 seconds; configuration cannot set less than 15 seconds.

- [ ] **Step 1: Write failing worker tests**
  - Cover one claim per connector, min cadence, jittered 429/5xx retry, circuit-open state, stale-lease recovery, manual sync compatibility, and configured/synchronizing/proven/degraded/error transitions.
- [ ] **Step 2: Implement dedicated worker and diagnostics**
  - Start beside—not inside—the telemetry outbox worker. Claim due Langfuse connectors, persist safe lifecycle state, and log only `orgId`, `connectorId`, `syncRunId`, and counters.
- [ ] **Step 3: Verify pass and commit**
  - Run: `pnpm --filter @workspace/api-server exec vitest run src/lib/langfuse-sync-worker.test.ts && pnpm run typecheck`
  - Expected: PASS.
  - Commit: `git commit -m "feat: continuously synchronize Langfuse telemetry"`

### Task 7: Deliver guided setup and provenance UI

**Files:**
- Modify: `artifacts/cohort/src/pages/connectors.tsx`
- Create: `artifacts/cohort/src/pages/connectors.langfuse.test.tsx`
- Modify: `artifacts/cohort/src/pages/agent-detail.tsx`
- Modify: `artifacts/cohort/src/pages/journeys.tsx`

**Interfaces:**
- Consume Task 5 generated hooks. Show state, observed freshness, mapped/unmapped counts, next action, and internal trace reference; never make a public trace link.

- [ ] **Step 1: Write failing UI tests**
  - Cover Cloud/self-hosted entry, secret disappears after submit, connection states, empty project, missing metadata, category mapping, cadence validation, first-sync success/failure, and internal audit reference.
- [ ] **Step 2: Implement platform-specific wizard**
  - Guide credentials → test → discovery/link correction → score mapping → cadence → first sync → freshness. Preserve current GitHub and universal workflows.
- [ ] **Step 3: Add agent/journey provenance**
  - Display source, sample, confidence, freshness, release/environment, and trace reference. Label stale/incomplete data before it affects a decision.
- [ ] **Step 4: Verify pass and commit**
  - Run: `pnpm --filter @workspace/muster run test && pnpm --filter @workspace/muster run build`
  - Expected: PASS.
  - Commit: `git commit -m "feat: guide Langfuse setup and diagnostics"`

### Task 8: Prove the vertical slice and pilot gate

**Files:**
- Create: `artifacts/api-server/src/lib/langfuse-e2e.integration.test.ts`
- Create: `scripts/fixtures/langfuse/observations-page-1.json`
- Create: `scripts/fixtures/langfuse/observations-page-2.json`
- Create: `scripts/fixtures/langfuse/scores-page-1.json`
- Create: `scripts/src/langfuse-fake-server.ts`
- Create: `scripts/src/langfuse-demo.ts`
- Modify: `scripts/package.json`
- Modify: `docs/VALIDACAO-MVP.md`
- Create: `docs/LANGFUSE.md`

**Interfaces:**
- `langfuse-demo` starts a deterministic fake Public API and proves configuration, sync, dedupe, regression, recommendation, approval-gated plan, and lineage.
- External smoke uses only `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY`, and `LANGFUSE_SECRET_KEY`; no variables means skipped, never simulated.

- [ ] **Step 1: Write authenticated E2E**
  - Exercise two tenants/two mapped professionals, all key signals, regression, unmapped trace, repeat/restart, and no cross-tenant access.
- [ ] **Step 2: Implement fixtures, fake server, and demo**
  - Emulate cursor and error behavior deterministically; mark all fixture output simulated and keep smoke separate.
- [ ] **Step 3: Add capacity/restart gate and docs**
  - Test 10,000 observations, multi-connector claims, interruption/resume. Document key provisioning, correlation attributes, allowlist, retention, rotation, and direct-ingestion versus polling.
- [ ] **Step 4: Verify complete suite**
  - Run: `pnpm run typecheck && pnpm test && pnpm run test:integration && pnpm run test:e2e && pnpm --filter @workspace/scripts run langfuse:demo`
  - Expected: PASS; external smoke either passes with real credentials or is explicitly skipped.
- [ ] **Step 5: Commit**
  - `git commit -m "test: prove Langfuse observability vertical slice"`

## Sequencing and Release Gates

1. Tasks 1–2 are mandatory before any live connector registration.
2. Tasks 3–4 must prove normalization, tenant isolation, unmapped handling, and exactly-once materialization before enabling scheduled sync.
3. Tasks 5–7 ship the usable vertical slice behind `LANGFUSE_CONNECTOR_ENABLED=false` by default.
4. Task 8 is the pilot gate: all automated checks, capacity/restart run, and one real smoke pass. A 24-hour soak is the paid-pilot promotion gate, not a local-development blocker.

## Design Decisions Captured

- The existing `external_event_receipts` table cannot represent an unmapped trace because it requires an agent; a dedicated source-receipt ledger is therefore required.
- Sync must use a shared materializer rather than a parallel Langfuse-only transaction, preventing tenant/outbox/evidence behavior from drifting from webhook ingestion.
- Langfuse Observations v2 sorts newest-first. The sync stores cursor/window and advances the watermark only after the full bounded window commits.
- Metrics API aggregates reconcile health/volume but do not replace raw observation/score evidence for decision auditability.

## Self-review

- **Spec coverage:** Tasks 1–8 cover credential safety, SPI, discovery, sync, observations/scores/metrics, state/backoff, UI, recommendations, demo, smoke, and capacity.
- **Out of scope preserved:** no Langfuse UI clone, direct ClickHouse access, feedback/decision export, implicit FX conversion, or irreversible automatic action.
- **Review focus covered:** Tasks 1, 3, and 4 own each high-risk behavior above with explicit tests.
