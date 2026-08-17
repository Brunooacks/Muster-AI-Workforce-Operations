# Integração de plataformas externas

## Objetivo

O Muster não deve depender da implementação interna de Zendesk, Agentforce,
LangChain ou de um runtime próprio. O contrato público normaliza quatro
camadas:

1. identidade do agente;
2. execução e telemetria;
3. evidência de KPI;
4. feedback e decisão operacional.

A especificação canônica está em
`/Users/brunooliveira/dev/Muster-AI-Workforce-Operations/lib/api-spec/openapi.yaml`.

## Endpoint MVP

```http
POST /api/integrations/agent-events
Content-Type: application/json
Authorization: Bearer <sessão do Muster>
```

Em ambiente local, `AUTH_DEV_BYPASS=true` permite validar sem Clerk. Em
produção, o endpoint deve receber uma credencial de integração própria, com
rotação e escopo por tenant — não reutilize o PAT da plataforma.

## Envelope universal

```json
{
  "contractVersion": "muster.agent-ingestion.v1",
  "eventId": "ticket-9001-attempt-1",
  "source": {
    "platform": "zendesk",
    "tenant": "acme-support",
    "environment": "production",
    "reference": "cursor-42"
  },
  "agent": {
    "externalId": "bot-triage-v4",
    "name": "Sofia",
    "version": "4.0",
    "runtime": "zendesk-ai"
  },
  "execution": {
    "id": "ticket-9001",
    "startedAt": "2026-08-12T04:00:00.000Z",
    "completedAt": "2026-08-12T04:00:00.820Z",
    "status": "success",
    "durationMs": 820,
    "costCents": 3,
    "tokensIn": 120,
    "tokensOut": 80,
    "metadata": {
      "ticketId": "9001",
      "channel": "chat"
    }
  },
  "observations": [
    {
      "metricKey": "task_success",
      "label": "Taxa de sucesso",
      "value": 100,
      "unit": "%",
      "kind": "observed",
      "confidence": 0.96,
      "sampleSize": 42,
      "capturedAt": "2026-08-12T04:00:01.000Z",
      "lineage": [
        {
          "stage": "aggregate",
          "name": "zendesk_incremental_tickets",
          "ref": "cursor-42"
        }
      ]
    }
  ],
  "feedback": {
    "kind": "positive",
    "score": 1,
    "comment": "Resposta resolutiva"
  }
}
```

`eventId` funciona como chave de idempotência para execução/feedback. O agente
precisa estar previamente descoberto e admitido; caso contrário o Muster
aceita o envelope sem materializar dados e responde `mapped: false`.

## O que cada plataforma deve enviar

| Fonte | Identidade | Execução | Evidências recomendadas | Transporte inicial |
|---|---|---|---|---|
| Zendesk AI | id estável do bot/automação | ticket, status, duração, escalonamento | resolução, FCR, CSAT, reabertura, custo | export incremental ou webhook |
| Agentforce | agent id + versão + org | sessão, ação, resultado, latência | resolução, acurácia, handoff, guardrails, custo | Agent API, ação OpenAPI ou webhook |
| LangChain/LangGraph | nome/versionamento do grafo | run, tool calls, tokens, erro | sucesso, latência, custo, avaliação humana | SDK/reporter ou webhook |
| Runtime próprio | id operacional + ambiente | execução normalizada | qualquer métrica do catálogo | HTTPS JSON ou batch |
| OpenTelemetry | service/resource identity | trace/span e status | latência, erro, custo enriquecido | OTLP gateway |
| AWS Bedrock AgentCore | runtime/agent/session | invocação, sessão, span, recurso | latência, tokens, erro, custo, uso de CPU | CloudWatch/OTLP |
| Microsoft Foundry | projeto/agent/invocação | trace, prompt, tool e retrieval | latência, exceção, groundedness, avaliação | Application Insights/OTLP |
| Vertex AI Agent Engine | projeto/agent/session | sessão, ferramenta, resultado | latência, erro, qualidade, custo | Cloud Logging/Monitoring |
| Databricks Mosaic AI | endpoint/run/trace | trace, avaliação e execução | qualidade, latência, custo, governança | MLflow/Lakehouse |
| ServiceNow AI | instância/agent/task | ticket, tarefa, handoff | SLA, resolução, escalonamento, aprovação | Table API/webhook |
| IBM watsonx | tenant/skill/run | skill, tarefa, aprovação | sucesso, handoff, compliance, custo | REST/webhook/OTLP |
| Dify/n8n | workflow/app/execution | execução, nó, ferramenta | sucesso, duração, custo, aprovação | REST/webhook/self-hosted |

O adapter não deve enviar PII, prompt completo ou resposta completa por padrão.
Use `metadata` para ids técnicos, classificações e links de auditoria; dados
sensíveis ficam na plataforma de origem.

## Ciclo operacional

```text
conectar → descobrir/admitir → ingerir → materializar evidência
       → reavaliar KPI → abrir/atualizar decisão → feedback/ajuste
```

Após a ingestão, o próximo passo explícito é:

```http
POST /api/agents/{agentId}/reevaluate
```

O resultado informa `dataSource`, `healthScore`, `verdict`, `rulesFired` e a
razão auditável. A decisão humana segue em:

```http
POST /api/agents/{agentId}/verdict/decision
```

com `approved`, `disagreed` ou `exported`. Assim o Muster mede e recomenda,
mas não altera o agente externo sem autorização do time.

## Matriz de prioridade

### Onda 1 — impacto e aderência imediatos

- `aws-bedrock-agentcore`: mercado cloud, runtime gerenciado e observabilidade
  já estruturada;
- `azure-ai-foundry`: forte presença enterprise e telemetria via Azure Monitor;
- `google-vertex-agent-engine`: workloads GCP e integração com Cloud Monitoring;
- `openai-agents` e `langgraph`: origem frequente de agentes customizados;
- `kubernetes-otel`: cobre ambientes locais, híbridos e on-premise sem lock-in.

### Onda 2 — enterprise e dados

- `databricks-mosaic-ai`: avaliação e governança orientadas a dados;
- `servicenow-ai`: operação ITSM, SLA e handoff humano;
- `ibm-watsonx`: automação enterprise e ambientes regulados;
- `snowflake-cortex-agents`: agentes próximos ao warehouse e dados governados.

### Onda 3 — automação e self-hosted

- `dify`, `n8n`, CrewAI e LlamaIndex;
- adapters para runtimes Kubernetes, Docker e edge;
- importação por arquivos batch para ambientes sem conectividade de saída.

## Capabilities

```http
GET /api/connectors/capabilities
```

O endpoint diferencia `live`, `contract-ready` e `planned`. No estado atual:

- GitHub: descoberta real de repositórios;
- Webhook universal: ingestão real de telemetria e métricas;
- Zendesk, Agentforce, AWS, Azure, GCP, Databricks e frameworks open-source:
  contrato preparado, ainda sem adapter nativo de autenticação/polling;
- Kubernetes/runtime próprio e webhook: ingestão imediata pelo contrato;
- OpenTelemetry: contrato preparado, ainda sem gateway OTLP dedicado.

## Critérios de produção

Antes de habilitar adapters nativos, faltam: credencial por tenant em KMS,
assinatura HMAC ou mTLS, rate limit/retry com backoff, fila assíncrona,
dead-letter queue, cursor persistente, deduplicação distribuída, redaction de
PII, métricas do próprio conector e testes de contrato com sandbox de cada
fornecedor.

## Diretriz técnica

Não vamos criar um conector diferente para cada KPI. Cada adapter deve apenas
traduzir o modelo do fornecedor para o envelope universal. A medição, a
linhagem, a avaliação dos contratos KPI e o veredito continuam no núcleo do
Muster. Isso reduz lock-in e permite rodar o mesmo agente em AWS, Azure, GCP,
Docker ou on-premise sem alterar o painel.
