# Roteiro completo de validação do MVP

## Pré-requisitos

- Docker Desktop ativo.
- Postgres local do projeto ativo na porta `5433`.
- API local em `8080` com `AUTH_DEV_BYPASS=true`.
- Frontend em `5173`.

## 1. Smoke test do ambiente

```bash
curl http://localhost:8080/api/healthz
curl -I http://localhost:8080/
curl -I http://localhost:5173/
```

Esperado: API `{"status":"ok"}`, redirecionamento de `8080` para `5173` e frontend `200`.

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
  -H 'content-type: application/json' \
  -d '{"runtime":"docker","version":"1.0.0","intervalSeconds":30,"status":"healthy"}'

curl http://localhost:8080/api/agents/<AGENT_ID>/supervision
```

Esperado: `status=live`, `isStale=false` e `ageSeconds` próximo de zero.

### Runner

O `@workspace/telemetry-reporter` expõe `startHeartbeat()`. O runner LangChain inicia o heartbeat com intervalo configurável:

```bash
MUSTER_HEARTBEAT_INTERVAL_SECONDS=30 \
MUSTER_EXECUTION_BACKEND=local \
AGENT_MODE=dry-run \
pnpm --filter @workspace/agent-runner start
```

Critério: runtime vivo aparece como `live`; após mais de 3 intervalos sem sinal, aparece como `stale`.

## 6. Telemetria e avaliação

```bash
curl -X POST http://localhost:8080/api/agents/<AGENT_ID>/events \
  -H 'content-type: application/json' \
  -d '{"kind":"execution","durationMs":840,"costCents":3,"tokensIn":120,"tokensOut":80,"success":true}'

curl -X POST http://localhost:8080/api/agents/<AGENT_ID>/reevaluate \
  -H 'content-type: application/json' -d '{}'

curl 'http://localhost:8080/api/agents/<AGENT_ID>/telemetry/30d'
curl 'http://localhost:8080/api/evidence?agentId=<AGENT_ID>'
```

Critérios:

- `dataSource=telemetry` quando há eventos reais.
- Evidências contêm fonte, linhagem, confiança e tamanho da amostra.
- Menos de 20 execuções mantém o agente em observação.
- Segunda reavaliação não duplica evidências nem altera a decisão sem novos dados.

## 7. Simulação de cenários

```bash
pnpm --filter @workspace/scripts run simulate-telemetry -- --days=30 --base-url=http://localhost:8080
```

Validar três perfis: saudável, degradando e errático. Comparar score, camada governança, custo, latência, erro, escalonamento e veredito.

## 8. Comando automatizado

```bash
pnpm --filter @workspace/scripts run validate-mvp
```

Esse comando valida heartbeat, freshness, evento, reavaliação, persistência de evidência e idempotência.

## 9. Pendências para produção

- Worker agendado para reavaliar agentes sem depender de clique na interface.
- Alertas automáticos quando heartbeat ficar stale ou um KPI cruzar guardrail.
- Coleta passiva de provedores/cloud e OpenTelemetry/OpenInference.
- Spans de tool calls, retrieval, prompt/model version e resultado de cada etapa.
- Avaliadores configuráveis para correctness, faithfulness, tool selection, segurança e revisão humana.
- Política de retenção, custo de avaliação e amostragem para avaliações caras.
- Teste de carga, falha de rede, duplicidade, replay e recuperação do coletor.

O MVP está apto para validação operacional local; ainda não deve ser descrito como supervisão garantida “100% do tempo” em produção sem esses controles de disponibilidade, retenção e alertas.
