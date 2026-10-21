# Conector OTLP GenAI direto — desenho (11/10/2026)

Status: **desenho + esqueleto**, sem rota ligada. Prioridade abaixo do conector
Langfuse de leitura (decisão de 11/10, `muster-langfuse-2026-10-11`). Entra
quando um design partner sem Langfuse pedir, reaproveitando o envelope v2 do
MUS-171.

## Por que existe

Os runtimes de agente (OpenAI Agents SDK, LangGraph, CrewAI, Bedrock
AgentCore, Foundry, Vertex, Vercel AI SDK) emitem spans OpenTelemetry com as
convenções semânticas GenAI (`gen_ai.*`). Um endpoint OTLP no Muster cobre
vários fornecedores sem um adaptador por fornecedor, que é o argumento do
"painel neutro".

## Regra número 1: o Muster não recebe conteúdo (LGPD)

O Muster não quer ser operador de prompts e respostas. O endpoint:

1. **Lê só uma allowlist de atributos** e descarta o resto antes de qualquer
   persistência ou log:
   - recurso: `service.name`, `service.version`, `deployment.environment(.name)`;
   - span: `gen_ai.operation.name`, `gen_ai.provider.name` (e o legado
     `gen_ai.system`), `gen_ai.request.model`, `gen_ai.response.model`,
     `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`,
     `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.tool.name`, `error.type`;
   - `gen_ai.conversation.id` só como hash SHA-256 truncado.
2. **Descarta sempre** `gen_ai.input.messages`, `gen_ai.output.messages`,
   `gen_ai.system_instructions`, `gen_ai.tool.call.arguments`,
   `gen_ai.tool.call.result`, os legados `gen_ai.prompt*`/`gen_ai.completion*`,
   atributos `llm.*`/`input.value`/`output.value` (OpenInference) e **todos os
   span events** (versões antigas da convenção põem conteúdo em eventos).
3. Responde quantos atributos de conteúdo descartou
   (`partialSuccess.errorMessage`), para o cliente corrigir na origem. A
   recomendação ao cliente é remover conteúdo já no OpenTelemetry Collector
   (processador `attributes`/`transform`), antes de sair da rede dele.
4. Nunca loga o corpo da requisição; limite de 1 MiB por requisição.

## Contrato

- `POST /api/integrations/otlp/v1/traces`, OTLP/HTTP **JSON**
  (`ExportTraceServiceRequest`). Protobuf responde `415` com a orientação de
  usar `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json` ou um Collector. gRPC
  fica fora (o droplet só expõe HTTP pelo túnel).
- Autenticação: a mesma chave de ingestão por conector (`Authorization: Bearer
  mck_live_...`, `requireIntegrationCredential`); o conector precisa ser da
  plataforma `otel`. A organização vem da chave, nunca do payload.
- Resposta OTLP padrão: `200 {"partialSuccess":{"rejectedSpans":N,"errorMessage":"..."}}`.

## Mapeamento para o envelope v2 (MUS-171)

| OTel | Muster |
| --- | --- |
| span `invoke_agent` | uma execução (`taskRunId = otel:<traceId>:<spanId>`), agente = `gen_ai.agent.id` ou `gen_ai.agent.name` (sem nenhum dos dois: `service.name`) |
| span de inferência (`chat`, `text_completion`, `generate_content`, `embeddings`) **raiz** do trace | uma execução do agente `service.name` |
| span de inferência com pai `invoke_agent` no mesmo lote | soma tokens no pai quando o pai não traz `gen_ai.usage.*` |
| span de inferência cujo pai **não** está no lote | descartado e contado em `rejectedSpans` (evita contar em dobro: os exportadores mandam filhos antes do pai) |
| `execute_tool` | contagem de ferramentas na execução |
| `status.code = ERROR` ou `error.type` | `status: "error"` |
| duração | `endTimeUnixNano - startTimeUnixNano` |
| `eventId` | `otel:<traceId>:<spanId>` (idempotência pelos recibos existentes) |

Custo: a convenção não tem atributo de custo. Sem custo informado, a execução
entra sem `costCents` e a métrica de custo por tarefa validada fica com
evidência insuficiente até o custo chegar por outra fonte. Validação: OTel não
tem validação humana; ela chega por `feedback` v2 referenciando o `taskRunId`.

## Riscos

- A convenção GenAI ainda está "em desenvolvimento" e muda nomes (ex.:
  `gen_ai.system` → `gen_ai.provider.name`). O mapeador aceita os dois e tem
  fixtures por versão.
- Dialetos (OpenInference, OpenLLMetry, Langfuse) usam outros atributos; só
  `gen_ai.*` é lido. Para eles, Collector com `transform`.
- Volume: cada span vira no máximo uma linha de execução; spans descartados não
  são guardados. O Postgres do droplet tem 256 MiB: com volume alto, agregar
  antes de gravar.

## Esforço restante

Esqueleto (este PR): função pura de extração com allowlist e testes. Faltam:
rota + conector `otel` com chave (1 dia), materialização no envelope v2 depois
do MUS-171 (1 dia), testes de integração com Postgres (0,5 dia) e guia do
Collector para o cliente (0,5 dia).
