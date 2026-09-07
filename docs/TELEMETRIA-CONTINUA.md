# Telemetria contínua e outbox

## Objetivo

O fluxo contínuo transforma eventos de execução em métricas, evidências e
decisão sem exigir `POST /api/agents/:agentId/reevaluate` manual. A ingestão
continua rápida e a avaliação acontece fora da requisição:

```text
agente/conector
  → agent_events + event_outbox (uma transação)
  → worker SKIP LOCKED
  → reavaliação tenant-scoped
  → agent.evaluation.projected
  → polling/SSE para a UI
```

Heartbeat atualiza a leitura de supervisão, porém não abre trabalho de
avaliação. Apenas `execution`, `error`, `escalation` e `feedback` produzem uma
entrada pendente no outbox.

## Migration

A migration `0013_continuous_telemetry_outbox.sql` cria `event_outbox` com:

- `org_id` obrigatório e FK para a organização;
- aggregate, tipo, payload e prioridade;
- disponibilidade, tentativas, erro e timestamps;
- estados `pending`, `processing`, `completed` e `dead-letter`;
- índices para claim, atividade por tenant e histórico por aggregate.

Aplicação local:

```bash
pnpm --filter @workspace/db run migrate
```

## Worker

O worker inicia dentro da API por padrão e pode ser desabilitado com:

```dotenv
CONTINUOUS_TELEMETRY_WORKER_ENABLED=false
```

Configuração padrão:

```dotenv
CONTINUOUS_TELEMETRY_POLL_MS=1000
CONTINUOUS_TELEMETRY_BATCH_SIZE=20
CONTINUOUS_TELEMETRY_MAX_ATTEMPTS=5
CONTINUOUS_TELEMETRY_RETRY_BASE_MS=1000
CONTINUOUS_TELEMETRY_RETRY_MAX_MS=300000
CONTINUOUS_TELEMETRY_PROCESSING_TIMEOUT_MS=60000
```

O claim é atômico com `FOR UPDATE SKIP LOCKED`. Um advisory lock derivado de
`org_id + agent_id` impede duas instâncias cooperantes de projetarem o mesmo
agente simultaneamente. Falhas usam backoff exponencial limitado; após o máximo
de tentativas o evento vai para `dead-letter`. Linhas abandonadas em
`processing` são recuperadas pelo timeout.

O debounce é orientado ao evento:

| Evento | Debounce | Prioridade |
|---|---:|---|
| error | 0 s | critical |
| escalation | 0 s | high |
| feedback | 1 s | high |
| execution | 5 s | normal |
| heartbeat | não avalia | low |

Eventos do mesmo agente existentes antes do início da projeção são
coalescidos. Eventos gravados durante ou depois da projeção permanecem
pendentes para o ciclo seguinte.

## Atividade para UI

### Polling

```http
GET /api/telemetry/activity?limit=50
GET /api/telemetry/activity?after=<event-id>&limit=50
```

O endpoint exige sessão e organização ativa. O cursor somente é resolvido
dentro do tenant atual. A resposta inclui `nextCursor` e uma política de
freshness.

### SSE durável

```http
GET /api/telemetry/activity/stream
Last-Event-ID: <event-id>
```

Também é possível usar `?after=<event-id>`. Cada mensagem usa o ID persistido
do outbox como `id:` do SSE. Ao reconectar, o navegador envia `Last-Event-ID` e
o servidor retoma depois desse registro. Sem cursor, a conexão entrega a janela
recente inicial. Keep-alive é enviado a cada 15 segundos.

SSE deve usar sessão por cookie e mesma origem, porque `EventSource` nativo não
permite configurar um bearer header arbitrário. Em topologias com proxy,
desabilite buffering para `text/event-stream`.

## Freshness

Com os defaults, a meta operacional é:

- erros e escalonamentos: projeção normalmente em 1–3 segundos;
- feedback: normalmente em até 4 segundos;
- execuções normais: normalmente em até 10 segundos;
- atividade da UI: polling recomendado de 2 segundos ou SSE contínuo.

Esses valores são metas, não garantias. Backlog, locks, banco degradado e retry
aparecem em:

```http
GET /api/healthz/worker
```

O diagnóstico é global e não retorna IDs, payloads ou contagens por tenant.

## Operação multi-instância

O desenho suporta múltiplas APIs/workers no mesmo PostgreSQL:

- `SKIP LOCKED` impede claim duplicado da mesma linha;
- advisory lock serializa avaliações por tenant/agente;
- toda mutação usa `id + org_id`;
- o resultado de projeção é persistido como evento já concluído e não volta à
  fila, evitando loop infinito.

Limitações atuais:

- polling PostgreSQL não substitui um broker em throughput muito alto;
- o SSE faz polling por conexão e deve ganhar fan-out dedicado antes de dezenas
  de milhares de conexões simultâneas;
- advisory locks dependem de todas as instâncias usarem este worker; processos
  externos que alterem projeções diretamente não participam da coordenação;
- delivery é `at-least-once`: uma falha entre projeção e conclusão pode repetir
  uma avaliação, que é determinística e tenant-scoped;
- limpeza/arquivamento do outbox ainda precisa de uma política de retenção antes
  de produção de longo prazo.

Próxima evolução quando volume justificar: processo de worker separado,
`LISTEN/NOTIFY` apenas como wake-up, particionamento/retenção e fan-out SSE por
Redis/NATS/Kafka sem alterar o contrato de domínio.

## Validação PostgreSQL

Além da suíte pura, a integração pode ser habilitada contra uma base migrada:

```bash
RUN_CONTINUOUS_TELEMETRY_DB_TESTS=true \
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/muster \
pnpm --filter @workspace/api-server test -- continuous-telemetry.integration
```
