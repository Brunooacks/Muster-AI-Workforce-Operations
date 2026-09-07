# Roteiro completo de validação do MVP

## Pré-requisitos

- Docker Desktop ativo.
- Postgres local do projeto ativo na porta `5433`.
- Projeto Clerk configurado na API e no frontend.
- Usuário Clerk vinculado a uma organização Clerk ativa; o bootstrap cria ou
  atualiza o tenant e o vínculo internos sem aceitar um `orgId` arbitrário.
- `MUSTER_CREDENTIAL_ENCRYPTION_KEY` configurada para registrar conectores com
  segredo.
- `MUSTER_AUTH_TOKEN` contendo um token de sessão Clerk válido para comandos administrativos.
- `MUSTER_AGENT_API_KEY` contendo a chave do agente usado na ingestão.
- API local em `8080`.
- Frontend em `5173`.

## 1. Smoke test do ambiente

```bash
curl http://localhost:8080/api/healthz
curl -I http://localhost:8080/
curl -I http://localhost:5173/
curl -i http://localhost:8080/api/agents
```

Esperado: API `{"status":"ok"}`, redirecionamento de `8080` para `5173`,
frontend `200` e `GET /api/agents` anônimo respondendo `401`.

## 2. Censo e discovery

1. Abrir `/conectores`.
2. Conectar GitHub ou usar uma fonte de teste.
3. Rodar discovery.
4. Conferir agente, papel, plataforma, sinais e métricas propostas.
5. Admitir somente após revisão humana dos campos de confiança.

Critério: nenhum agente entra na frota sem identidade, owner, propósito e limites revisados.

## 3. Escolha de métricas

1. Abrir `/metricas`.
2. Escolher um dos kits em `GET /api/catalog/metric-kits`.
3. Começar com no máximo 5–7 KPIs.
4. Confirmar fórmula, meta, direção, owner, cadência, baseline e guardrail.
5. Criar métricas customizadas apenas quando o catálogo não cobrir o outcome.

Critério: cada KPI deve ser mensurável, ter fonte e declarar como altera o veredito.

## 4. Time misto e decisão

1. Abrir `/equipes`.
2. Criar propósito e outcome esperado.
3. Criar o time misto.
4. Associar owner, supervisor, operador, observador e agentes.
5. Conferir que apenas owner/supervisor alteram o contexto decisório.

Critério: toda decisão precisa ter responsável humano identificável.

## 5. Supervisão contínua

### Heartbeat manual

```bash
curl -X POST http://localhost:8080/api/agents/<AGENT_ID>/heartbeat \
  -H "Authorization: Bearer $MUSTER_AGENT_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"runtime":"docker","version":"1.0.0","intervalSeconds":30,"status":"healthy"}'

curl http://localhost:8080/api/agents/<AGENT_ID>/supervision \
  -H "Authorization: Bearer $MUSTER_AUTH_TOKEN"
```

Esperado: `status=live`, `isStale=false` e `ageSeconds` próximo de zero.

### Runner

O `@workspace/telemetry-reporter` expõe `startHeartbeat()`. O runner LangChain inicia o heartbeat com intervalo configurável:

```bash
MUSTER_HEARTBEAT_INTERVAL_SECONDS=30 \
MUSTER_AGENT_ID=<AGENT_ID> \
MUSTER_AUTH_TOKEN="$MUSTER_AGENT_API_KEY" \
MUSTER_EXECUTION_BACKEND=local \
AGENT_MODE=dry-run \
pnpm --filter @workspace/agent-runner start
```

Critério: runtime vivo aparece como `live`; após mais de 3 intervalos sem sinal, aparece como `stale`.

## 6. Telemetria e avaliação contínua

```bash
curl -X POST http://localhost:8080/api/agents/<AGENT_ID>/events \
  -H "Authorization: Bearer $MUSTER_AGENT_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"kind":"execution","durationMs":840,"costCents":3,"tokensIn":120,"tokensOut":80,"success":true}'

curl 'http://localhost:8080/api/agents/<AGENT_ID>/telemetry/30d' \
  -H "Authorization: Bearer $MUSTER_AUTH_TOKEN"
curl 'http://localhost:8080/api/evidence?agentId=<AGENT_ID>' \
  -H "Authorization: Bearer $MUSTER_AUTH_TOKEN"
curl 'http://localhost:8080/api/telemetry/activity?limit=20' \
  -H "Authorization: Bearer $MUSTER_AUTH_TOKEN"
curl http://localhost:8080/api/healthz/worker
```

Critérios:

- `dataSource=telemetry` quando há eventos reais.
- Evidências contêm fonte, linhagem, confiança e tamanho da amostra.
- Menos de 20 execuções mantém o agente em observação.
- Segunda reavaliação não duplica evidências nem altera a decisão sem novos dados.
- Evento de execução abre item no outbox e produz
  `agent.evaluation.projected` normalmente em até 10 segundos.
- Fila sem `dead-letter`, worker ativo e idade do item pendente dentro da meta.

`POST /api/agents/<AGENT_ID>/reevaluate` continua disponível como recuperação
manual e diagnóstico, mas não é necessário no fluxo normal.

## 7. Simulação de cenários

```bash
MUSTER_AUTH_TOKEN="$MUSTER_AUTH_TOKEN" \
pnpm --filter @workspace/scripts run simulate-telemetry -- --days=30 --base-url=http://localhost:8080
```

Validar três perfis: saudável, degradando e errático. Comparar score, camada governança, custo, latência, erro, escalonamento e veredito.

## 8. Comando automatizado

```bash
pnpm --filter @workspace/scripts run validate-mvp
```

Esse comando valida heartbeat, freshness, evento, reavaliação, persistência de evidência e idempotência.

## 9. E2E Clerk e browser

- A suíte Playwright cobre landing, entrada real, bloqueio anônimo, catálogo de
  rotas em desktop/mobile e 28 fluxos autenticados com efeitos na API.
- Defina `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `E2E_CLERK_USER_EMAIL` e `E2E_CLERK_ORG_NAME` em uma instância Clerk de teste.
- O setup cria ou reutiliza uma organização isolada, ativa o tenant, limpa dados
  residuais e cria agentes determinísticos. Ausência de credencial é falha, não
  skip.
- Com PostgreSQL, API e frontend disponíveis, execute o gate autenticado:

```bash
pnpm --filter @workspace/muster run test:e2e:authenticated
```

- Execute também os casos públicos em desktop e mobile:

```bash
pnpm run test:e2e
```

- Para o gate completo — build, unitários, integrações PostgreSQL e browser —
  execute:

```bash
pnpm run validate:gauntlet
```

- Segredos e artefatos em `artifacts/cohort/playwright/.clerk/` devem permanecer
  protegidos no CI e nunca entrar no repositório.

## 10. Pendências para escala de produção

- Separar o worker da API quando o volume exigir escalabilidade independente.
- Alertas automáticos quando heartbeat ficar stale, o backlog exceder a meta ou
  um KPI cruzar guardrail.
- Coleta passiva de provedores/cloud e OpenTelemetry/OpenInference.
- Spans de tool calls, retrieval, prompt/model version e resultado de cada etapa.
- Avaliadores configuráveis para correctness, faithfulness, tool selection, segurança e revisão humana.
- Política de retenção, custo de avaliação e amostragem para avaliações caras.
- Teste de carga, falha de rede, duplicidade, replay e recuperação do coletor.
- RLS no PostgreSQL após adotar transação request-scoped e role sem `BYPASSRLS`.
- Fan-out dedicado para SSE e broker quando polling PostgreSQL deixar de atender
  ao throughput observado.

O MVP está apto para validação operacional local; ainda não deve ser descrito como supervisão garantida “100% do tempo” em produção sem esses controles de disponibilidade, retenção e alertas.
