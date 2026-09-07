# PRD — Muster Workforce Operating System

**Versão:** 1.4
**Status:** Baseline de produto em evolução controlada
**Data-base:** 6 de setembro de 2026
**Owner de produto:** a definir
**Owner técnico:** a definir

### Histórico da baseline

| Versão | Data | Decisão |
|---|---|---|
| 0.1 | 02/09/2026 | Tese, drivers, requisitos P0 e gates iniciais |
| 1.0 | 03/09/2026 | Lifecycle profissional, boards operacionais, work graph, control plane e NFRs |
| 1.1 | 03/09/2026 | Central de adoção, microdemos reais, novidades e radar editorial com proveniência |
| 1.2 | 04/09/2026 | Shell produtivo conectado às APIs, release unificado e gate do piloto de 05/09 |
| 1.3 | 05/09/2026 | Taxonomia multidimensional de autonomia, topologias multiagente e preparação para workforce twins |
| 1.4 | 06/09/2026 | Grupos de acesso contextuais, governança contínua e sinais de alucinação/regressão no control plane |

A V1 é o contrato de cobrança do produto. Mudanças continuam permitidas, mas
precisam registrar hipótese, driver afetado, impacto nos requisitos, owner e
evidência esperada. Evolução não significa adicionar escopo sem substituir ou
repriorizar outro compromisso.

### Regra de evolução do produto existente

O código, os fluxos e a direção visual já implementados são a baseline de
produto. Este PRD funciona como contrato para identificar e fechar lacunas; não
autoriza recriar o Muster em uma arquitetura, navegação ou conjunto paralelo de
telas. Cada entrega deve preservar o fluxo atual, substituir mocks por fontes
reais, conectar ações à persistência e ampliar cobertura sem regressão visual.

Uma tela existente somente pode ser substituída quando houver decisão explícita
de produto, migração compatível e evidência de ganho. Até lá, a estratégia é
evolução incremental no mesmo componente e no mesmo contrato de rota.

## 1. Decisão de produto

O Muster não será medido pela quantidade de telas, conectores listados ou
agentes cadastrados. O produto só entrega valor quando uma organização consegue
transformar trabalho de agentes e pessoas em uma operação governada:

```text
conectar → descobrir → contratar → observar → avaliar → decidir → agir → comprovar impacto
```

O Muster é o sistema operacional de gestão da força de trabalho de IA. Trata
agentes como profissionais digitais, com função, responsabilidades, autoridade,
supervisão, métricas, histórico e desenvolvimento. Equipes mistas e jornadas
end-to-end são unidades de operação; o agente isolado é uma unidade de análise.

### O que o Muster não é

- Não é apenas um dashboard de telemetria ou custos de LLM.
- Não é um catálogo de agentes sem execução observável.
- Não é um construtor genérico de agentes.
- Não é um ranking universal de produtividade.
- Não declara integração `live` sem autenticação, coleta e prova ponta a ponta.
- Não apresenta dados demonstrativos como se fossem dados do tenant.
- Não promete supervisão contínua sem SLO, retenção, alerta e recuperação.

## 2. Problema

Organizações adotam agentes em GitHub, plataformas de atendimento, provedores
cloud, runtimes locais e frameworks de orquestração sem uma camada comum para
responder:

1. Quem é este agente e para qual organização, área e equipe trabalha?
2. Qual função, propósito, escopo e resultado foram contratados?
3. O que está no backlog e quem executa, responde, aprova ou apoia?
4. Quais decisões são autônomas e quais exigem responsabilidade humana?
5. A jornada completa teve sucesso ou apenas uma etapa local parece saudável?
6. Quais métricas têm fonte, baseline, meta, janela, confiança e evidência?
7. O que mudou, por que importa e qual ação deve acontecer agora?
8. A recomendação foi aprovada, rejeitada ou ajustada? Quem age e até quando?
9. A intervenção melhorou o resultado no ciclo seguinte?
10. Os dados são reais, inferidos ou sintéticos e podem ser auditados?

Sem essas respostas, dashboards geram sensação de controle, mas não gestão.

## 3. Hipótese de valor

Se o Muster reduzir o tempo entre um sinal operacional e uma ação governada,
preservando contexto e evidência através de agentes, pessoas e sistemas, então
gestores conseguirão ampliar autonomia com risco controlado e provar o resultado
da força de trabalho híbrida.

### North Star

**Taxa de resultado governado (TRG)**

```text
execuções E2E que cumpriram outcome, SLA, evidência e política
----------------------------------------------------------------
execuções E2E elegíveis no período
```

A TRG não substitui as métricas de cada função. Ela mede se o sistema completo
cumpriu o contrato operacional. Custo ou retorno financeiro entram somente
quando forem parte do propósito daquela função.

### Métricas guardrail

- Zero vazamento de dados entre tenants e escopos autorizados.
- Zero decisão crítica sem ator, justificativa e trilha de auditoria.
- Zero indicador apresentado como real sem fonte e proveniência.
- Zero conector apresentado como ativo sem evento ou health check comprovado.
- Zero relatório vazio apresentado como conclusão válida.
- Zero ação autônoma fora da alçada contratada.

## 4. Usuários e trabalhos a realizar

| Persona | Trabalho principal | Decisão que o produto deve habilitar |
|---|---|---|
| Executivo | Entender capacidade, risco e resultado da força híbrida | Onde ampliar, recalibrar ou interromper autonomia |
| Gestor de área | Operar equipes, backlog, capacidade e outcomes | Quem faz o quê e onde agir hoje |
| Supervisor | Tratar exceções, alertas, qualidade e SLA | Aprovar, ajustar, rejeitar ou escalar |
| Owner de agente | Contratar função, KPIs e desenvolvimento | Se o profissional digital está apto a operar |
| Operador | Acompanhar tarefas e evidências | Qual é o próximo passo e prazo |
| Auditor | Reconstruir decisão, execução e acesso | Se política e evidência sustentam o resultado |
| Plataforma/Engenharia | Integrar runtimes e manter coleta | Se o pipeline é confiável e recuperável |

## 5. Drivers obrigatórios

Toda iniciativa deve apontar para pelo menos um driver. Uma entrega sem driver,
métrica e evidência não entra no backlog de produto.

### D0 — Loop completo da força de trabalho de IA

Este é o driver-mestre e o teste de coerência de todo o produto. O Muster deve
permitir que uma organização, independentemente da plataforma de origem:

1. cadastre ou descubra um agente e contrate propósito, responsabilidades,
   autonomia, métricas, baseline e owner;
2. receba telemetria real e contínua sobre execução, contexto, qualidade,
   eficiência, risco e resultado;
3. compare desempenho observado com o contrato estabelecido na admissão;
4. transforme desvios e evolução em decisão operacional de escalar, mentorar,
   recalibrar, suspender ou aposentar;
5. opere o agente no contexto real de trabalho: squad híbrida de desenvolvimento,
   profissional de negócio com seus agentes ou jornada A2A;
6. consolide resultado, risco, evidência, decisões e impacto em relatórios
   executivos rastreáveis.

O moat do Muster é fechar esse loop entre **contrato, trabalho, telemetria,
avaliação, decisão e resultado** em diferentes plataformas e topologias de
trabalho. Nenhuma tela, conector, KPI, recomendação ou relatório é considerado
completo se terminar sem próximo passo, owner, SLA, evidência e medição posterior.

**Métrica:** percentual de profissionais digitais com loop operacional completo.
**Gate:** um agente real de cada topologia prioritária percorre admissão → execução
→ avaliação → decisão → ação → relatório sem alteração manual de código ou banco.

### D1 — Tempo até primeiro valor

Um novo tenant deve conectar uma fonte suportada e observar o primeiro evento
real em até 15 minutos, sem alteração manual de banco ou código.

**Métrica:** mediana e p95 de `tenant_created → first_real_event`.
**Gate:** p50 ≤ 15 min; p95 ≤ 30 min em GitHub e SDK/webhook.

### D2 — Clareza de responsabilidade

Todo trabalho deve expor executor, accountable, apoiadores, autoridade,
próximo passo e prazo.

**Métrica:** percentual de itens ativos com contrato de responsabilidade completo.
**Gate:** 100% dos itens ativos; nenhum item bloqueado sem owner e razão.

### D3 — Resultado end-to-end

O produto deve medir jornadas completas e impedir que sucesso local esconda
falha no outcome final.

**Métrica:** TRG, sucesso por etapa, handoff e outcome final.
**Gate:** toda execução de jornada possui correlação, início, fim e veredito E2E.

### D4 — Evidência e confiança

Toda métrica, recomendação e decisão deve apontar para fonte, amostra,
freshness, lineage e nível de confiança.

**Métrica:** cobertura de evidência verificável.
**Gate:** 100% das decisões críticas e ≥ 95% dos indicadores operacionais.

### D5 — Ação fechada em loop

Alertas e recomendações só geram valor quando viram decisão, ação, owner, SLA e
medição antes/depois.

**Métrica:** percentual de recomendações com decisão e impacto posterior.
**Gate:** 100% das aprovadas geram ações; 100% das rejeitadas registram motivo e destino.

### D6 — Governança multi-tenant

Companhia, área, squad, grupo, usuário, agente e identidade de integração devem
formar uma cadeia única de escopo e auditoria.

**Métrica:** violações de autorização e cobertura de trilha.
**Gate:** zero acesso cruzado; 100% das mutações sensíveis auditadas.

### D7 — Portabilidade de runtime

O modelo de controle deve operar com cloud, SaaS, Docker, Kubernetes, vLLM e
runtime local sem tornar infraestrutura própria uma premissa para o cliente.

**Métrica:** paridade do contrato de eventos e ações entre runtimes.
**Gate:** GitHub, SDK/webhook e Docker/local completam o mesmo cenário E2E.

### D8 — Confiança operacional em escala

Ingestão, avaliação, replay e atualização da interface devem continuar
confiáveis sob carga, duplicidade, atraso e falha de provider.

**Métrica:** latência, backlog, erro, duplicidade, RTO e perda confirmada.
**Gate:** SLOs da seção 10 atendidos em baseline, stress e chaos.

### D9 — Evolução do profissional digital

O Muster deve transformar avaliação em desenvolvimento: mentorar, recalibrar,
promover, suspender ou aposentar um agente com critérios, ações e evidência.

**Métrica:** percentual de transições de lifecycle com plano e resultado comprovado.
**Gate:** 100% das promoções e aposentadorias possuem decisão humana, impacto,
plano de transição e trilha auditável.

### D10 — Controle operacional unificado

Gestores precisam operar equipes, jornadas e planos sem reconstruir contexto em
várias ferramentas. O Muster deve ser control plane, não necessariamente a
fonte original de todos os itens de trabalho.

**Métrica:** tempo entre detectar um desvio e atribuir uma ação executável.
**Gate:** p50 ≤ 2 min; cada ação preserva vínculo com agente, equipe, jornada,
KPI, sistema de origem e decisão.

### D11 — Adoção e gestão da mudança

Aprendizado inicial, evolução do produto e sinais relevantes do ecossistema
devem acelerar uso competente sem competir com a navegação operacional diária.

**Métrica:** tempo até concluir a primeira tarefa assistida, ativação da
funcionalidade após conteúdo e recorrência de retorno à central.
**Gate:** cada conteúdo termina em ação praticável; vídeo, release note e sinal
externo possuem versão, data, contexto e destino; nenhum feed é chamado de
tempo real sem fonte e freshness comprovadas.

## 6. Fluxo operacional canônico

### 6.1 Conexão e admissão

1. Selecionar origem real: GitHub, SDK/webhook, Docker/local ou adapter nativo.
2. Autenticar e executar health check.
3. Descobrir candidatos sem admiti-los automaticamente.
4. Executar pré-assessment de código, configuração, logs, ferramentas e riscos.
5. Rodar probe seguro ou ingerir evento verificável.
6. Revisar função, propósito, responsabilidades, autonomia e owner.
7. Selecionar KPIs e confirmar fórmula, baseline, meta, janela e fonte.
8. Admitir o agente com identidade de serviço e escopo mínimo.
9. Validar heartbeat, primeiro evento, freshness e evidência.
10. Operar em probation até atingir amostra e confiança mínimas.
11. Promover, recalibrar ou rejeitar a admissão.

Estados obrigatórios:

```text
not_started → configuring → validating → live
                              ↘ degraded → blocked
```

`template`, `contract_ready` e `planned` nunca equivalem a `live`.

### 6.2 Operação diária

1. Receber eventos e heartbeats.
2. Correlacionar execução com agente, contrato, equipe, backlog e jornada.
3. Atualizar KPIs e qualidade dos dados.
4. Detectar desvio, risco, atraso ou quebra de handoff.
5. Explicar impacto e evidência.
6. Propor ação dentro dos direitos de decisão.
7. Registrar aprovação, ajuste, rejeição ou escalonamento.
8. Executar automaticamente apenas dentro da alçada autorizada.
9. Acompanhar owner, SLA, estado e evidência da ação.
10. Comparar baseline, antes/depois e resultado final.

### 6.3 Lifecycle do profissional digital

O lifecycle não é um rótulo manual. Cada transição exige critérios, autoridade,
ações operacionais e evidência.

```text
candidate → probation → active → performance_plan → active
                            ↘ suspended → active
                            ↘ retired
```

- **Candidate:** descoberto, ainda sem contrato ou acesso operacional.
- **Probation:** contrato aprovado, autonomia limitada e amostra em formação.
- **Active:** apto dentro da função, autonomia e limites vigentes.
- **Performance plan:** possui lacuna tratável e plano de mentoria ativo.
- **Suspended:** execução bloqueada por risco, segurança ou decisão do owner.
- **Retired:** identidade operacional encerrada, acessos revogados e histórico preservado.

Promoção não é apenas um estado. Ela gera uma nova versão de nível, escopo ou
autonomia e mantém o agente `active` após aprovação. Rebaixamento ou
recalibração seguem o mesmo princípio.

#### Mentorar

1. Sinal ou avaliação identifica uma lacuna ligada ao contrato da função.
2. Supervisor confirma que a causa é tratável e não falha de dado ou sistema.
3. Plano define baseline, alvo, janela, ações, owner e risco.
4. Ações entram no Kanban e podem ser executadas por pessoa, agente ou Muster.
5. Evidências e KPIs são recalculados durante a janela.
6. Revisão decide encerrar, estender, promover, suspender ou aposentar.

#### Promover

- Meta atingida por janelas consecutivas e amostra mínima.
- Nenhuma violação crítica aberta.
- Novo escopo e autonomia explicitamente versionados.
- Plano de rollback definido.
- Aprovação humana obrigatória no primeiro release.

#### Aposentar

- Motivo, effective date e autoridade registrados.
- Backlog e jornadas recebem novo owner antes do encerramento.
- Credenciais, schedules e permissões são revogados.
- Handoffs e dependências são validados.
- Histórico, evidências e relatórios permanecem conforme retenção.
- Reativação exige novo assessment e nova versão de contrato.

## 7. Requisitos funcionais P0

### RF-01 — Organização, escopo e acesso

- CRUD de organização, área, squad, grupo de trabalho e memberships.
- Papéis por organização, área e equipe.
- Identidades separadas para humanos, agentes e integrações.
- Convite, remoção e mudança de escopo persistentes.
- Auditoria append-only de acesso e configuração.

**Aceite:** owner administra a estrutura; supervisor opera somente seu escopo;
observer não altera dados; testes provam isolamento em API, banco e relatório.

### RF-02 — Conectores baseados em capacidade real

- Máquina de estados persistida por conexão.
- GitHub nativo, SDK/webhook universal e Docker/local como caminhos suportados.
- Health check, credencial cifrada, rotação e último evento.
- Templates de AWS, Azure, GCP, Zendesk, Agentforce e frameworks claramente
  classificados como template, contrato ou adapter live.
- Diagnóstico copiável com causa e próxima ação.

**Aceite:** o usuário vê o primeiro evento real e consegue diferenciar ausência
de configuração, falha de autenticação, ausência de atividade e degradação.

### RF-03 — Discovery e pré-assessment

- Descoberta não cria agentes automaticamente.
- Análise de repositório, manifests, prompts, tools, subagentes e telemetria.
- Leitura de logs/traces quando autorizada.
- Campos sugeridos com confiança, fonte e lacunas.
- Probe de execução separado da análise estática.

**Aceite:** nenhum draft é promovido sem revisão explícita; o sistema nunca usa
ausência de erro estático como prova de qualidade operacional.

### RF-04 — Contrato do profissional digital

- Identidade, plataforma e runtime.
- Função, propósito, responsabilidades e resultado esperado.
- Owner humano e equipe.
- Direitos de decisão, limites de autonomia e guardrails.
- KPIs, cadência de avaliação, SLA e probation.
- Versão do contrato e histórico de alterações.

**Aceite:** agente sem contrato completo permanece em draft ou probation.

### RF-05 — Catálogo e contrato de KPI

- Catálogo por domínio e starter kits.
- KPI customizado com fórmula validável.
- Vínculo a agente, equipe, jornada e propósito.
- Fonte, baseline, meta, direção, janela, owner e política de confiança.
- Distinção entre observado, inferido e sintético.
- Estado `insufficient_data` quando amostra ou cobertura forem inadequadas.

**Aceite:** toda métrica exibida tem contrato e drill-down até a evidência.

### RF-06 — Equipes mistas e backlog

- Propósito, outcome, Definition of Done, cadência e guardrails da equipe.
- Backlog por épico, história e tarefa.
- Prioridade, estado, progresso, dependência, evidência e prazo.
- Executor, accountable, apoiadores e aprovador.
- Separação entre trabalho autônomo, assistido e humano.
- Capacidade, WIP, carga, bloqueios e foco atual por participante.
- Board operacional com `backlog`, `ready`, `in_progress`, `blocked`,
  `validation` e `done`.
- Calendário de ações pré-programadas, rotinas recorrentes e compromissos futuros.
- Impacto esperado, risco e dependências de cada atividade.
- Visão de comando com desvios, decisões pendentes e próximos SLAs.
- Integração com sistemas de trabalho ou API universal.

**Aceite:** o gestor responde em uma tela o que está em curso, quem faz, quem
responde, onde está bloqueado, o que acontecerá depois e qual resultado encerra
o compromisso. Toda movimentação do board é persistida e auditada.

### RF-07 — Jornadas end-to-end

- Jornada ligada a equipe, backlog, participantes e outcome.
- Etapas com owner, SLA, limite de WIP, critério de entrada e saída.
- Handoff com contexto mínimo, evidência, aceite e timeout.
- Correlação de runs, tarefas, decisões e subagentes.
- Sucesso local, sucesso E2E, gargalo e vitória ilusória.
- Reprocessamento, fallback e encerramento explícito.
- Backlog e plano de ação visíveis dentro de cada etapa.
- Visão do caminho crítico, dependências, previsão de conclusão e impacto de atraso.
- Comparação entre fluxo planejado e fluxo realmente executado.

**Aceite:** selecionar uma etapa filtra dados persistidos da jornada; cards e
totais conciliam com a API; o gestor identifica caminho crítico, próximo owner e
impacto do atraso; nenhuma jornada produtiva usa fixtures do frontend.

### RF-08 — Supervisão contínua

- Heartbeat, eventos, outbox, worker, replay e dead-letter.
- Polling/SSE com cursor e retomada.
- Freshness, cobertura, backlog e estado do worker visíveis.
- Alertas de stale, guardrail, backlog, erro e perda de handoff.
- Política de retenção e amostragem.

**Aceite:** a interface diferencia `live`, `stale`, `degraded`, `unknown` e
`insufficient_data`; atraso de processamento nunca aparece como falha do agente.

### RF-09 — Recomendação, decisão e ação

- Recomendação com causa, impacto, confiança, evidência e opções.
- Decisões `approved`, `adjustment_requested`, `rejected` e `escalated`.
- Ações ordenadas para Muster, agente ou pessoa.
- Owner, SLA, dependência, modo de execução e critério de conclusão.
- Estados `todo`, `ready`, `in_progress`, `blocked`, `validation`, `done` e
  `cancelled`, com política explícita de transição.
- Execução imediata, agendada ou recorrente.
- Impacto esperado sobre KPIs, jornada, capacidade, risco e autonomia.
- Rejeição exige motivo e destino: arquivar, recalibrar ou criar alternativa.
- Medição antes/depois e encerramento do loop.

**Aceite:** feedback visual local não conta como operação; toda ação sobrevive a
reload, reaparece no histórico e produz evento auditável.

### RF-10 — Relatórios executivos

- Data Readiness Check antes da geração.
- Visão por organização, área, equipe, jornada e agente.
- Propósito, qualidade, eficiência, eficácia, adoção, custo opcional e risco.
- Evolução mês a mês, baseline, meta e coorte comparável.
- Decisões necessárias, ações abertas e impacto concluído.
- Lifecycle: agentes em probation, mentoria, suspensão, promoção e aposentadoria.
- Capacidade, WIP, caminho crítico e compromissos futuros das equipes.
- Saúde do control plane: cobertura, freshness, backlog e conectores degradados.
- HTML interativo e PDF conciliados.
- IA limitada a fatos recuperáveis, com citações e confiança.

**Aceite:** relatório nunca sai vazio silenciosamente; totais conciliam com
consultas de referência e todo insight chega à evidência ou declara limitação.

### RF-11 — Mentoria, promoção, suspensão e aposentadoria

- Lifecycle persistido conforme a seção 6.3.
- Plano de mentoria ligado a função, avaliação, lacuna e KPIs afetados.
- Critério de entrada, baseline, alvo, janela e responsável pela revisão.
- Promoção versiona nível, escopo, autonomia e contrato.
- Suspensão revoga execução preservando investigação e evidência.
- Aposentadoria transfere backlog, jornadas, schedules e ownership antes de
  revogar credenciais.
- Histórico profissional e comparação antes/depois.

**Aceite:** nenhuma transição ocorre apenas na interface; reload preserva o
estado, todas as dependências têm destino e a decisão pode ser reconstruída.

### RF-12 — Kanban de ações operacionais

Cada card representa trabalho governado, não uma anotação visual. Deve conter:

- origem: alerta, recomendação, avaliação, auditoria ou rotina;
- vínculo: organização, equipe, jornada, agente e KPI;
- tipo: correção, mentoria, promoção, integração, investigação ou governança;
- ator: Muster, agente ou pessoa;
- owner, accountable, apoiadores e aprovador;
- estado, prioridade, SLA, agenda, recorrência e dependências;
- instrução executável, limites, rollback e critério de conclusão;
- impacto esperado e impacto realizado;
- evidências de entrada, execução e validação.

O board deve oferecer visão por equipe, jornada, profissional, owner, prazo,
risco e lifecycle. Automação pode mover estados somente quando a política da
ação permitir.

```text
todo → ready → in_progress → validation → done
  └──────────────→ blocked ───────────────┘
  └────────────────────────→ cancelled
```

- `ready` exige owner, instrução, critério de conclusão e dependências resolvidas.
- `in_progress` registra ator, início e execução relacionada.
- `blocked` exige motivo, desbloqueador e novo SLA.
- `validation` exige evidência de execução e aprovador quando aplicável.
- `done` exige resultado e impacto observado ou janela futura agendada.
- `cancelled` exige motivo e tratamento das dependências.

**Aceite:** criar, atribuir, agendar, iniciar, bloquear, validar e concluir
persistem eventos; itens vencidos e bloqueados aparecem no comando e relatório.

### RF-13 — Regressão, contexto e inputs

- Run correlacionado com versão do agente, modelo, prompt, tools e release.
- Classe e hash do input; conteúdo bruto negado por padrão.
- Manifesto de fontes de contexto com versão, freshness, autorização e relevância.
- Baseline por função, workload e configuração comparáveis.
- Regressão separada em resultado, comportamento, operação, contexto, jornada e impacto humano.
- Detecção de drift para evitar atribuir mudança de workload ao agente.
- Estado `insufficient_data` quando amostra, cobertura ou confiança forem inadequadas.
- Replay, shadow, canary, aprovação humana e rollback ligados ao plano de ação.

**Aceite:** uma mudança controlada de versão produz comparação atribuível; uma
mudança apenas na distribuição de inputs aparece como drift; nenhum prompt ou
contexto sensível é coletado sem política explícita do tenant.

### RF-14 — Work graph e integrações operacionais

O Muster mantém um grafo de trabalho correlacionado, mas respeita a fonte de
verdade de cada objeto.

| Objeto | Fonte provável | Papel do Muster |
|---|---|---|
| Épico, história, ticket | Jira, Linear, GitHub, Zendesk, Asana, ClickUp | Referenciar, observar e correlacionar |
| Documento e decisão | Confluence, Notion, SharePoint | Indexar referência, versão e evidência autorizada |
| Execução do agente | SDK, webhook, OTLP, framework ou provider | Ingerir e avaliar |
| Plano de ação | Muster ou sistema externo escolhido | Governar estado, owner, SLA e impacto |
| Identidade e acesso | IdP e Muster | Aplicar escopo e auditar |

Cada conector declara capacidades separadas:

```text
discover | read_work | read_execution | read_evidence
create_work | update_work | execute_action | receive_feedback
```

- Sincronização usa IDs externos, cursor, idempotência e checkpoint.
- Conflitos seguem uma política de source-of-record por campo.
- Escrita externa exige escopo, aprovação e dry-run quando suportado.
- Falha externa não pode bloquear consulta do estado já persistido.
- O usuário vê freshness, último sync, backlog, erro e capacidade disponível.

**Aceite:** um item externo é correlacionado sem duplicação; atualização e
retomada preservam cursor; nenhuma capacidade é exibida antes de ser provada.

### RF-15 — Control plane operacional

- Visão hierárquica: companhia → área → equipe → jornada → profissional → ação.
- Pulso de eventos, filas, workers, conectores e freshness.
- Capacidade e WIP planejado versus realizado.
- Decisões pendentes por risco, autoridade e SLA.
- Command palette e busca por agente, item, jornada, evidência ou incidente.
- Drill-down sem perder filtros e contexto.
- Modo degradado que mantém leitura e sinaliza funções indisponíveis.
- Relatório executivo utiliza o mesmo modelo e os mesmos totais.

**Aceite:** o gestor identifica em até 60 segundos os três maiores riscos, seus
owners e próximas ações; o relatório reconcilia exatamente com o control plane.

### RF-16 — Central de adoção e evolução

- Separar o onboarding obrigatório de configuração (`/onboarding`) da central
  consultável de aprendizado (`/guia`).
- Remover aprendizado da navegação operacional principal e oferecer acesso
  utilitário por `Aprender`, `Novidades` e atalho responsivo, com rotas
  canônicas `/guia`, `/guia/novidades` e `/guia/radar`.
- Microdemos reais, versionadas e geradas em HyperFrames para contrato,
  conexão, métricas, avaliação, equipes e jornadas.
- Cada microdemo contém objetivo, evidência visual, resultado esperado e deep
  link para praticar na funcionalidade.
- Release notes possuem data, categoria, mudança, impacto e destino no produto.
- Radar do ecossistema exige fonte oficial, data e implicação explícita para o Muster.
- Progresso é isolado por usuário e organização; armazenamento local é apenas
  estágio de protótipo e deve migrar para persistência tenant-scoped.
- Vídeos oferecem controles, poster, legenda/transcrição e fallback acessível.

**Aceite:** `/guia` não aparece no menu operacional; todos os vídeos carregam,
terminam e registram progresso; os destinos existem; nenhum conteúdo externo é
exibido sem fonte ou com promessa falsa de atualização contínua.

### RF-17 — Autonomia, topologia e confiança operacional

- Classificar cada agente por natureza da inteligência: preditiva, generativa e/ou agêntica.
- Separar topologia `assistant|agent|multi_agent|mixed_team` do nível de autonomia.
- Classificar especialização `vertical|horizontal` e atuação `digital|cyber_physical|physical`.
- Versionar autonomia de L0 a L5 no contrato, sem permitir autoridade irrestrita.
- Definir direitos por classe de ação: executar, recomendar, aprovar, escalar, bloquear e auditar.
- Registrar criticidade, reversibilidade, limite, rollback, kill switch e owner humano.
- Modelar supervisor horizontal, especialistas verticais e verificador independente nas jornadas.
- Avaliar cada execução pelos pilares Direction, Protection e Proof; nenhum score isolado substitui guardrail.
- Preparar replay, shadow e canary como base do Workforce Twin, sem criar pipeline paralelo.

**Aceite:** dois agentes com a mesma topologia e autonomias diferentes não são
confundidos; uma ação irreversível respeita a política mesmo em L5; toda
delegação preserva missão, limite, contexto, evidência e responsável; promoção
é bloqueada quando governança, segurança ou prova estiverem abaixo do contrato.

### Modelo mínimo de domínio operacional

```text
Organization
  └── Area
      └── Team
          ├── Membership (human | agent)
          ├── WorkItem → ExternalReference
          └── Journey
              ├── JourneyStage → HandoffContract
              └── JourneyRun → ExecutionEvent → Evidence

Agent → ProfessionalContract → KpiContract → Evaluation
Agent → LifecycleEvent → DevelopmentPlan
Signal → Recommendation → Decision → ActionCard → ImpactMeasurement
Agent → CapabilityProfile → DecisionRight → TrustEnvelope
Journey → SharedContextPolicy → SimulationRun
```

Regras:

- `ActionCard` é o objeto único para ações de recomendação, mentoria,
  lifecycle, incidente, auditoria e rotina.
- `WorkItem` descreve o trabalho do domínio; `ActionCard` descreve a resposta
  governada a um sinal ou compromisso. Um pode referenciar o outro.
- `LifecycleEvent`, `Decision` e transições de `ActionCard` são append-only.
- Projeções atuais podem ser atualizadas, mas o histórico que as formou não é apagado.
- Toda entidade operacional carrega `orgId`, timestamps, ator e versão.

## 8. Estado atual versus requisito

| Área | Evidência atual | Avaliação PRD |
|---|---|---|
| Autenticação | Clerk real; bypass desativado; navegação autenticada validada no browser | Parcial: falta `storageState` de teste para automatizar a sessão Clerk no CI |
| Tenancy | Organização ativa, Admin Console, filtros tenant-scoped e grupos de acesso por organização, área ou equipe | Parcial: as permissões contextuais ainda não protegem todas as mutações do produto |
| Equipes | Shell produtivo usa API e permite criar equipe com propósito | Parcial: membros, alçadas e backlog ainda não fecham o modelo completo |
| Jornadas | Shell produtivo usa API CRUD, monitor e recomendações | Parcial: falta reconciliação completa com backlog e board unificado |
| Conectores | GitHub e contrato universal; secrets e ingestão | Parcial: adapters amplos ainda são templates/contratos |
| Discovery | GitHub e pre-assessment heurístico | Parcial: não prova execução real do agente |
| Métricas | Catálogo, kits, contratos, telemetria e herança/criação governada durante a admissão | Parcial: falta versionar alterações e recalcular impacto nos contratos já ativos |
| Telemetria | Eventos, heartbeat, outbox, worker, SSE e projeção contínua com polling visual de 5 s | Parcial: falta comprovar SLO, retenção e fan-out em carga de produção |
| Regressão e contexto | Avaliação correlaciona release, coorte de input, fontes de contexto, grounding e drift | Parcial: falta padronizar adapters externos no mesmo envelope e provar replay/canary em escala |
| Autonomia e topologia | Contratos, equipes e jornadas registram autonomia em campos dispersos | Reprovado: falta perfil multidimensional, direito por ação e Trust Envelope |
| Decisões | Fluxos de plano e recomendação persistidos | Parcial: nem todos os novos CTAs usam essas APIs |
| Lifecycle | Probation e decisões pontuais existem em superfícies diferentes | Reprovado: mentoria, promoção, suspensão e aposentadoria não formam máquina de estados |
| Board de ações | Ações de veredito e recomendações possuem persistência | Parcial: não existe Kanban operacional unificado por equipe e jornada |
| Work graph | APIs de equipes, jornadas e referências externas existem | Parcial: backlog externo e source-of-record ainda não estão unificados |
| Control plane | Shell novo exibe Direction, Protection, Proof, saúde de contexto, risco de alucinação, regressão e cobertura | Parcial: lifecycle, board e reconciliação integral continuam pendentes |
| Adoção | Central separada, microdemos HyperFrames e conteúdo curado | Parcial: progresso ainda local e faltam legendas, backend editorial e analytics de ativação |
| Relatório | Snapshot tenant-scoped | Reprovado quando vazio ou sem narrativa e drill-down |
| Gauntlet | 275 testes de API, integrações PostgreSQL 15/15, Playwright público 62/62 e Admin Console autenticado verificado | Parcial: falta sessão Clerk automatizada, carga distribuída e chaos recorrente |

### Falhas que bloqueiam promoção

1. Membros, alçadas e backlog da equipe ainda não fecham um fluxo operacional
   completo no novo shell.
2. Testes públicos e unitários não substituem a prova E2E autenticada com banco,
   APIs, reload, isolamento e reconciliação.
3. Mentoria, promoção e aposentadoria ainda não possuem lifecycle transacional,
   impacto previsto, transferência de trabalho e revogação coordenada.
4. Não há um board único que consolide ações de alertas, recomendações,
   lifecycle, rotinas e governança.
5. SLOs, carga e chaos ainda não foram comprovados no ambiente público do piloto.
6. Direitos por ação e grupos contextuais ainda precisam ser aplicados a todas as
   APIs de mutação; hoje o modelo está ativo na gestão de acesso e em equipes.

## 9. Requisitos não funcionais

### Segurança e privacidade

- Autenticação obrigatória fora de rotas públicas.
- Negação por padrão e menor privilégio.
- Segredos cifrados e nunca devolvidos em plaintext.
- Tenant derivado da sessão, nunca de parâmetro confiado do cliente.
- Auditoria de configuração, decisão, ação e acesso.
- RLS após adoção de transação request-scoped e role sem `BYPASSRLS`.

### Integridade

- Idempotência por evento externo e escopo do tenant.
- Delivery `at-least-once` com projeções determinísticas.
- Correlação obrigatória entre execução, agente, contrato e jornada.
- Totais da UI, relatório e API reconciliáveis.
- Fixtures permitidas apenas em laboratório explicitamente identificado.

### Portabilidade

- Mesmo envelope de identidade, evento, evidência, métrica e ação em todos os runtimes.
- Collector próximo da execução quando dados não puderem sair do ambiente.
- Cloud fallback opcional e regido por política, nunca obrigatório.

### Performance e experiência

- Listas, boards e timelines usam paginação/cursor e virtualização quando necessário.
- Filtros são server-side para conjuntos operacionais; o frontend não baixa o tenant inteiro.
- Atualizações otimistas somente em transições reversíveis e idempotentes.
- Estado anterior permanece legível durante refresh; não usar telas vazias intermitentes.
- Busca e navegação preservam organização, equipe, jornada, período e filtros.
- Operações longas são assíncronas, observáveis e canceláveis quando seguro.
- Vídeos usam `preload=metadata`, poster local e carregamento sob demanda; abrir
  a central não pode baixar toda a biblioteca.

Metas de experiência no envelope piloto:

- LCP p75 ≤ 2,5 s em desktop e ≤ 3,5 s em mobile corporativo.
- INP p75 ≤ 200 ms.
- Troca de coluna/filtro com confirmação local ≤ 100 ms e confirmação persistida
  conforme SLO de escrita.
- Primeira página operacional ≤ 100 itens; demais itens por cursor.

### Disponibilidade e resiliência

- Control plane e data plane falham de forma independente.
- Collector local mantém buffer cifrado por até 24 horas quando offline.
- Conector usa timeout, retry limitado, circuit breaker e dead-letter.
- Worker pode escalar separado da API sem alterar contrato.
- Degradação de um provider não interrompe outras equipes ou tenants.
- Backup, restore e disaster recovery são testados, não apenas documentados.

### Observabilidade do próprio Muster

- Métricas RED para APIs e USE para workers/filas.
- Traces correlacionam request, tenant, connector, event, evaluation e action.
- Logs estruturados sem segredo ou payload sensível.
- Alertas para erro, saturação, lag, stale, dead-letter e falha de reconciliação.
- SLOs, burn rate e incidentes visíveis no control plane administrativo.

### Acessibilidade e consistência

- WCAG 2.2 AA nas jornadas críticas.
- Operação completa por teclado para tabelas, boards, filtros e dialogs.
- Estados não dependem apenas de cor.
- Formatação de data, número, moeda e timezone é explícita por tenant.
- Componentes de equipe, jornada, profissional e relatório compartilham o mesmo
  vocabulário e semântica de status.
- Mídia instrucional possui controles, foco visível, transcrição e legenda em português.

## 10. SLOs para promoção

| Sinal | Meta inicial |
|---|---:|
| API de leitura do control plane p95 | ≤ 500 ms |
| Mutação operacional persistida p95 | ≤ 800 ms |
| Busca operacional p95 | ≤ 1 s |
| Ingestão de evento p95 | ≤ 500 ms |
| Erro/escalonamento visível p95 | ≤ 3 s |
| Execução normal projetada p95 | ≤ 10 s |
| Freshness da UI p95 | ≤ 15 s |
| Movimento do Kanban reconciliado p95 | ≤ 2 s |
| Propagação de sync externo p95 | ≤ 60 s, conforme provider |
| Evento duplicado contado duas vezes | 0 |
| Perda confirmada em restart/replay | 0 |
| Backlog sem alerta | ≤ 60 s acima do limiar |
| Recuperação do worker | ≤ 2 min |
| Disponibilidade mensal do control plane | ≥ 99,9% no ambiente suportado |
| RPO / RTO do estado operacional | ≤ 5 min / ≤ 30 min |
| LCP / INP p75 | ≤ 2,5 s / ≤ 200 ms |
| Isolamento tenant | 100% |
| Decisão crítica auditada | 100% |
| Divergência UI/API/relatório | 0 nos gates críticos |

Essas metas são gates de promoção, não promessas públicas até serem comprovadas
em ambiente equivalente ao de produção.

### Envelope inicial de capacidade

O primeiro benchmark de promoção deve provar, sem extrapolação comercial:

- 20 organizações simultâneas;
- até 500 profissionais digitais por organização;
- 100 usuários concorrentes no control plane;
- 2.000 eventos por minuto por organização em carga sustentada;
- 10.000 itens de trabalho consultáveis por equipe via cursor;
- stress de 2× por 30 minutos e recuperação sem perda.

O envelope deve crescer somente depois que testes mostrarem o próximo gargalo.
Capacidade não medida não pode ser apresentada como suportada.

## 11. Gates de entrega

### G0 — Verdade dos dados

- Dados reais, inferidos e sintéticos identificados.
- Laboratório opt-in no tenant autenticado.
- Relatório com preflight e reconciliação.

**Aprovação:** zero total vazio silencioso e drill-down até a fonte.

### G1 — Estrutura e autoridade

- Hierarquia persistida, memberships, RBAC e auditoria.
- Owner, supervisor, operator e observer testados.

**Aprovação:** isolamento por tenant, área e equipe comprovado.

### G2 — Primeiro agente real

- GitHub ou SDK/webhook percorre discovery, assessment, probe e admissão.
- Heartbeat e primeiro evento aparecem na UI.

**Aprovação:** tempo até primeiro valor atende D1.

### G3 — Operação de equipe e jornada

- Novo shell consome APIs de equipe, backlog, jornada e monitor.
- Reload preserva criação, filtros, decisões e ações.
- Handoffs e responsabilidades são reconciliados.
- Board operacional unifica backlog, rotinas e ações com estados persistidos.
- Visão planejado versus realizado identifica caminho crítico e impacto de atraso.

**Aprovação:** cenários estáticos removidos das rotas produtivas.

### G4 — Decisão fechada em loop

- KPI dispara sinal, recomendação, decisão e ações.
- Resultado posterior confirma ou refuta a intervenção.
- Mentoria, promoção, suspensão e aposentadoria usam o mesmo Kanban e trilha.
- Aposentadoria prova transferência de trabalho e revogação de acesso.

**Aprovação:** 100% do fluxo auditável e reproduzível.

### G5 — Gauntlet de promoção

- Tenant descartável autenticado.
- Agentes de negócio, engenharia e operação.
- Baseline, stress e chaos em local e Docker.
- Replay, duplicidade, restart, stale, provider failure e isolamento.
- Relatório, screenshots, traces e consultas de conciliação.
- Envelope de capacidade e Web Vitals da seção 10 comprovados.

**Aprovação:** zero P0/P1, SLOs atendidos e 100% das jornadas críticas aprovadas.

## 12. Estratégia de testes

| Camada | Deve provar | Evidência |
|---|---|---|
| Unitário | estados, fórmulas, políticas e transições | relatório de testes |
| Contrato | OpenAPI, envelope e compatibilidade de adapters | schema diff + fixtures |
| Integração | tenant, persistência, outbox, idempotência e auditoria | PostgreSQL real |
| E2E autenticado | jornada completa no novo shell | Playwright + storage state protegido |
| Lifecycle | mentoria, promoção, suspensão, aposentadoria e transferência | estados + auditoria + reload |
| Board | transição, concorrência, agenda, recorrência e SLA | E2E + relógio controlado |
| Integração | cursor, conflito, rate limit, retry e retomada | sandbox + contract tests |
| Reconciliação | UI e relatório iguais ao banco/API | queries e snapshots |
| Carga | throughput, p95, backlog e recuperação | scorecard do Gauntlet |
| Chaos | provider, rede, worker e restart | timeline e perda confirmada |
| Segurança | RBAC, tenant e secrets | testes negativos e auditoria |
| UX | clareza, conclusão e recuperação de erro | roteiro com usuários-alvo |
| Adoção | mídia real, deep links, progresso por tenant e release notes | Playwright + inspeção de mídia |
| Performance web | LCP, INP, memória e grandes listas | Lighthouse + browser tracing |

### Definition of Done de qualquer feature

Uma feature só está concluída quando:

1. está ligada a um driver e requisito deste PRD;
2. usa dados persistidos ou está marcada como laboratório;
3. possui estado vazio, loading, erro, sucesso e recuperação;
4. respeita tenant, RBAC e auditoria;
5. possui evento e telemetria operacional;
6. tem testes unitários, integração ou E2E adequados ao risco;
7. sobrevive a reload e retomada quando altera estado;
8. possui critério de reconciliação com a fonte;
9. não introduz CTA sem efeito operacional;
10. atualiza documentação e evidência de validação.

## 13. Fora do escopo inicial

- Marketplace aberto de agentes.
- Folha de pagamento ou vínculo trabalhista literal.
- Execução arbitrária de código sem sandbox e política.
- Autonomia irrestrita para decisões críticas.
- Adapter nativo para todo provider listado no catálogo.
- Benchmark universal entre funções ou contextos incomparáveis.
- Substituição de Jira, Zendesk, observabilidade ou plataformas de execução.
- Treinamento de world models, políticas robóticas ou controle direto de atuadores.
- Engine própria de imitation learning; o Muster governa demonstração, avaliação e promoção.

## 14. Sequenciamento obrigatório

1. Verdade dos dados, contrato de contexto e sessão E2E autenticada.
2. Novo shell conectado às APIs já existentes de equipes e jornadas.
3. Hierarquia, RBAC e responsabilidade persistentes.
4. Work graph e Kanban operacional persistidos.
5. Conexão/admissão real com primeiro evento e versão de release.
6. Baseline comparável, drift e regressão atribuível.
7. Perfil de autonomia, direitos por ação e Trust Envelope.
8. KPI, recomendação, decisão, ação e impacto.
9. Lifecycle de mentoria, promoção, suspensão e aposentadoria.
10. Control plane e relatório executivo reconciliados.
11. Escala, performance web, chaos e promoção.

A Central de Adoção começa no passo 1 e é atualizada como evidência de cada
entrega; ela não cria uma trilha paralela de features nem substitui os gates.

Não deve haver nova rodada ampla de redesign antes de G3. Ajustes visuais são
permitidos quando removem ambiguidade ou habilitam o fluxo; não substituem
persistência, integração ou teste.

## 15. Governança do PRD

### Ritual semanal

- Revisar North Star, drivers e guardrails.
- Atualizar estado de cada requisito: `not_started`, `in_progress`, `validated`,
  `blocked` ou `rejected`.
- Anexar evidência reproduzível para qualquer item `validated`.
- Registrar decisões de escopo, responsável e data.
- Reabrir requisito quando teste, métrica ou usuário contradizer a validação.

### Regra de cobrança

Uma afirmação como “implementado”, “funcional”, “real time”, “integrado” ou
“pronto para produção” só é aceita quando existe:

```text
requisito → código → teste → execução → evidência → métrica → owner
```

Sem essa cadeia, o estado correto é `demonstrativo`, `parcial` ou `não validado`.

## 16. Decisões pendentes do owner de produto

1. Primeiro ICP: engenharia, atendimento ou profissional com agentes?
2. Qual jornada será a prova principal do MVP?
3. Laboratório opt-in ou importação autorizada dos dados legados?
4. Quais ações o Muster poderá executar autonomamente no primeiro release?
5. Quais três integrações serão adapters nativos depois de GitHub e SDK/webhook?
6. Qual ambiente será considerado equivalente à produção para os SLOs?
7. Quem aprova G0–G5 e possui autoridade para bloquear a promoção?
8. O Kanban do Muster será source-of-record das ações ou sincronizará escrita
   bidirecional com uma ferramenta escolhida por tenant?
9. Quais níveis profissionais e aumentos de autonomia uma promoção pode conceder?
10. Quem pode suspender, aposentar e reativar um agente em cada escopo?
11. O envelope inicial de capacidade da seção 10 representa o piloto pretendido
    ou precisa ser ajustado antes do Gauntlet?
12. `BP` significa Business Partner nesta oferta e qual função compradora deve
    ser validada primeiro: RH, operações, risco ou transformação?

Até essas decisões serem registradas, o produto deve otimizar para o fluxo
universal e evitar especialização prematura em um único domínio.
