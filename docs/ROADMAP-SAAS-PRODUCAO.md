# Roadmap SaaS de produção do Muster

Atualizado em 16 de setembro de 2026.

## Objetivo

Transformar o Muster em uma plataforma SaaS plug-and-play para cadastrar,
instrumentar, monitorar e governar agentes de diferentes plataformas, com
operação em tempo real, decisões auditáveis, gestão do trabalho e prontidão
comercial comprovada.

Este roadmap evolui o produto existente. Ele não autoriza reescrever o Muster,
criar telas sem continuidade operacional ou chamar de integração um catálogo
sem autenticação, coleta e teste ponta a ponta.

## Resultado de produção

Uma organização deve conseguir, sem suporte de engenharia:

1. criar seu tenant, convidar pessoas e configurar grupos e permissões;
2. escolher um conector ou o SDK universal;
3. descobrir e pré-qualificar um agente;
4. definir propósito, responsabilidade, autonomia, KPIs e guardrails;
5. executar um probe e receber o primeiro evento real em até 15 minutos;
6. acompanhar execuções, threads, atividade, backlog, custo, qualidade e risco;
7. receber uma recomendação e aprovar, ajustar ou rejeitar com próximo passo;
8. acompanhar o plano de ação e confirmar o impacto posterior;
9. operar o agente em equipe híbrida ou jornada A2A;
10. gerar relatório executivo reconciliado e auditável.

## Definição de plug-and-play

Um caminho só pode ser apresentado como plug-and-play quando possui:

- autenticação ou credencial de serviço validada;
- discovery real ou cadastro explícito por contrato;
- teste de conectividade e probe seguro;
- mapeamento de identidade, execução, evidência e métricas;
- heartbeat, freshness, cobertura e diagnóstico;
- instruções específicas para cloud, local, Docker e on-premise;
- retry, idempotência, circuit breaker e dead-letter;
- desinstalação, revogação de credencial e retenção definidas;
- testes de contrato e integração executados.

Templates de AWS, Azure, GCP, Salesforce, Zendesk ou outros providers devem
permanecer como `planned` até seus adapters cumprirem esse contrato.

## Frentes paralelas

### Frente A — Core SaaS e autoridade

Tenancy, RBAC contextual, identidades, entitlements, billing, auditoria,
retenção, exportação e exclusão.

### Frente B — Conectividade e data plane

Conectores, SDK, collector, probe, telemetria, realtime, normalização,
proveniência, filas e resiliência.

### Frente C — Workforce operations

Threads, atividade, backlog, work graph, equipes híbridas, jornadas A2A, KPIs,
decisões, planos de ação e lifecycle.

### Frente D — Experiência e relatórios

Onboarding, portfólio, missão de controle, dashboards, relatórios executivos,
drill-down, explicabilidade e acessibilidade.

### Frente E — Qualidade e produção

Pirâmide de testes, inventário de controles, observabilidade do Muster, carga,
chaos, segurança, backup, restore, release, suporte e go-live.

As cinco frentes compartilham contratos OpenAPI, schemas de eventos, fixtures e
critérios de evidência. Nenhuma frente pode inventar estado inexistente nas
demais.

## Ondas de entrega

### Onda 0 — Baseline confiável

- G0: verdade dos dados e E2E autenticado.
- G1: hierarquia e RBAC contextual.
- Instrumentação mínima do próprio Muster.
- Inventário de rotas, botões e efeitos esperados.

**Saída:** ambiente reproduzível, dados conciliados e nenhuma mutação sem
permissão ou auditoria.

### Onda 1 — Primeiro valor sem suporte

- Provisionamento self-service do tenant.
- Onboarding unificado do conector até o primeiro evento.
- GitHub e SDK/webhook homologados.
- Kit Docker/local e collector OTLP mínimo.
- Planos, entitlements, limites e medição de uso.

**Saída:** agente real admitido e observável em até 15 minutos.

### Onda 2 — Operação diária

- Threads correlacionando execução, decisão, ação e evidência.
- Activity feed por agente, equipe e jornada.
- Backlog e Kanban persistidos.
- Equipes híbridas e jornadas A2A com responsabilidades e handoffs.
- Métricas em tempo real com baseline, meta, confiança e proveniência.

**Saída:** gestor entende trabalho planejado, realizado, bloqueios e próximos
passos sem sair do Muster.

### Onda 3 — Decisão e evolução do profissional digital

- Recomendação → decisão → ação → impacto.
- Aprovar, ajustar e rejeitar com consequências explícitas.
- Mentoria, promoção, suspensão e aposentadoria.
- Direitos por ação, autonomia L0–L5 e reversibilidade.
- Relatórios de performance, risco, operação e board.

**Saída:** toda decisão produz trabalho rastreável e toda intervenção é medida.

### Onda 4 — Promoção para produção

- Todos os controles e jornadas críticas cobertos.
- Soak, stress, chaos, replay, backup, restore e rollback.
- SLOs, alertas, runbooks e plantão definidos.
- Segurança, privacidade, retenção e resposta a incidentes aprovadas.
- Billing, suporte, oferta e termos operacionais prontos.
- Mara aprova piloto pago e depois disponibilidade geral.

## Pirâmide de testes

### Base — unitários

- fórmulas e normalização de KPI;
- máquinas de estado de conector, decisão, ação e lifecycle;
- políticas de autonomia, reversibilidade, RBAC e entitlements;
- reducers, validações e estados de componentes;
- correlação, deduplicação e classificação de telemetria.

### Meio — contrato e integração

- OpenAPI, webhooks, SDK e schemas de eventos;
- PostgreSQL real, outbox, filas, idempotência e auditoria;
- Clerk, billing e providers em sandbox;
- reconciliação UI/API/relatório/banco;
- retries, rate limits, circuit breaker e dead-letter.

### Topo — E2E

- tenant → convite → conector → discovery → admissão → primeiro evento;
- KPI → alerta → recomendação → aprovação/ajuste/rejeição → ação → impacto;
- thread → atividade → backlog → equipe → jornada → relatório;
- mentoria, promoção, suspensão e aposentadoria;
- todos os botões, links, formulários e estados vazios das rotas produtivas.

### Não funcionais

- carga, soak, chaos e recuperação;
- segurança, isolamento, secrets e abuso;
- acessibilidade, Web Vitals e grandes listas;
- backup, restore, rollback e disaster recovery.

Teste público não substitui E2E autenticado. Teste de componente não substitui
persistência, reload e reconciliação. Nenhum botão é validado apenas por renderizar.

## Contrato de observabilidade para toda tarefa

Uma feature operacional só pode fechar quando define:

- evento de domínio e correlação por `orgId`, agente, execução e ação;
- logs estruturados sem segredo;
- métricas RED para APIs e USE para workers/collectors;
- trace ponta a ponta quando atravessa serviços;
- dashboard ou consulta de diagnóstico;
- alerta e runbook quando a falha exigir operação;
- retenção, cardinalidade e custo estimados;
- teste que prove a instrumentação.

## Ariadne — agente organizador da entrega

Ariadne é um delivery governor com autonomia `L1`. Ela observa Linear, Git,
testes e evidências, mas não fecha issue, publica release ou altera produção.

Responsabilidades:

1. validar Definition of Ready antes de iniciar uma issue;
2. montar e atualizar o grafo de dependências;
3. detectar tarefa sem owner, aceite, testes ou observabilidade;
4. cobrar evidência de Definition of Done;
5. abrir follow-up filho para gap comprovado e fora do escopo;
6. publicar resumo diário de progresso, riscos e bloqueios;
7. executar scorecard de readiness a cada candidato de release;
8. impedir recomendação de promoção enquanto houver P0/P1 sem prova.

Saídas esperadas:

- `ready`, `blocked`, `at_risk` ou `done_with_evidence` por issue;
- mapa de dependências e caminho crítico;
- relatório diário curto;
- scorecard de release consumível por Mara.

## Definition of Ready

- driver e resultado de negócio explícitos;
- fluxo atual e fluxo esperado descritos;
- critérios de aceite observáveis;
- dependências e owner definidos;
- riscos de tenant, segurança e reversibilidade avaliados;
- plano de testes e instrumentação incluído;
- dados reais, inferidos e sintéticos identificados.

## Definition of Done

- código integrado ao produto existente;
- todos os estados de UI e API tratados;
- tenant, RBAC e auditoria respeitados;
- unitários, contrato/integração e E2E adequados ao risco;
- instrumentação visível e testada;
- persistência e reload comprovados;
- documentação e runbook atualizados;
- evidência anexada ao Linear;
- reconciliação com fonte de verdade aprovada;
- nenhum CTA ou link sem efeito operacional.

## Gates de produção

1. **Produto:** jornada canônica completa sem suporte técnico.
2. **Dados:** divergência crítica entre UI, API, relatório e banco igual a zero.
3. **Segurança:** isolamento tenant e menor privilégio comprovados.
4. **Confiabilidade:** SLOs, backup, restore, rollback e chaos aprovados.
5. **Experiência:** rotas e controles críticos aprovados em desktop e mobile.
6. **Operação:** alertas, runbooks, suporte e ownership definidos.
7. **Comercial:** planos, billing, limites, trial, oferta e SLA documentados.
8. **Evidência:** Mara e Ariadne recomendam promoção com artefatos reproduzíveis.

## Modelo de execução no Linear e Orca

- `MUS-5` é a iniciativa de produção SaaS.
- `MUS-6` — verdade dos dados e E2E autenticado.
- `MUS-7` — hierarquia, RBAC contextual e auditoria.
- `MUS-8` — conexão e admissão real em até 15 minutos.
- `MUS-9` — threads, atividade, backlog, equipes híbridas e jornadas A2A.
- `MUS-10` — KPI, recomendação, decisão, ação e impacto.
- `MUS-11` — lifecycle dos profissionais digitais.
- `MUS-12` — control plane e relatórios executivos.
- `MUS-13` — Gauntlet, todos os controles e promoção para produção.
- `MUS-104` — provisionamento, planos, billing e entitlements.
- `MUS-105` — observabilidade realtime, SLOs e runbooks.
- `MUS-106` — Ariadne Delivery Governor.
- Issues filhas representam gates de produto.
- Subissues representam entregas verificáveis de uma a três jornadas técnicas.
- Cada subissue gera uma worktree Orca vinculada ao identificador Linear.
- A issue só muda para concluída com PR, testes e evidência.
- Descobertas fora do escopo viram follow-ups filhos.
- Ariadne revisa o programa diariamente; Mara avalia candidatos de release.

O programa possui 11 gates e 43 tarefas executáveis no Linear. As dependências
entre gates estão registradas com relações `blocks`; `MUS-13` só pode ser
promovida quando produto, SaaS e observabilidade tiverem evidência aprovada.

## Estimativa orientativa

Assumindo quatro frentes técnicas em paralelo, um owner de produto disponível e
nenhuma troca ampla de arquitetura:

- baseline confiável e onboarding homologado: 8 a 12 dias úteis;
- candidato interno de produção: 15 a 20 dias úteis;
- piloto pago controlado: 22 a 30 dias úteis;
- disponibilidade geral: após piloto externo, mais 10 a 15 dias úteis de
  estabilização e aceite.

Em execução predominantemente sequencial, o mesmo escopo representa cerca de
60 a 80 pessoa-dias. As estimativas não reduzem gates de segurança, soak,
restore ou isolamento; paralelização reduz calendário, não evidência necessária.
