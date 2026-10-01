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
Authorization: Bearer <mck_live_...>
```

Crie a conexão em `POST /api/connectors` ou pela tela **Conectores**. A chave
tenant-scoped é exibida uma única vez e somente seu hash é persistido. Sessões
Clerk, PATs de fornecedores e chaves de agente não são aceitos como prova da
integração. Reconfigurar a conexão revoga a chave anterior.

O ciclo mínimo é:

1. configurar a origem e guardar a chave `mck_live_...`;
2. admitir o agente com um `externalId` estável;
3. enviar um envelope com o mesmo `externalId`;
4. confirmar o estado `connected`, `health=healthy` e `lastEventAt` preenchido.

## Conector x admissão

Os dois recursos agora formam um único funil, mas têm responsabilidades
diferentes:

| Recurso | Responsabilidade | Não faz |
|---|---|---|
| **Conector** | autentica a origem, descobre candidatos e transporta eventos/evidências | não autoriza um agente a operar nem define seu propósito |
| **Admissão** | formaliza identidade, propósito, owners, autonomia, limites, KPIs e probation | não coleta telemetria diretamente |
| **Primeiro evento** | prova que o agente admitido e o conector estão operando com o mesmo `externalId` | não substitui avaliação ou decisão humana |

Ao selecionar uma origem na admissão, o Muster persiste a relação em
`agent_connector_links`. O vínculo é tenant-scoped e contém o `externalId`
usado pelo runtime. A ingestão procura primeiro essa relação; agentes legados
sem vínculo explícito são associados ao primeiro evento autenticado para
preservar compatibilidade.

Discovery não envia mais um candidato diretamente para a frota na interface.
O usuário revisa e admite o profissional antes de iniciar a supervisão.

## Envelope universal

```json
{
  "contractVersion": "muster.agent-ingestion.v1",
  "eventId": "ticket-9001-attempt-1",
  "source": {
    "platform": "zendesk",
    "connectorId": "connector_01",
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
      "confidence": 96,
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
aceita o envelope sem materializar dados e responde `mapped: false`. Nesse
caso a conexão é comprovada, mas nenhuma métrica é atribuída até existir um
agente do mesmo tenant com o `externalId` informado.

## Estados operacionais

| Estado | Evidência existente | Próxima ação |
|---|---|---|
| `configured` | chave emitida e endpoint preparado | enviar o primeiro evento real |
| `connected` | teste nativo válido ou envelope autenticado recebido | acompanhar freshness e cobertura |
| `syncing` | coleta em processamento | aguardar ou inspecionar atividade |
| `degraded` | origem ativa com perda de qualidade/freshness | revisar eventos e credencial |
| `error` | teste ou configuração inválida | corrigir e repetir o teste |

Entradas do catálogo não persistidas aparecem como `available`; isso não
significa que estejam conectadas.

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

Após a ingestão, o outbox agenda automaticamente a reavaliação. O endpoint
manual permanece disponível para operação, diagnóstico e recomputação:

```http
POST /api/agents/{agentId}/reevaluate
```

O resultado informa `dataSource`, `healthScore`, `verdict`, `rulesFired` e a
razão auditável. A atividade contínua pode ser acompanhada por
`GET /api/telemetry/activity` ou
`GET /api/telemetry/activity/stream`. A decisão humana segue em:

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

Credenciais persistidas já usam envelope AES-256-GCM versionado e redaction
defensivo. A configuração, migração legada e procedimentos operacionais estão
em [Segredos de conectores](./CONECTOR-SECRETS.md). KMS/Vault externo e chaves
por tenant continuam como evolução para produção em escala.

Antes de habilitar adapters nativos, ainda faltam: assinatura HMAC ou mTLS,
rate limit, cursor persistente do fornecedor, redaction de PII, métricas do
próprio conector e testes de contrato com sandbox de cada fornecedor. Retry,
dead-letter, cursor de atividade e deduplicação tenant-aware já existem no
núcleo de ingestão/projeção.

## Diretriz técnica

Não vamos criar um conector diferente para cada KPI. Cada adapter deve apenas
traduzir o modelo do fornecedor para o envelope universal. A medição, a
linhagem, a avaliação dos contratos KPI e o veredito continuam no núcleo do
Muster. Isso reduz lock-in e permite rodar o mesmo agente em AWS, Azure, GCP,
Docker ou on-premise sem alterar o painel.
