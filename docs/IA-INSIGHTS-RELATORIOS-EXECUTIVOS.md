# IA, insights e relatórios executivos

## Princípio de arquitetura

O Muster separa **fato calculado** de **interpretação assistida por IA**.

- Eventos, custos, duração, sucesso, alertas, avaliações e KPIs são agregados por regras determinísticas.
- Cada relatório mensal é um snapshot versionado e imutável dos fatos disponíveis naquele momento.
- A IA pode resumir, explicar e propor perguntas ou ações, mas não pode alterar métricas.
- Toda recomendação precisa carregar confiança, referências de evidência, origem e estado de revisão.
- Cobertura e limitações aparecem no relatório; ausência de dado nunca deve ser apresentada como bom desempenho.

Essa separação permite usar IA com velocidade sem perder auditabilidade perante gestores, clientes e board.

## Onde usar IA no produto

| Jornada | Uso de IA | Entrada controlada | Saída | Aprovação humana |
| --- | --- | --- | --- | --- |
| Discovery | Ler código, manifestos, prompts e logs para sugerir papel, propósito, risco e integrações | Repositório e amostra de telemetria autorizados | Rascunho de cadastro e lacunas de instrumentação | Obrigatória antes da admissão |
| Contrato de performance | Recomendar KPIs e baselines conforme função e domínio | Propósito, tarefa, ambiente e catálogo versionado | Contrato inicial explicável | Obrigatória para publicar |
| Supervisão contínua | Explicar anomalias e correlacionar mudanças entre camadas | Séries temporais, deploys, alertas e evidências | Hipóteses priorizadas, nunca causalidade presumida | Exigida para ações de alto impacto |
| Coaching do agente | Sugerir plano de melhoria, teste e critério de conclusão | Veredito, falhas, KPIs e histórico de ações | Plano com responsável, SLA e evidência esperada | Conforme autonomia do contrato |
| Equipes mistas e A2A | Encontrar handoffs frágeis e responsabilidades ambíguas | Jornada, papéis, decisões e telemetria por etapa | Recomendações de redistribuição ou guardrail | Obrigatória quando afeta humano ou produção |
| Benchmarking | Normalizar comparação entre agentes equivalentes | Taxonomia, domínio, versão e volume mínimo | Faixa de referência e explicação de diferenças | Curadoria periódica do catálogo |
| Relatório executivo | Transformar fatos em narrativa adequada ao público | Snapshot mensal agregado | Resumo e seções executivas | Revisão antes de publicar ao board |
| Copiloto de governança | Responder perguntas com links para evidência e política | Dados do tenant e documentos autorizados | Resposta citada e nível de confiança | Escalonamento quando não houver evidência |

## Banco analítico implementado

### `executive_report_snapshots`

Armazena uma versão completa do fechamento mensal por organização:

- período e versão;
- template e estado de publicação;
- métricas atuais, mês anterior e variação;
- comparação das cinco camadas de KPI;
- composição do portfólio e alertas;
- qualidade, cobertura e limitações;
- resumo e seções executivas;
- origem da narrativa, modelo e versão do prompt;
- watermark da última fonte utilizada e responsável pela geração.

Ao gerar novamente o mesmo mês, a versão anterior fica como `superseded`; os números históricos não são reescritos.

### `insight_records`

Mantém o ledger auditável de cada insight:

- organização, período, relatório e entidade relacionada;
- categoria, severidade, confiança e recomendação;
- referências de evidência;
- método de geração: regra, IA assistida ou humano;
- modelo e prompt quando houver IA;
- estado de revisão, revisor e validade.

O ledger prepara a próxima etapa: aceitar, rejeitar ou expirar insights, medir a taxa de adoção das recomendações e relacionar cada ação ao resultado posterior.

## Comparativo mês a mês

O fechamento atual calcula e compara:

- score operacional consolidado;
- volume de execuções e taxa de sucesso;
- duração média e custo por execução;
- taxa de erro e de escalonamento;
- eficácia, eficiência, adoção, governança e valor;
- agentes ativos, novos e com telemetria;
- alertas ativos e críticos;
- distribuição dos vereditos;
- cobertura da amostra, confiança de avaliação e prontidão para decisão.

`Valor` não significa apenas dinheiro: a leitura combina aderência ao propósito, qualidade, escopo técnico, confiabilidade, adoção e, quando aplicável, impacto financeiro.

## Modelos executivos

1. **Board Brief** — evolução, riscos, decisões e pedidos objetivos ao board.
2. **Performance Review** — desempenho por camadas, portfólio e prioridades de melhoria.
3. **Risk & Governance** — evidências, guardrails, confiança e decisões pendentes.

Os três modelos compartilham o mesmo snapshot factual. Muda a hierarquia narrativa, não os números.

## Guardrails da narrativa assistida

- É opcional e possui fallback determinístico.
- Recebe somente agregados do tenant, não credenciais nem payloads brutos.
- Não pode introduzir números ausentes no payload factual.
- Não altera métricas, qualidade, portfólio, insights ou referências.
- Registra modelo e versão do prompt no snapshot.
- Deve permanecer em rascunho até revisão humana para comunicação externa.

## Teto de custo de IA

Os recursos de IA usam um ledger diário por organização (`ai_usage_daily`) e
degradam para o resultado determinístico quando não podem ser executados. A UI
exibe **"Sem insight de IA"** nesse caso; a operação não retorna 5xx nem
apresenta conteúdo sintético como factual.

| Variável | MVP | Finalidade |
| --- | --- | --- |
| `AI_MONTHLY_BUDGET_USD` | `20` | Teto global mensal em USD. O padrão é `0`: IA desligada. |
| `AI_DAILY_CALLS_PER_ORG` | `50` | Máximo diário de chamadas por organização. |
| `AI_MAX_OUTPUT_TOKENS` | `800` | Limite por resposta do provedor. |
| `AI_PRICE_INPUT_PER_MTOK` | conforme o modelo | Preço de entrada por um milhão de tokens, para estimar custo. |
| `AI_PRICE_OUTPUT_PER_MTOK` | conforme o modelo | Preço de saída por um milhão de tokens, para estimar custo. |
| `AI_INTEGRATIONS_OPENAI_MODEL` | conforme o provedor | Modelo permitido; não há fallback embutido. |

Também são necessários `AI_INTEGRATIONS_OPENAI_API_KEY` e
`AI_INTEGRATIONS_OPENAI_BASE_URL`. Sem modelo, chave, endpoint, preços ou teto
positivo, a IA permanece desligada. Para executar a integração de concorrência
localmente, use `RUN_AI_BUDGET_DB_TESTS=true` junto de uma base migrada.

## Ciclo operacional recomendado

1. Telemetria contínua alimenta eventos e evidências durante o mês.
2. Projeções determinísticas atualizam a visão operacional em tempo próximo do real.
3. O fechamento mensal cria um snapshot versionado com watermark e qualidade.
4. Regras geram insights factuais e vinculados a evidências.
5. A IA, quando habilitada, adapta somente a narrativa ao público escolhido.
6. O gestor revisa, publica e transforma recomendações aprovadas em ações com SLA.
7. O mês seguinte mede se a ação alterou o indicador esperado.

## Próximas evoluções

- Workflow de aceite/rejeição do insight com justificativa e owner.
- Agendamento automático de fechamento e distribuição do relatório.
- Exportação PPTX/PDF com identidade da organização.
- Comparação por área, squad, jornada, função e tecnologia de origem.
- Comentários executivos e aprovação antes da publicação.
- Memória longitudinal para relacionar ação, mudança e resultado.
- Avaliação automática da qualidade da própria narrativa de IA.
- RAG tenant-aware para relatórios com políticas, contratos e documentos do cliente.

## Critérios de confiança

Um relatório só deve orientar decisão sem ressalva quando:

- pelo menos 70% dos agentes ativos reportaram execução;
- a confiança média das avaliações é de pelo menos 70%;
- a amostra contém pelo menos 30 execuções;
- não há falha de isolamento de tenant ou de proveniência;
- todas as limitações relevantes estão explícitas.

Caso contrário, o Muster apresenta o relatório como diagnóstico parcial e indica quais dados faltam.
