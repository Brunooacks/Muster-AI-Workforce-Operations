# Muster — Estratégia de regressão, contexto e inputs de agentes

## Decisão

O Muster não deve avaliar regressão comparando agentes, versões ou períodos
incompatíveis. A unidade de comparação é um **contrato de execução**:

```text
tenant + função + caso de uso + classe de input + política de contexto
+ versão do agente + modelo + prompt + tools + ambiente
```

O produto atual permanece a baseline. A evolução adiciona campos opcionais ao
envelope existente, cria projeções de regressão e preserva `agent_events` como
compatibilidade. Não haverá outro pipeline de telemetria paralelo.

## Diagnóstico do estado atual

O Muster já possui:

- evento de execução, erro, escalação, feedback e heartbeat;
- duração, custo, tokens, sucesso e `metadata`;
- ingestão universal com idempotência;
- evidência com linhagem, confiança, amostra e flags de qualidade;
- outbox, worker e atualização contínua;
- baseline e metas no contrato de KPI.

As lacunas são:

1. contexto e input não possuem contrato explícito; dependem de `metadata`;
2. execução não registra de forma canônica versão de modelo, prompt, tools e release;
3. não existe identificação padronizada de trace, sessão, jornada, etapa e item de trabalho;
4. não existe política de captura por sensibilidade e retenção;
5. tendências atuais não atribuem regressão a mudança de modelo, prompt, contexto ou workload;
6. não existe gate estatístico para separar ruído, drift e regressão real.

## Run Envelope v2

O envelope v2 será aditivo. Os adapters atuais continuam válidos.

### Identidade e correlação

- `runId`, `traceId`, `spanId`, `parentSpanId` e `sessionId`;
- `journeyId`, `stageId`, `workItemId` e `handoffId`;
- `agentId`, `agentVersion`, `contractVersion` e `teamId`;
- `environment`, `deploymentId`, `releaseId` e grupo `control|canary|shadow`.

### Configuração executada

- provider, modelo e versão/snapshot;
- prompt/template e versão;
- tools habilitadas e versão do toolset;
- parâmetros relevantes: temperatura, limite de tokens e estratégia de retry;
- versão do schema de input, output e política de contexto.

### Manifesto do input

Por padrão o Muster coleta **descritores**, não o conteúdo bruto:

- classe da tarefa, domínio, canal, idioma e complexidade;
- tamanho, tokens, formato e hash determinístico do input normalizado;
- tags de sensibilidade e política aplicada;
- ground-truth ou resultado esperado quando disponível;
- identificador opaco do caso de avaliação.

### Manifesto de contexto

Cada fonte usada pelo agente registra:

- tipo: system instruction, memória, retrieval, arquivo, banco, API, tool ou handoff;
- referência opaca, versão, hash, timestamp e owner;
- escopo de autorização e tenant;
- tokens, freshness, relevância e posição no contexto;
- resultado da recuperação: encontrado, ausente, stale, negado ou truncado.

### Resultado e feedback

- status, output schema válido e motivo de falha;
- tool calls, argumentos validados, retries e side effects;
- guardrails acionados, recusas e escalações;
- correção humana, aceite do usuário e outcome posterior;
- avaliações por regra, humano ou judge, sempre com versão e confiança.

## Política de conteúdo

| Nível | O que sai do runtime | Uso |
|---|---|---|
| `metadata_only` | hashes, tamanhos, classes, versões e métricas | padrão enterprise |
| `redacted_sample` | amostra mascarada, cifrada e limitada | investigação autorizada |
| `full_controlled` | conteúdo cifrado e segregado | opt-in explícito, prazo curto e RBAC restrito |
| `local_only` | apenas agregados; conteúdo permanece no collector local | on-premise ou dado regulado |

Regras obrigatórias:

- negar conteúdo bruto por padrão;
- classificação e mascaramento antes do envio;
- separar armazenamento de conteúdo do banco analítico;
- retenção, residência e sampling configuráveis por tenant;
- registrar `redacted`, `not_collected`, `truncated` ou `unavailable`, nunca confundir com vazio;
- permitir exclusão do conteúdo sem apagar a trilha auditável e os agregados permitidos.

## Como detectar regressão

### Tipos de regressão

1. **Resultado:** queda de sucesso, acurácia, completude ou outcome.
2. **Comportamento:** violação de política, recusa indevida, alucinação ou ação não autorizada.
3. **Operação:** aumento de erro, latência, retries, tokens ou custo.
4. **Contexto:** queda de completude, freshness, relevância, groundedness ou recuperação.
5. **Jornada:** handoff incompleto, timeout, retrabalho ou sucesso local sem sucesso E2E.
6. **Humano:** aumento de correções, escalações ou rejeições da recomendação.

Não existe um único score de regressão. Um agente pode melhorar custo e piorar
qualidade; a interface deve preservar essa divergência.

### Baseline comparável

Cada baseline é versionada e fixa a combinação de função, workload, versões e
política de contexto. A comparação exige:

- mesma classe de input e distribuição de complexidade;
- mesma definição de sucesso e versão do avaliador;
- amostra mínima definida no KPI;
- janela de controle anterior e janela candidata;
- cobertura, freshness e confiança acima do mínimo;
- marcação de mudanças de release.

Sem essas condições, o estado é `insufficient_data`, não regressão.

### Gates

- guardrail crítico: bloqueio imediato em qualquer ocorrência válida;
- KPI principal: alerta quando rompe tolerância e confiança mínima;
- tendência: exigir duas ou mais janelas consecutivas fora do limite;
- drift: alertar mudança relevante na distribuição dos inputs antes de culpar o agente;
- contexto: separar ausência da fonte, fonte stale e falha de uso pelo agente;
- regressão global: somente quando o efeito aparece em coorte comparável.

O primeiro motor pode usar diferença absoluta/relativa, intervalo de confiança e
EWMA. Testes mais sofisticados entram quando houver volume suficiente; não se
deve aplicar estatística complexa sobre amostras pequenas.

## Fluxo operacional

```text
detectar → qualificar dado → atribuir causa provável → reproduzir/replay
→ recomendar → aprovar → canary 5% → 25% → 100% → verificar → encerrar ou rollback
```

Toda regressão deve mostrar:

- métrica afetada, baseline, valor atual, delta, amostra e confiança;
- versão ou mudança correlacionada;
- segmentos de input/contexto onde aparece;
- impacto em agente, equipe, jornada e outcome;
- owner, SLA, ação sugerida e rollback;
- resultado pós-intervenção.

## KPIs de contexto e inputs

### Qualidade do dado coletado

- cobertura de correlação de runs;
- freshness e atraso de ingestão;
- eventos duplicados, fora de ordem e com clock skew;
- percentual de inputs classificados;
- percentual de conteúdo mascarado ou não coletado;
- cobertura de ground-truth e latência de feedback;
- concordância entre avaliadores humanos e automáticos.

### Qualidade do contexto do agente

- completude do contexto obrigatório;
- freshness da fonte;
- precisão e recall de retrieval quando houver ground-truth;
- relevância média dos documentos recuperados;
- groundedness/citação do output;
- taxa de truncamento e pressão de contexto;
- sucesso condicionado por fonte e versão;
- escalação correta quando contexto obrigatório está ausente.

### Sensibilidade ao input

- sucesso por classe, domínio, idioma, canal e complexidade;
- diferença entre cohorts e taxa de desconhecidos;
- estabilidade a pequenas variações equivalentes;
- robustez a input incompleto, contraditório ou adversarial;
- taxa de violação por categoria de sensibilidade.

## Arquitetura incremental

### Agora

1. Tipar `metadata.muster` no reporter atual com correlação, release, input e contexto.
2. Aceitar os mesmos campos opcionais no envelope universal.
3. Persistir hashes e descritores no evento atual; nenhum conteúdo bruto por padrão.
4. Criar detector determinístico comparando janela atual e anterior.
5. Exibir regressão no prontuário e na fila de decisões existente.

### Depois do piloto

1. Introduzir `agent_runs`, spans e avaliações quando o volume justificar.
2. Receber OTLP/OpenTelemetry e normalizar convenções OpenInference.
3. Adicionar collector local com buffer cifrado, masking e políticas por tenant.
4. Mover séries de alta cardinalidade para storage analítico sem retirar Postgres como control plane.
5. Adicionar replay, shadow e canary ligados ao board de ações.

## Corte mínimo para o MVP

Para sábado, o objetivo não é construir uma plataforma completa de evals. O
piloto deve provar com um agente real:

1. `releaseId`, versão do agente/modelo/prompt e classe de input registradas;
2. manifesto de contexto em `metadata_only`;
3. duas janelas comparáveis de execução;
4. detecção de queda de sucesso, aumento de latência ou custo;
5. estado `insufficient_data` quando a comparação não for válida;
6. alerta com causa provável, owner e ação, sem armazenar prompt bruto.

## Referências adotadas

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)
- [OpenInference Specification](https://arize-ai.github.io/openinference/spec/)
- [OpenInference privacy configuration](https://arize-ai.github.io/openinference/spec/configuration.html)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [OpenAI Evals](https://platform.openai.com/docs/api-reference/evals)
