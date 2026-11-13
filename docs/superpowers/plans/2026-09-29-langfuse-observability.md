# Langfuse Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um conector Langfuse Cloud/self-hosted que sincronize traces e scores com o Muster, materialize métricas auditáveis e acione o loop existente de recomendação e decisão.

**Architecture:** O caminho imediato de eventos do Muster permanece independente. Um adapter nativo consulta Langfuse v4 em janelas delimitadas, correlaciona observations e scores por metadata explícita, reutiliza a materialização tenant-scoped do contrato universal e dispara a reavaliação existente por outbox. Um worker com lease, watermark e backoff mantém near-real-time; a UI expõe configuração, discovery, score mapping, freshness e diagnóstico.

**Tech Stack:** TypeScript, Node.js 22, Express 5, Drizzle/PostgreSQL, Vitest, React 19, TanStack Query, Playwright, OpenAPI 3.1/Orval, Langfuse Public APIs v2/v3 via `fetch` nativo.

**Spec:** `docs/superpowers/specs/2026-09-29-langfuse-observability-design.md`

## Global Constraints

- Usar somente Observations API v2, Metrics API v2 e Scores API v3 do Langfuse v4.
- Declarar a coleta por polling como near-real-time, com padrão de 30 s e mínimo de 15 s.
- Não consultar nem persistir prompts, respostas, tool arguments ou anexos por padrão.
- Solicitar somente `core,basic,metadata,usage,metrics,trace_context` nas observations.
- Exigir `muster.org_id` e `muster.agent_external_id`; não inferir identidade pelo nome do trace.
- Criptografar `baseUrl`, `publicKey` e `secretKey` no envelope existente de credenciais.
- Permitir HTTP somente para loopback em laboratório; aplicar proteção SSRF e bloquear redirects cross-host.
- Não converter custo implicitamente entre moedas.
- Não executar ação irreversível no agente; produzir recomendação, SLA e plano segundo as políticas do Muster.
- Alterar contratos de API somente em `lib/api-spec/openapi.yaml`; regenerar clientes, nunca editar arquivos gerados manualmente.
- Dado fake, fixture e smoke externo real devem permanecer identificados.
- Não criar commits durante a execução sem autorização explícita do usuário.

## Review Focus

1. **URL privada ou maliciosa:** `baseUrl` não pode alcançar metadata cloud, IP privado não-loopback ou redirecionar para outro host; Task 2 fixa isso em testes.
2. **Evento atrasado, paginação e restart:** sobreposição do watermark não pode perder nem duplicar observations/scores; Task 5 cobre cursor, replay e checkpoint transacional.
3. **Projeto Langfuse compartilhado ou metadata cross-tenant:** registros com `muster.org_id` divergente devem ser rejeitados e contabilizados; Tasks 4 e 5 cobrem associação e isolamento.
4. **Scores não numéricos:** booleanos, categóricos, textuais e scores sem config não podem virar números silenciosamente; Task 4 cobre preservação e elegibilidade decisória.
5. **Rate limit, rotação e indisponibilidade prolongada:** o adapter deve aplicar backoff, preservar checkpoint e expor saúde degradada sem vazar segredos; Task 6 cobre esses estados.

---

### Task 1: Persistir estado de sincronização e evidência externa

**Files:**
- Modify: `lib/db/src/schema/index.ts`
- Create: `lib/db/drizzle/0021_langfuse_observability.sql`
- Create: `lib/db/drizzle/down/0021_langfuse_observability.sql`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/langfuse-migration.test.ts`
- Modify: `artifacts/api-server/src/lib/tenant-scope.ts`
- Modify: `artifacts/api-server/src/lib/tenant-scope.test.ts`

**Interfaces:**
- Consumes: tabelas existentes `connectors`, `organizations`, `agents`, `catalogMetrics` e helpers de tenancy.
- Produces: `connectorSyncStates`, `connectorMetricMappings`, `externalEvidenceRecords`, `ConnectorSyncStatus`, `ExternalEvidenceDataType` e índices tenant-scoped usados nas Tasks 4–7.

- [ ] **Step 1: Escrever o teste de migração que falha**

O teste `langfuse-migration.test.ts` deve exigir:

```ts
expect(migration).toContain('CREATE TABLE IF NOT EXISTS "connector_sync_states"');
expect(migration).toContain('CREATE TABLE IF NOT EXISTS "connector_metric_mappings"');
expect(migration).toContain('CREATE TABLE IF NOT EXISTS "external_evidence_records"');
expect(migration).toContain('connector_sync_states_due_idx');
expect(migration).toContain('external_evidence_records_dedupe_idx');
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/langfuse-migration.test.ts`  
Expected: FAIL porque a migration e os exports ainda não existem.

- [ ] **Step 3: Implementar as tabelas e tipos**

Definir:

```ts
type ConnectorSyncStatus = "idle" | "syncing" | "healthy" | "degraded" | "error";
type ExternalEvidenceDataType = "NUMERIC" | "BOOLEAN" | "CATEGORICAL" | "TEXT";
```

`connector_sync_states` deve ter `orgId`, `connectorId` único, status, intervalo, observation/score watermarks, cursor atual, lease owner/until, próxima execução, timestamps de início/sucesso/falha, falhas consecutivas, erro seguro e stats JSONB.

`connector_metric_mappings` deve ter `orgId`, `connectorId`, `sourceName`, `sourceDataType`, `targetMetricKey`, `categoryMap` JSONB, `enabled` e unique `(connectorId, sourceName)`.

`external_evidence_records` deve preservar source id/type, agent opcional, trace/observation/session ids, nome, tipo, valor numérico/textual/categórico, comentário, source/lineage JSONB, capturedAt e unique `(orgId, connectorId, sourceType, sourceId)`.

- [ ] **Step 4: Aplicar os novos exports ao tenant scope**

Adicionar as três tabelas à lista protegida de `tenant-scope.ts` e ao teste que comprova que toda tabela organizacional é conhecida.

- [ ] **Step 5: Executar testes da tarefa**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/langfuse-migration.test.ts src/lib/tenant-scope.test.ts`  
Expected: PASS.

- [ ] **Step 6: Verificar o diff da tarefa**

Run: `git diff --check -- lib/db/src/schema/index.ts lib/db/drizzle/0021_langfuse_observability.sql lib/db/drizzle/down/0021_langfuse_observability.sql artifacts/api-server/src/lib/connectors/langfuse/langfuse-migration.test.ts artifacts/api-server/src/lib/tenant-scope.ts artifacts/api-server/src/lib/tenant-scope.test.ts`  
Expected: saída vazia.

---

### Task 2: Criar credential bundle, política de URL e cliente Langfuse

**Files:**
- Create: `artifacts/api-server/src/lib/connectors/langfuse/credentials.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/credentials.test.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/url-policy.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/url-policy.test.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/client.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/client.test.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/types.ts`

**Interfaces:**
- Consumes: `encryptConnectorCredential` e `materializeConnectorCredentialForAdapter` permanecem responsáveis apenas pela cifra do payload serializado.
- Produces:

```ts
interface LangfuseCredentialBundleV1 {
  version: 1;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  environment?: string;
}

function serializeLangfuseCredentialBundle(input: LangfuseCredentialBundleV1): string;
function parseLangfuseCredentialBundle(raw: string): LangfuseCredentialBundleV1;
function normalizeLangfuseBaseUrl(raw: string, options?: { allowLoopbackHttp?: boolean }): URL;
function createLangfuseClient(input: LangfuseCredentialBundleV1, options?: { fetchImpl?: typeof fetch }): LangfuseClient;
```

`LangfuseClient` expõe `testConnection`, `listObservations`, `listScores` e `queryMetrics` com páginas tipadas.

- [ ] **Step 1: Escrever testes RED de credential bundle**

Cobrir round-trip v1, JSON inválido, versão desconhecida, campo vazio e garantia de que erros não incluam `secretKey`.

- [ ] **Step 2: Executar credential tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/credentials.test.ts`  
Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Implementar serialização e parsing estritos**

Usar validação explícita, mensagens seguras e nunca implementar `toString` que exponha o bundle.

- [ ] **Step 4: Escrever testes RED da política SSRF**

Cobrir HTTPS público válido, Cloud oficial, loopback HTTP permitido no laboratório, HTTP público recusado, credenciais na URL recusadas, metadata IP `169.254.169.254`, IPv4/IPv6 privado não-loopback e redirect cross-host recusado pelo cliente.

- [ ] **Step 5: Executar URL tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/url-policy.test.ts`  
Expected: FAIL.

- [ ] **Step 6: Implementar a política de URL**

Normalizar sem trailing slash, validar protocolo/host antes de qualquer fetch e usar `redirect: "manual"`.

- [ ] **Step 7: Escrever testes RED do cliente HTTP**

Cobrir Basic Auth `publicKey:secretKey`, janelas obrigatórias nas observations, field groups fixos, cursor, Scores v3, Metrics v2, timeout, 401, 429 com `Retry-After`, 5xx, JSON inválido e ausência de `input/output` na query.

- [ ] **Step 8: Executar client tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/client.test.ts`  
Expected: FAIL.

- [ ] **Step 9: Implementar o cliente com `fetch` nativo**

Não adicionar SDK Langfuse ao backend. Usar AbortSignal para timeout, respostas tipadas mínimas e `LangfuseApiError` com `status`, `retryAfterMs`, `category` e mensagem redigida.

- [ ] **Step 10: Executar todos os testes da tarefa**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/credentials.test.ts src/lib/connectors/langfuse/url-policy.test.ts src/lib/connectors/langfuse/client.test.ts`  
Expected: PASS.

---

### Task 3: Registrar adapter nativo e executar discovery seguro

**Files:**
- Create: `artifacts/api-server/src/lib/connectors/langfuse/adapter.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/adapter.test.ts`
- Modify: `artifacts/api-server/src/lib/connectors/registry.ts`
- Modify: `artifacts/api-server/src/lib/connectors/capabilities.ts`
- Modify: `artifacts/api-server/src/lib/connectors/types.ts`
- Modify: `artifacts/api-server/src/lib/connectors/redaction.ts`
- Modify: `artifacts/api-server/src/lib/connectors/redaction.test.ts`

**Interfaces:**
- Consumes: `LangfuseClient`, `parseLangfuseCredentialBundle` e `ConnectorImpl`.
- Produces: `langfuseConnector: ConnectorImpl`, capability `platform: "langfuse"`, mode `live` e candidatos agrupados somente por `muster.agent_external_id`.

- [ ] **Step 1: Escrever testes RED do adapter**

Cobrir teste válido com projeto vazio, autenticação recusada, Langfuse incompatível, discovery por metadata explícita, trace sem external id ignorado com warning, agrupamento de releases/modelos e ausência de prompt/output nos candidatos.

- [ ] **Step 2: Executar adapter tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/adapter.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Estender a SPI sem quebrar GitHub**

Adicionar a `ConnectorTestResult` campos opcionais `details` e `warnings`; manter `ConnectorCredential.token` como payload cifrado materializado para compatibilidade.

- [ ] **Step 4: Implementar `langfuseConnector`**

`testConnection` consulta uma janela de um minuto com limite 1. `discoverAgents` consulta root observations dos últimos sete dias, agrupa por external id e retorna confiança baseada em metadata completa, volume e release observada.

- [ ] **Step 5: Registrar capability live**

Adicionar `Langfuse` com `testConnection`, `discoverAgents`, `collectTelemetry` e `collectMetrics`; transportes `Public API v2/v3`, `OpenTelemetry` e `polling`.

- [ ] **Step 6: Fortalecer redaction**

Garantir remoção de Basic Auth, `publicKey`, `secretKey`, credential bundle e parâmetros sensíveis de URL em logs e erros.

- [ ] **Step 7: Executar testes da tarefa e regressão do GitHub**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/adapter.test.ts src/lib/connectors/redaction.test.ts src/lib/connectors/import-source.test.ts`  
Expected: PASS.

---

### Task 4: Normalizar observations e scores em evidência Muster

**Files:**
- Create: `artifacts/api-server/src/lib/connectors/langfuse/normalization.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/normalization.test.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/score-mapping.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/score-mapping.test.ts`

**Interfaces:**
- Consumes: tipos `LangfuseObservation`, `LangfuseScore`, mappings persistidos e contrato `ExternalAgentEnvelope`.
- Produces:

```ts
type LangfuseNormalizedObservation =
  | { status: "mapped"; eventId: string; externalId: string; envelope: ExternalAgentEnvelope }
  | { status: "unmapped" | "rejected"; reason: string; sourceId: string };

type LangfuseNormalizedScore = {
  evidenceRecord: ExternalEvidenceRecordInput;
  metricObservation?: ExternalObservationInput;
};

function normalizeLangfuseObservation(input: NormalizeObservationInput): LangfuseNormalizedObservation;
function normalizeLangfuseScore(input: NormalizeScoreInput): LangfuseNormalizedScore;
```

- [ ] **Step 1: Escrever testes RED de observations**

Cobrir sucesso, erro, duração, tokens, metadata allowlist, moeda original, `org_id` divergente rejeitado, agent external id ausente não mapeado, trace/release preservados e input/output descartados mesmo se a fixture os contiver.

- [ ] **Step 2: Executar observation tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/normalization.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implementar normalização de observation**

Usar event id `langfuse:observation:<observationId>`. Custo deve virar observação `llm_cost_<currency>`; somente tokens e duração entram no evento de execução. Não preencher `costCents` sem política cambial explícita.

- [ ] **Step 4: Escrever testes RED de scores**

Cobrir numeric, boolean, categorical com e sem mapping, text, config ausente, comentário, score ligado a trace/observation/session e score de outro tenant.

- [ ] **Step 5: Executar score tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/score-mapping.test.ts`  
Expected: FAIL.

- [ ] **Step 6: Implementar preservação e elegibilidade**

Numeric e boolean geram `metricObservation`. Categorical só gera métrica quando `categoryMap` contém a categoria. Text e categorical não mapeado geram apenas `externalEvidenceRecord`, com `decisionEligible=false` em metadata de source.

- [ ] **Step 7: Executar todos os testes da tarefa**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/normalization.test.ts src/lib/connectors/langfuse/score-mapping.test.ts`  
Expected: PASS.

---

### Task 5: Extrair materialização compartilhada e construir sync transacional

**Files:**
- Create: `artifacts/api-server/src/lib/connectors/materialize-envelope.ts`
- Create: `artifacts/api-server/src/lib/connectors/materialize-envelope.test.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/sync.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/sync.test.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/sync.integration.test.ts`
- Modify: `artifacts/api-server/src/routes/telemetry.ts`
- Modify: `artifacts/api-server/src/lib/connector-ingestion.integration.test.ts`

**Interfaces:**
- Consumes: normalizadores da Task 4, tabelas da Task 1, cliente da Task 2, outbox e correlação `agentConnectorLinks`.
- Produces:

```ts
function materializeExternalAgentEnvelope(input: MaterializeEnvelopeInput): Promise<ExternalAgentIngestionResult>;

interface LangfuseSyncResult {
  connectorId: string;
  startedAt: string;
  completedAt: string;
  observationsRead: number;
  scoresRead: number;
  materialized: number;
  deduplicated: number;
  unmapped: number;
  rejected: number;
  warnings: string[];
}

function runLangfuseSync(input: RunLangfuseSyncInput): Promise<LangfuseSyncResult>;
```

- [ ] **Step 1: Escrever teste RED da materialização reutilizável**

O teste deve exigir que a função produza a mesma execução, evidência, receipt e outbox que a rota universal produz hoje, sem chamada HTTP interna.

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/materialize-envelope.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Extrair a lógica da rota**

Mover a transação de `POST /integrations/agent-events` para `materializeExternalAgentEnvelope`; manter respostas HTTP e comportamento existentes usando o retorno tipado.

- [ ] **Step 4: Executar regressão da ingestão universal**

Run: `RUN_CONNECTOR_INGESTION_DB_TESTS=true pnpm --dir artifacts/api-server exec vitest run src/lib/connector-ingestion.integration.test.ts`  
Expected: PASS com PostgreSQL disponível; se indisponível, registrar o bloqueio e não declarar o gate concluído.

- [ ] **Step 5: Escrever testes RED do sync**

Cobrir paginação por cursor, watermark com sobreposição de 60 s, observations atrasadas, scores em página separada, dedupe após replay, unmapped, tenant mismatch, checkpoint somente após persistência, erro no meio da página e restart usando o mesmo checkpoint.

- [ ] **Step 6: Executar sync tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/sync.test.ts`  
Expected: FAIL.

- [ ] **Step 7: Implementar `runLangfuseSync`**

Consultar observations e scores em janelas delimitadas, materializar por agente, preservar evidência não numérica, reconciliar contagens por Metrics API e atualizar stats/checkpoint na mesma unidade de consistência definida no spec.

- [ ] **Step 8: Escrever integração PostgreSQL**

Testar dois tenants, replay, falha/restart, receipt único, external evidence único, outbox criado e checkpoint não avançado em rollback.

- [ ] **Step 9: Executar testes da tarefa**

Run: `RUN_LANGFUSE_DB_TESTS=true pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/sync.integration.test.ts`  
Expected: PASS com PostgreSQL real.

---

### Task 6: Expor API e worker contínuo com saúde operacional

**Files:**
- Create: `artifacts/api-server/src/lib/connectors/langfuse/worker-config.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/worker-config.test.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/worker.ts`
- Create: `artifacts/api-server/src/lib/connectors/langfuse/worker.test.ts`
- Modify: `artifacts/api-server/src/routes/connectors.ts`
- Modify: `artifacts/api-server/src/routes/health.ts`
- Modify: `artifacts/api-server/src/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Generated: `lib/api-zod/src/generated/api.ts`
- Generated: `lib/api-zod/src/generated/types/*langfuse*.ts`
- Generated: `lib/api-client-react/src/generated/api.ts`
- Generated: `lib/api-client-react/src/generated/types/*langfuse*.ts`

**Interfaces:**
- Consumes: `runLangfuseSync`, credential bundle, tabelas de sync/mapping e RBAC de administrador.
- Produces:

```ts
function langfuseSyncWorkerConfig(env?: NodeJS.ProcessEnv): LangfuseSyncWorkerConfig;
function runLangfuseSyncCycle(config: LangfuseSyncWorkerConfig): Promise<LangfuseWorkerCycleResult>;
function startLangfuseSyncWorker(config?: LangfuseSyncWorkerConfig): () => void;
function getLangfuseSyncWorkerDiagnostics(): LangfuseSyncWorkerDiagnostics;
```

Novas operações OpenAPI:

```text
POST /connectors/langfuse/register
POST /connectors/{connectorId}/sync
GET  /connectors/{connectorId}/sync-status
PUT  /connectors/{connectorId}/metric-mappings
```

- [ ] **Step 1: Escrever testes RED de configuração do worker**

Exigir disabled por padrão em teste, intervalo mínimo 15 s, padrão 30 s, timeout, batch size e lease duration coerente.

- [ ] **Step 2: Executar config tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/worker-config.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implementar configuração e diagnostics**

Variáveis: `LANGFUSE_SYNC_WORKER_ENABLED`, `LANGFUSE_SYNC_INTERVAL_MS`, `LANGFUSE_SYNC_BATCH_SIZE`, `LANGFUSE_SYNC_LEASE_MS` e `LANGFUSE_SYNC_TIMEOUT_MS`.

- [ ] **Step 4: Escrever testes RED do worker**

Cobrir claim exclusivo, lease expirado, sucesso, 429 com Retry-After, backoff exponencial com jitter injetável, credencial rotacionada, circuit breaker, checkpoint preservado e health degradado após falhas consecutivas.

- [ ] **Step 5: Executar worker tests e confirmar RED**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/worker.test.ts`  
Expected: FAIL.

- [ ] **Step 6: Implementar worker e startup**

Usar claim PostgreSQL seguro para múltiplas instâncias. `startLangfuseSyncWorker` retorna função de shutdown e é iniciado em `index.ts` após migrations.

- [ ] **Step 7: Escrever contratos OpenAPI e regenerar clientes**

Schemas obrigatórios: `RegisterLangfuseConnectorInput`, `LangfuseConnectorRegistration`, `LangfuseSyncStatus`, `LangfuseSyncResult`, `LangfuseMetricMappingInput` e resposta de mapping.

Run: `pnpm --dir lib/api-spec codegen`  
Expected: Orval conclui e `typecheck:libs` passa.

- [ ] **Step 8: Implementar rotas autenticadas**

Registro e mappings exigem `requireOrgAdmin`; sync manual também. Status exige usuário da organização. Registro cifra o bundle, executa teste real e cria `connector_sync_states`.

- [ ] **Step 9: Integrar health endpoint**

`/healthz/worker` deve incluir worker Langfuse, fila vencida, sync mais antigo e falhas sem incluir segredos.

- [ ] **Step 10: Executar testes da tarefa**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/worker-config.test.ts src/lib/connectors/langfuse/worker.test.ts src/lib/connectors/langfuse/adapter.test.ts`  
Expected: PASS.

---

### Task 7: Entregar configuração e operação Langfuse na interface

**Files:**
- Create: `artifacts/cohort/src/components/connectors/langfuse-connector-dialog.tsx`
- Create: `artifacts/cohort/src/components/connectors/langfuse-sync-panel.tsx`
- Create: `artifacts/cohort/src/components/connectors/langfuse-score-mapping-panel.tsx`
- Create: `artifacts/cohort/src/lib/langfuse-connector-model.ts`
- Create: `artifacts/cohort/src/lib/langfuse-connector-model.test.ts`
- Modify: `artifacts/cohort/src/pages/connectors-workforce.tsx`
- Modify: `artifacts/cohort/src/components/platform-badge.tsx`
- Modify: `artifacts/cohort/src/lib/connector-operating-model.ts`
- Modify: `artifacts/cohort/src/lib/connector-operating-model.test.ts`

**Interfaces:**
- Consumes: hooks Orval das quatro operações da Task 6 e tipos `LangfuseSyncStatus`/`LangfuseMetricMapping`.
- Produces: fluxo visual completo Cloud/self-hosted → teste → discovery → mapping → primeiro sync → status/freshness → admissão/visão do profissional.

- [ ] **Step 1: Escrever testes RED do modelo de apresentação**

Cobrir estados `configured`, `syncing`, `healthy`, `degraded`, `error`, projeto vazio, trace não mapeado, freshness vencida, segredo nunca devolvido e próxima ação objetiva.

- [ ] **Step 2: Executar teste e confirmar RED**

Run: `pnpm --dir artifacts/cohort exec node --import tsx --test src/lib/langfuse-connector-model.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implementar modelo puro de UI**

Criar `langfuseConnectorPresentation(status, now)` e `langfuseNextAction(status)` sem acessar React ou browser.

- [ ] **Step 4: Implementar diálogo de registro**

Campos: modo Cloud/self-hosted, URL, public key, secret key, environment e intervalo. Secret nunca reaparece. Exibir aviso de privacidade e freshness de 15–30 s.

- [ ] **Step 5: Implementar painel operacional**

Exibir último sucesso, próxima execução, duração, observations/scores lidos, materializados, deduplicados, não mapeados, rejeitados, falhas consecutivas e botão `Sincronizar agora`.

- [ ] **Step 6: Implementar score mapping**

Listar scores descobertos, tipo, cobertura e destino no catálogo. Numeric/boolean podem ser habilitados diretamente; categorical exige category map; text fica apenas como evidência.

- [ ] **Step 7: Integrar na Central de Conectores**

Langfuse aparece como adapter nativo premium, não como contrato universal. Discovery deve continuar para admissão; sync sem agente mapeado mostra diagnóstico em vez de sucesso falso.

- [ ] **Step 8: Executar testes e typecheck da interface**

Run: `pnpm --filter @workspace/muster test && pnpm --filter @workspace/muster typecheck`  
Expected: PASS.

---

### Task 8: Criar laboratório reproduzível e E2E decisório

**Files:**
- Create: `scripts/src/langfuse-fixture-server.ts`
- Create: `scripts/src/langfuse-fixture-server.test.ts`
- Create: `scripts/src/langfuse-capability-scenario.ts`
- Create: `scripts/src/langfuse-capability-scenario.test.ts`
- Modify: `scripts/package.json`
- Modify: `artifacts/cohort/e2e/authenticated.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: endpoints e UI das Tasks 6–7.
- Produces: scripts `demo:langfuse`, `validate:langfuse` e cenário com dados explicitamente `fixture`; smoke real opcional usa `LANGFUSE_LIVE_*`.

- [ ] **Step 1: Escrever testes RED do servidor fixture**

Exigir paginação v2/v3, Basic Auth, duas releases, dois agentes, sucesso, erro, escalonamento, tool call, três tipos de score, um trace não mapeado e rate limit configurável.

- [ ] **Step 2: Executar fixture tests e confirmar RED**

Run: `pnpm --dir scripts exec vitest run src/langfuse-fixture-server.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implementar servidor Langfuse fake determinístico**

Implementar somente os endpoints públicos necessários; marcar toda resposta com metadata `muster.data_classification=fixture`.

- [ ] **Step 4: Escrever teste RED do cenário de capacidade**

O cenário deve configurar o conector, sincronizar duas vezes, provar dedupe, detectar regressão da release 2, produzir recomendação e retornar relatório JSON com contagens e freshness.

- [ ] **Step 5: Executar cenário test e confirmar RED**

Run: `pnpm --dir scripts exec vitest run src/langfuse-capability-scenario.test.ts`  
Expected: FAIL.

- [ ] **Step 6: Implementar cenário e scripts raiz**

Adicionar `demo:langfuse` e `validate:langfuse`. O modo live só executa com `LANGFUSE_LIVE_BASE_URL`, `LANGFUSE_LIVE_PUBLIC_KEY` e `LANGFUSE_LIVE_SECRET_KEY`; ausência deve resultar em `SKIPPED`, não aprovação falsa.

- [ ] **Step 7: Adicionar E2E autenticado**

No Playwright, configurar Langfuse fixture, visualizar discovery, mapear score, sincronizar, abrir profissional, confirmar origem/freshness, abrir recomendação e registrar decisão/plano.

- [ ] **Step 8: Executar E2E específico**

Run: `pnpm --filter @workspace/muster test:e2e:authenticated:reuse --grep "Langfuse"`  
Expected: PASS com sessão Clerk e serviços locais preparados; caso contrário registrar exatamente o pré-requisito ausente.

---

### Task 9: Validar capacidade, documentação e gates de release

**Files:**
- Modify: `docs/INTEGRACAO-PLATAFORMAS-EXTERNAS.md`
- Modify: `docs/GAUNTLET-OPERACIONAL.md`
- Modify: `docs/MATURITY-EVALUATOR.md`
- Modify: `.env.example`
- Create: `docs/LANGFUSE-INTEGRATION.md`
- Create: `output/langfuse/.gitkeep`

**Interfaces:**
- Consumes: feature vertical concluída nas Tasks 1–8.
- Produces: runbook, configuração Cloud/self-hosted, contrato de metadata, troubleshooting, relatório de capacidade e evidência para Mara/Gauntlet.

- [ ] **Step 1: Documentar operação e segurança**

Incluir configuração, atributos obrigatórios, score mapping, política de dados, worker, status, recuperação, rotação, retenção independente, live smoke e limites de near-real-time.

- [ ] **Step 2: Executar cenário de dez mil observations**

Run: `pnpm run validate:langfuse -- --observations=10000 --agents=20 --replay=2`  
Expected: zero perda, zero duplicação, checkpoint consistente, relatório em `output/langfuse/<timestamp>/report.json` com throughput, duração, memória, freshness e contagens.

- [ ] **Step 3: Executar validações específicas**

Run: `pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse src/lib/connectors/materialize-envelope.test.ts`  
Expected: PASS.

Run: `RUN_LANGFUSE_DB_TESTS=true pnpm --dir artifacts/api-server exec vitest run src/lib/connectors/langfuse/sync.integration.test.ts`  
Expected: PASS.

- [ ] **Step 4: Executar pirâmide completa**

Run: `pnpm run typecheck`  
Expected: PASS.

Run: `pnpm test`  
Expected: PASS; integrações PostgreSQL podem continuar skipped no comando unitário, mas devem ter passado no Step 3.

Run: `pnpm run build`  
Expected: PASS; registrar tamanho do bundle e warnings.

- [ ] **Step 5: Executar E2E autenticado e regressão pública**

Run: `pnpm --filter @workspace/muster test:e2e:authenticated:reuse --grep "Langfuse|conectores|admissão|decisão"`  
Expected: PASS.

Run: `pnpm --filter @workspace/muster test:e2e:public`  
Expected: PASS.

- [ ] **Step 6: Executar smoke externo quando autorizado**

Run: `pnpm run validate:langfuse -- --live`  
Expected: PASS somente com credenciais reais; caso ausentes, `SKIPPED` explicitamente e a feature permanece comprovada apenas contra contrato/fixture.

- [ ] **Step 7: Reexecutar avaliador de maturidade**

Run: `pnpm run evaluate:maturity -- --mode=full --base-url=http://127.0.0.1:5174`  
Expected: relatório com conector real ou fixture claramente identificado; Langfuse não remove os gates independentes de soak 24 h, backup/restore, release smoke e piloto externo.

- [ ] **Step 8: Revisar diff final sem declarar além da evidência**

Run: `git diff --check`  
Expected: saída vazia.

Confirmar no relatório final:

- o que foi comprovado por testes determinísticos;
- o que foi comprovado contra Langfuse real;
- o que continua pendente para produção;
- quais credenciais ou ações do usuário ainda são necessárias.

