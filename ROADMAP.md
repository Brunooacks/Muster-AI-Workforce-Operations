# Cohort — Roadmap Evolutivo

> Atualizado em 2026-07-08. Ordem = dependência + valor de demo. Cada release é um épico com issue própria no GitHub.

## Visão

Cohort é o **RH e a governança da força de trabalho de IA**: identidade, carteira de trabalho, avaliação em 5 camadas e veredito (Promover / Mentorar / Aposentar) para frotas de agentes multi-plataforma. O roadmap leva o produto de "demo com dados simulados" a "plataforma operando sobre frotas reais".

## Estado atual (base já entregue)

- ✅ **Fase 0 — Fundação** (PR #1): migrations versionadas, `.env.example`, Dockerfile, Vitest (20 testes), CI GitHub Actions, build desacoplado do Replit
- ✅ **Modo dev local** (PR #2): auth bypass seguro p/ localhost, proxy `/api`, modelo de IA configurável
- ✅ **Frota de teste real**: [cohort-test-agents](https://github.com/Brunooacks/cohort-test-agents) (LangChain, Claude, Copilot) admitidos na frota local
- ✅ Pipeline real de fetch de código do GitHub (`POST /discovery/fetch`)
- ✅ **R6 (núcleo) — Telemetria real**: SDK `@workspace/telemetry-reporter` (conector
  fire-and-forget que agentes embutem), ingest `POST /agents/:id/events` com `ts`
  opcional (backfill/batch), armazenamento em `agent_events`, agregação em janelas
  7/30/90d, reavaliação 5 camadas telemetry-first com regras auditáveis, seção
  "Telemetria Operacional" no detalhe do agente e simulador de frota
  (`pnpm --filter @workspace/scripts run simulate-telemetry`). Pendências R6:
  coleta passiva via conectores (usage APIs) e reavaliação agendada (cron).

---

## R1 — Paridade visual "Trincheira" (experiência das 13 telas)

**Objetivo:** o app real entregar a mesma experiência das telas de referência (`attached_assets/`) — hoje o app tem as rotas, mas não o nível de detalhe.

- Cards das 5 camadas com ícones por camada (🎯 eficácia, ⚡ eficiência, 📈 adoção, 🛡 governança, 👑 valor), subtítulo-pergunta ("A agente resolve mesmo?"), metas sob o label, valores em mono, setas de tendência com delta (`-16pp em 60d`) e pills de status (CRÍTICA / ESTÁVEL / ALTA / MÉDIA)
- Detector de Vitória Ilusória com estrutura **DETECTADO → HIPÓTESE → RECOMENDAÇÃO**, tipos de padrão (`ROI ↑ + Acurácia ↓`) e severidade (VITÓRIA ILUSÓRIA CRÍTICA / ALERTA ANTAGÔNICO / SINAL ANTECEDENTE)
- Histórico de Avaliações comparando períodos lado a lado ("mesma agente, três trimestres — três decisões diferentes")
- Anotações de contexto nas métricas ("⚠ Valor inflado por queda em qualidade")
- Auditoria de consistência visual em todas as 13 telas vs. referência

**Dependências:** nenhuma. **Esforço:** ~1–2 semanas. **Valor:** demo imediata.

## R2 — Biblioteca de Métricas por vertical (menu próprio, tailor-made)

**Objetivo:** menu dedicado de métricas, pré-populado com catálogos profundos por tipo de negócio, e customização tailor-made por cliente.

- Novo domínio `metric_catalog` no banco (migration) + CRUD na API
- Catálogos pré-populados por vertical: **Negócios** (receita influenciada, conversão, churn, NPS), **Tecnologia** (acurácia, alucinação, latência, custo/token, drift), **Operações** (throughput, SLA, retrabalho, escalonamento correto), **Suporte de TI** (FCR, MTTR, deflection rate, CSAT), **Risco & Compliance** (exposição de dado sensível, trilha de auditoria, tentativas fora de escopo), **Financeiro** (CPE, ROI, payback, custo total mensal)
- Reutilizar o `SIGNAL_MAP` existente como seed do catálogo de tecnologia/operações
- UI: menu "Métricas" na navegação → biblioteca por vertical → criar/editar métrica custom (label, unidade, meta, camada, racional)
- Admissão e avaliação passam a montar KPIs a partir do catálogo

**Dependências:** nenhuma (destrava R4 e R5). **Esforço:** ~1–1,5 semana.

## R3 — Conectores 2.0 (cadastro + coleta real multi-plataforma)

**Objetivo:** sair do catálogo fixo (`PLATFORM_CATALOG`) para conectores cadastráveis e coleta real de agentes.

- **Botão "Cadastrar conector"** na tela de conectores: tipo, credencial (secret), escopo, teste de conexão
- **GitHub (primeiro conector real):** listar repos da org/usuário, detectar agentes (heurística: langchain/anthropic/crewai/autogen/copilot manifests), coletar código e propor admissão — o `github-auth.ts` + `fetch-source.ts` já existem, falta a descoberta
- **AWS:** Bedrock Agents (ListAgents) — enumerar agentes da conta
- **Microsoft:** Copilot Studio / Azure AI Foundry (agents API)
- **Google:** Vertex AI Agent Builder
- **OpenAI/Anthropic:** Assistants API / lista de projetos
- Arquitetura de conector plugável: interface `Connector { testConnection, discoverAgents, fetchAgentSource }` — um arquivo por provedor
- Armazenamento seguro de credenciais (secrets criptografados no banco ou vault)

**Dependências:** R2 ajuda (métricas propostas por plataforma). **Esforço:** ~2–3 semanas (GitHub primeiro, demais incrementais).

## R4 — Fast Assessment (discovery com pré-preenchimento da carteira)

**Objetivo:** apontar para um agente (repo, endpoint ou plataforma) e receber a **carteira de trabalho pré-preenchida** em minutos.

- Fluxo "Fast Assessment" na admissão: colar URL/conectar → coleta automática → análise → carteira preenchida → revisão humana → admitir
- Motor de análise reutiliza o pipeline real (`fetch-source` + `analyze`) e o **padrão do reviewer-claude** (tool use para inspecionar código com profundidade: ferramentas, prompts, limites, integrações)
- Extração estruturada: papel, should/shouldn't, nível de autonomia, limites, donos sugeridos, business case esboçado e **métricas sugeridas a partir do catálogo (R2)**
- Score de confiança por campo (o que a IA tem certeza vs. o que precisa de humano)
- Assessment em lote: rodar sobre todos os agentes descobertos por um conector (R3)

**Dependências:** R2 (catálogo) e R3 (conectores) para o modo lote; o modo URL única já é viável. **Esforço:** ~1–2 semanas.

## R5 — Jornadas A2A (agent-to-agent)

**Objetivo:** mapear a jornada ponta a ponta quando múltiplos agentes colaboram — quem chama quem, onde a jornada quebra, qual agente degrada o resultado do conjunto.

- Novo domínio: `journeys` (jornada de negócio), `journey_steps` (etapa → agente responsável), `handoffs` (transições A2A com taxa de sucesso/perda)
- UI: visão de grafo/fluxo da jornada (ex.: Triage → Reviewer → humano), com saúde por etapa e pontos de atrito
- Métricas de jornada: taxa de conclusão E2E, tempo total, perdas por handoff, custo da jornada
- Detector de Vitória Ilusória em nível de jornada (agente A melhora às custas do agente B)
- Instrumentação: eventos de handoff reportados via API (`POST /journeys/:id/events`) — prepara o terreno para R6

**Dependências:** R2 (métricas de jornada no catálogo). **Esforço:** ~2–3 semanas.

## R6 — Telemetria real (substituir o RNG)

**Objetivo:** avaliações calculadas de dados reais, não semeadas.

- API de ingestão: `POST /agents/:id/metrics` (SDK leve + API key por agente)
- Instrumentar os 3 agentes de teste para reportar métricas reais (latência, decisões, custos) — prova viva
- Coleta passiva via conectores (R3): usage APIs de OpenAI/Bedrock/Azure
- `scoreEvaluation` v2: janelas móveis sobre `metric_points` reais; RNG só como fallback demo (flag)
- Reavaliação agendada (cron) + alertas do detector calculados de séries reais

**Dependências:** R3, R5 (instrumentação). **Esforço:** ~2–4 semanas. **É o coração do produto.**

## R7 — Escala, qualidade e produção

**Objetivo:** aguentar frotas grandes e ir para o ar com confiança.

- **Testes:** integração da API (supertest + Postgres efêmero), e2e (Playwright sobre o modo dev), carga (k6: frota com 500+ agentes, 100k metric_points), contrato (OpenAPI ↔ implementação)
- Paginação e índices (agents, metric_points, evaluations) + cache de summary
- Multi-tenant (org scoping) — pré-requisito para SaaS
- Deploy: Render/Railway (API) + Neon (Postgres) + Vercel (web) + Clerk próprio
- Observabilidade: métricas da própria plataforma (dogfooding: o Cohort avaliando seus próprios agentes de assessment)

**Dependências:** transversal; itens de teste começam junto com R1. **Esforço:** contínuo + ~2 semanas de hardening final.

---

## Sequência sugerida

```
Semana:      1    2    3    4    5    6    7    8    9    10
R1 Visual    ████████
R2 Métricas       ███████
R3 Conectores          ██████████████
R4 Assessment                   ████████
R5 Jornadas A2A                      ██████████
R6 Telemetria                             ██████████████
R7 Escala    ░░░░░░░░░░░░░░░░░░ (contínuo) ░░░░░░████████
```

**Marcos de demo:** fim da S2 (visual + métricas por vertical), fim da S5 (conector GitHub coletando agentes reais + fast assessment), fim da S8 (jornada A2A ao vivo), fim da S10 (avaliação com telemetria real — produto completo).
