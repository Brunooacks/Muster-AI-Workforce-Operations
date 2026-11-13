# Langfuse como camada de observabilidade do Muster

**Status:** desenho aprovado em conversa em 29 de setembro de 2026  
**Escopo:** conector nativo, sincronização contínua, métricas LLM e integração com o loop decisório existente  
**Fora do escopo:** substituir o control plane do Muster, embutir a interface do Langfuse ou executar ações irreversíveis automaticamente

## 1. Objetivo

Adicionar Langfuse como fonte opcional de observabilidade e avaliação para agentes
baseados em LLM. A integração deve coletar traces, observations, sessions, uso,
custo, latência e scores; normalizar esses sinais no contrato existente do Muster;
e alimentar reavaliações, recomendações e decisões sem transferir ao Langfuse a
responsabilidade por propósito, autonomia, equipes, lifecycle ou resultado de
negócio.

O resultado esperado é um gestor conseguir:

1. conectar um projeto Langfuse Cloud ou self-hosted;
2. associar traces a profissionais digitais já admitidos;
3. acompanhar sinais LLM com freshness operacional;
4. combinar esses sinais com os contratos de KPI do Muster;
5. receber recomendações auditáveis quando qualidade, risco, custo ou desempenho
   regredirem;
6. decidir, executar e acompanhar um plano de ação pelo fluxo existente do Muster.

## 2. Contexto atual do Muster

O Muster já possui:

- ingestão tenant-scoped por agente e por conector;
- contrato universal `muster.agent-ingestion.v1`;
- eventos de execução, erro, escalonamento, feedback e heartbeat;
- evidência de métricas com proveniência e confiança;
- outbox durável, worker e reavaliação contínua;
- catálogo e contratos de KPI;
- conectores nativos registrados por SPI;
- credenciais cifradas para adapters;
- SSE para atividade contínua;
- recomendação, decisão humana e planos de ação.

A integração deve reutilizar essas fronteiras. Não será criado um segundo motor de
governança ou uma segunda taxonomia de agentes.

## 3. Decisão arquitetural

Será adotada uma arquitetura híbrida de **dual path**:

```text
Agente ou aplicação
 ├── evento operacional imediato ───────────────→ Muster ingestion
 └── trace OpenTelemetry / Langfuse SDK ────────→ Langfuse
                                                        │
                                             observations + scores
                                                        │
                                             sincronização 15–30 s
                                                        ▼
                                               Langfuse adapter
                                                        │
                                         normalização + idempotência
                                                        ▼
                                eventos/evidências → outbox → reavaliação
                                                        │
                                                        ▼
                             KPI → recomendação → decisão → ação → impacto
```

O evento direto para o Muster é o caminho de baixa latência e supervisão. A
sincronização do Langfuse é o caminho de enriquecimento LLM. Quando um cliente
não instrumentar o caminho direto, o adapter ainda entregará near-real-time, mas
a interface deverá declarar a freshness observada e nunca rotular polling como
tempo real estrito.

### Alternativas rejeitadas

1. **Langfuse como fonte única:** rejeitada porque a consulta dos dados é
   assíncrona e não carrega propósito, direitos decisórios ou outcomes do Muster.
2. **Copiar a interface do Langfuse para dentro do Muster:** rejeitada por
   duplicar produto e aumentar lock-in visual e operacional.
3. **Consultar diretamente o banco ClickHouse do Langfuse:** rejeitada porque
   acopla o Muster à implementação interna e contorna APIs públicas e tenancy.

## 4. Fronteira de produto

### Responsabilidade do Langfuse

- traces, observations e sessions;
- chamadas de modelo, ferramentas, retrieval e guardrails;
- tokens, custos, latência e time to first token;
- modelo, prompt, release e versão;
- scores humanos, programáticos e LLM-as-a-Judge;
- datasets e experimentos, quando usados pelo cliente.

### Responsabilidade do Muster

- organização, área, equipe, jornada e profissional digital;
- propósito, função, escopo, autonomia e direitos de ação;
- contrato e meta dos KPIs;
- classificação de dado real, inferido ou sintético;
- contexto de negócio e resultado técnico ou operacional;
- recomendação, decisão, SLA, plano de ação e impacto;
- mentoria, promoção, recalibração, suspensão e aposentadoria;
- relatório executivo e trilha de auditoria.

## 5. Contrato de correlação

Cada trace relevante deverá carregar os seguintes atributos em metadata:

| Atributo | Obrigatório | Uso no Muster |
|---|---:|---|
| `muster.org_id` | sim | defesa adicional contra associação cross-tenant |
| `muster.agent_external_id` | sim | associação com `agent_connector_links.external_id` |
| `muster.execution_id` | recomendado | idempotência e drill-down da execução |
| `muster.team_id` | opcional | agregação por equipe híbrida |
| `muster.journey_id` | opcional | agregação e replay de jornada A2A |
| `muster.purpose_id` | opcional | vínculo com objetivo/contrato vigente |
| `muster.release_id` | recomendado | regressão por versão ou release |
| `muster.environment` | recomendado | produção, staging, laboratório ou desenvolvimento |

O adapter não inferirá um profissional a partir de nome do trace, nome do modelo
ou usuário. Traces sem `muster.agent_external_id` serão contabilizados como não
mapeados e apresentados com uma próxima ação de configuração.

O `traceId` do Langfuse será preservado em `source.reference` e na linhagem da
evidência. O `sessionId` poderá representar thread ou execução de jornada, mas
somente quando a configuração do conector declarar essa semântica.

## 6. Credenciais e configuração

O SPI atual aceita um token simples. Para Langfuse, o credential payload passará
a suportar um envelope versionado e cifrado:

```ts
interface LangfuseCredentialBundleV1 {
  version: 1;
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  environment?: string;
}
```

Regras:

- o bundle inteiro será cifrado usando o mecanismo já aplicado a
  `connector_credentials`;
- `secretKey` nunca será retornada pela API;
- logs e erros passarão pela redaction defensiva existente;
- `baseUrl` aceitará Langfuse Cloud e instâncias self-hosted HTTPS;
- HTTP será permitido somente para loopback no laboratório local;
- redirects para hosts diferentes serão recusados;
- um conector Langfuse pertencerá a uma única organização Muster;
- um projeto Langfuse não deverá ser compartilhado por organizações Muster
  distintas na primeira versão.

## 7. Adapter nativo

O adapter `langfuse` implementará a SPI de conectores com capacidades:

```text
testConnection  = true
discoverAgents  = true
collectTelemetry = true
collectMetrics   = true
sendFeedback     = false
exportDecisions  = false
```

### Teste de conexão

O teste fará uma consulta limitada e temporalmente delimitada à Observations API
v2. O resultado deverá diferenciar:

- credencial aceita;
- endpoint incompatível ou versão anterior ao Langfuse v4;
- projeto vazio, mas conexão válida;
- autenticação recusada;
- timeout, rate limit ou indisponibilidade;
- TLS ou URL rejeitada pela política de segurança.

### Discovery

O discovery agrupará root observations por
`muster.agent_external_id`. Para cada identificador serão apresentados:

- nome sugerido a partir do trace name ou metadata explícita;
- ambientes, versões, releases e modelos observados;
- volume recente e última atividade;
- métricas e scores disponíveis;
- confiança da identificação;
- lacunas de instrumentação.

Discovery não admite automaticamente o profissional.

## 8. Sincronização contínua

### Fontes públicas utilizadas

- `GET /api/public/v2/observations` para rows de observação;
- `GET /api/public/v3/scores` para scores;
- `GET /api/public/v2/metrics` para agregações e reconciliação.

Cada consulta de observations será limitada por `fromStartTime` e
`toStartTime`, solicitará apenas os field groups necessários e usará cursor até
esgotar a janela. O primeiro sync terá janela configurável e limitada; os demais
usarão watermark com pequena sobreposição para tolerar atraso de processamento.

### Estado de sync

Será persistido por conector:

- último início e último sucesso;
- watermark de observations e scores;
- cursor transitório da execução atual;
- quantidade lida, materializada, deduplicada e não mapeada;
- falhas consecutivas, último erro seguro e próxima tentativa;
- freshness da origem e duração do sync.

O checkpoint só avançará depois da persistência transacional no Muster.
Reprocessamento será seguro por idempotência baseada em origem, tipo e id externo.

### Cadência

- padrão: 30 segundos;
- mínimo: 15 segundos;
- backoff exponencial com jitter em erros e rate limit;
- circuit breaker após falhas consecutivas;
- sincronização manual disponível para diagnóstico;
- worker horizontalmente escalável com claim exclusivo por conector.

## 9. Normalização

### Observations

Observations root ou do tipo agente serão convertidas em execução:

| Langfuse | Muster |
|---|---|
| `id` / `traceId` | id externo e referência auditável |
| `startTime`, `endTime`, `latency` | timestamps e `durationMs` |
| `level=ERROR` ou status de erro | evento `error` |
| execução concluída sem erro | evento `execution` |
| `inputUsage`, `outputUsage` | `tokensIn`, `tokensOut` |
| modelo, prompt, versão e release | metadata permitida |
| `sessionId` | thread/jornada quando configurado |

Custos não serão convertidos implicitamente para BRL. O custo original será
materializado como evidência com moeda declarada, por exemplo
`llm_cost_usd`. Conversão cambial só poderá ocorrer em uma política explícita,
versionada e auditável.

### Scores

Scores numéricos e booleanos serão materializados diretamente como evidência.
Scores categóricos exigirão um mapeamento configurado no catálogo antes de
participarem de cálculos. Scores textuais serão armazenados como justificativa
ou evidência, nunca transformados automaticamente em número.

O score config do Langfuse será preservado na linhagem quando disponível.

## 10. Métricas

### Operação e eficiência

- `llm_latency_ms_avg` e `llm_latency_ms_p95`;
- `llm_time_to_first_token_ms`;
- `llm_execution_volume`;
- `llm_error_rate`;
- `llm_tool_failure_rate`;
- `llm_input_tokens`, `llm_output_tokens`, `llm_total_tokens`;
- `llm_cost_<currency>` e custo por execução;
- modelo, prompt, release e versão como dimensões.

### Qualidade e risco

- task success;
- correctness;
- groundedness;
- hallucination risk;
- relevância e completude;
- policy compliance;
- segurança e exposição de dados;
- satisfação ou feedback humano;
- taxa de correção e reexecução.

### Autonomia e governança

- conclusão sem intervenção;
- intervenção humana;
- escalonamento;
- tool call permitido/negado;
- guardrail acionado;
- cobertura de avaliação;
- cobertura de evidência;
- freshness e amostra mínima.

### Sinais decisórios derivados pelo Muster

- regressão por release, modelo ou prompt;
- qualidade abaixo do contrato;
- aumento de custo sem ganho de outcome;
- degradação de latência ou erro;
- aumento de alucinação ou intervenção;
- score sem amostra ou com freshness insuficiente;
- divergência entre resultado local e sucesso end-to-end da jornada.

Nenhuma dessas condições executará ação irreversível automaticamente. Elas
criarão ou atualizarão recomendação, SLA e plano de ação segundo os direitos já
definidos no Muster.

## 11. Privacidade e segurança

Por padrão, o Muster não consultará nem persistirá `input` e `output` de
observations. A coleta inicial solicitará somente:

```text
core,basic,metadata,usage,metrics,trace_context
```

Metadata será filtrada por allowlist. Prompt, resposta, documento recuperado,
tool arguments, anexos e PII permanecerão no Langfuse, salvo ativação futura e
explícita de uma política de evidência.

Controles obrigatórios:

- tenant scope em todas as leituras e gravações;
- credencial cifrada e nunca enviada ao navegador;
- proteção SSRF para `baseUrl`;
- timeout, limite de payload e paginação limitada;
- redaction de headers e mensagens de erro;
- auditoria de configuração, teste, sync e rotação;
- retenção do Muster independente da retenção configurada no Langfuse;
- nenhum link público de trace gerado automaticamente.

## 12. Experiência de configuração

Na Central de Conectores, Langfuse aparecerá como adapter nativo:

1. escolher Cloud ou self-hosted;
2. informar URL, public key e secret key;
3. testar a conexão;
4. visualizar ambientes, traces e agentes identificáveis;
5. corrigir metadata ausente ou selecionar profissionais já admitidos;
6. mapear scores para métricas do catálogo;
7. escolher cadência dentro dos limites permitidos;
8. executar primeira sincronização;
9. validar freshness, cobertura e eventos materializados;
10. abrir a visão do profissional ou jornada já alimentada.

O status deverá exibir `configurado`, `sincronizando`, `comprovado`, `degradado`
ou `erro`, com próxima ação objetiva.

## 13. Capacidade demonstrável

Será criado um cenário reproduzível com:

- dois profissionais digitais;
- traces de sucesso, erro e escalonamento;
- chamadas de ferramenta;
- tokens, latência e custo em moeda declarada;
- scores de correctness, groundedness e hallucination;
- duas releases, sendo a segunda regressiva;
- um trace não mapeado para demonstrar diagnóstico;
- reexecução do sync para provar deduplicação;
- geração de recomendação e plano de ação no Muster.

O cenário automatizado utilizará um servidor fake compatível com as APIs
públicas somente para testes determinísticos. Um smoke opcional contra Langfuse
Cloud ou self-hosted será executado quando as variáveis de ambiente estiverem
presentes e será identificado como prova externa real.

## 14. Testes

### Unidade

- serialização e materialização segura das credenciais;
- validação e normalização da URL;
- parsing de observations e scores;
- mapeamento de tipos e unidades;
- política de metadata;
- score mapping;
- cálculo de watermarks e backoff;
- decisão de saúde e freshness.

### Contrato

- fixtures aderentes às APIs v2/v3;
- paginação por cursor;
- compatibilidade Cloud e self-hosted v4;
- erros 401, 403, 404, 429 e 5xx;
- campos ausentes e versões incompatíveis.

### Integração PostgreSQL

- credencial cifrada;
- isolamento entre tenants;
- persistência transacional de evento, evidência e checkpoint;
- idempotência após retry e restart;
- outbox e reavaliação;
- link entre conector e profissional.

### E2E autenticado

- configurar e testar o conector;
- executar discovery;
- mapear/admitir profissional;
- sincronizar;
- visualizar métricas reais;
- abrir recomendação e decidir;
- consultar trilha até o trace de origem.

### Capacidade

- sync concorrente de múltiplos conectores;
- lote com pelo menos dez mil observations;
- interrupção e retomada sem perda ou duplicação;
- rate limit e recuperação;
- soak test de 24 horas antes de promoção para piloto pago.

## 15. Observabilidade do próprio adapter

O Muster publicará:

- syncs iniciados, concluídos e falhos;
- observations e scores lidos;
- itens materializados, deduplicados e não mapeados;
- duração e atraso de processamento;
- freshness da fonte;
- falhas por categoria;
- tamanho da fila e retries;
- idade do checkpoint;
- recomendações abertas pela origem Langfuse.

Logs deverão conter `orgId`, `connectorId`, `syncRunId` e contagens, nunca
segredos, prompts ou respostas.

## 16. Implantação

O adapter será compatível com:

- Langfuse Cloud;
- Langfuse v4 self-hosted em cloud;
- Langfuse v4 self-hosted on-premise ou local.

Langfuse não será dependência obrigatória do runtime do Muster. Uma implantação
self-hosted completa envolve web, worker, PostgreSQL, Redis/Valkey, ClickHouse e
blob storage. Um profile de laboratório poderá ser documentado depois do
adapter, mas o compose padrão do Muster continuará leve.

## 17. Sequência de entrega

1. contratos, credential bundle e adapter de teste;
2. cliente Observations v2 e Scores v3 com fixtures;
3. normalização, idempotência e persistência;
4. sync manual e estado operacional;
5. worker agendado e backoff;
6. discovery e score mapping;
7. experiência completa na Central de Conectores;
8. cenário demonstrativo e E2E;
9. smoke externo opcional;
10. carga, restart e relatório de capacidade.

## 18. Critérios de aceite

A entrega inicial estará concluída quando:

1. uma organização configurar Langfuse sem expor segredo ao frontend;
2. o teste diferenciar conexão válida, projeto vazio e falha real;
3. observations e scores forem sincronizados com idempotência;
4. traces só forem atribuídos ao profissional por correlação explícita;
5. métricas exibirem origem, amostra, confiança, freshness e trace de referência;
6. regressão entre releases abrir uma recomendação auditável;
7. uma decisão aprovada gerar plano de ação com owner e SLA;
8. retry ou restart não duplicar eventos ou evidências;
9. dois tenants não conseguirem acessar nem materializar dados um do outro;
10. testes unitários, integração, E2E autenticado e build estiverem aprovados;
11. a demonstração declarar claramente dado fake e smoke externo real;
12. nenhum prompt ou resposta for persistido por padrão.

## 19. Referências oficiais

- [Observability data model](https://langfuse.com/docs/observability/data-model)
- [Observations API v2](https://langfuse.com/docs/api-and-data-platform/features/observations-api)
- [Scores API v3](https://langfuse.com/docs/api-and-data-platform/features/scores-api)
- [Metrics API v2](https://langfuse.com/docs/metrics/features/metrics-api)
- [Scores data model](https://langfuse.com/docs/evaluation/scores/data-model)
- [OpenTelemetry integration](https://langfuse.com/integrations/native/opentelemetry)
- [Langfuse architecture](https://langfuse.com/handbook/product-engineering/architecture)
- [Self-hosted scaling](https://langfuse.com/self-hosting/configuration/scaling)
- [Versions and compatibility](https://langfuse.com/docs/compatibility)

