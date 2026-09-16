# Handoff Codex → Orca

Atualizado em 15 de setembro de 2026.

## Objetivo deste documento

Este arquivo é a ponte de continuidade do Muster no Orca. O código, o histórico
Git e os documentos existentes permanecem como fonte de verdade. Conversas do
Codex não são importadas como sessões nativas do Orca; por isso, decisões e
restrições relevantes estão consolidadas aqui para evitar recomeço, perda de
contexto ou implementação desconectada do produto existente.

## Projeto registrado no Orca

- Projeto: `Muster-AI-Workforce-Operations`.
- Diretório original: `/Users/brunooliveira/dev/Muster-AI-Workforce-Operations`.
- Repositório: `github.com/Brunooacks/Muster-AI-Workforce-Operations`.
- Branch-base temporária: `codex/feat/gauntlet-1-validator`.
- Último commit: `3c9a5da chore: extract Cenyra as standalone project`.
- Evolução principal anterior: `43b859d feat: mature AI workforce operations control plane`.

A branch-base deve voltar para `main` depois que a evolução atual for revisada e
integrada. Até lá, novas worktrees do Orca devem partir da branch acima para não
perder funcionalidades recentes.

## Tese do produto

O Muster é o control plane para profissionais digitais e equipes híbridas. O
loop que deve orientar toda priorização é:

```text
conectar qualquer agente
  → descobrir e pré-qualificar
  → definir propósito, responsabilidade, autonomia e KPIs
  → receber telemetria e evidências contínuas
  → comparar contrato × desempenho
  → recomendar, decidir e executar um plano de ação
  → medir o impacto posterior
  → escalar, mentorar, recalibrar, suspender ou aposentar
  → reportar o resultado por profissional, equipe e jornada
```

O produto não é apenas observabilidade de LLM nem um catálogo de conectores. O
moat é transformar execução em gestão contínua, auditável e acionável da força
de trabalho de IA.

## Princípios que não podem regredir

1. Evoluir o produto existente; não recomeçar baseado no PRD.
2. Nenhum CTA pode terminar apenas em um formulário sem próximo passo.
3. “Conectado”, “real time”, “funcional” e “validado” exigem evidência executada.
4. Dado real, inferido e sintético deve ser identificado em toda visualização.
5. Tenant, organização, área, equipe, jornada e agente devem permanecer isolados.
6. Ações irreversíveis exigem direitos explícitos, aprovação e trilha de auditoria.
7. Dinheiro é uma dimensão opcional; propósito, qualidade, escopo, risco e
   resultado técnico também definem valor.
8. Local, Docker, on-premise, vLLM e cloud são condições suportadas, não premissas.
9. Ajustes visuais devem remover ambiguidade e aumentar operação; não substituir
   persistência, integração ou testes.
10. A prova de conclusão é `requisito → código → teste → execução → evidência → métrica → owner`.

## Estado auditado

A baseline de 7 de setembro de 2026 classificou o Muster em **64/100**, seguro
para **design partners**, mas ainda `NO-GO` para piloto pago e disponibilidade
geral. A evidência registrada inclui:

- 51 testes unitários de frontend;
- 278 testes unitários de backend;
- 18 integrações PostgreSQL;
- 29 cenários E2E autenticados;
- 62 cenários públicos desktop/mobile;
- typecheck e build de produção aprovados.

Essa baseline deve ser reexecutada antes de qualquer nova afirmação de
maturidade. Consulte `docs/MATURITY-EVALUATOR.md` e os artefatos em
`output/maturity/`.

## Capacidades já presentes

- Clerk real e sem bypass de autenticação.
- Isolamento por organização e Admin Console.
- Grupos de acesso com escopo por organização, área ou equipe.
- GitHub nativo e contrato universal por SDK/webhook.
- Discovery e pré-assessment heurístico.
- Catálogo de métricas, kits e herança/criação durante a admissão.
- Eventos, heartbeat, outbox, worker, SSE e projeção contínua.
- Direction, Protection, Proof, saúde do contexto, risco de alucinação e regressão.
- Equipes e jornadas usando APIs reais em parte do shell produtivo.
- Decisões e planos profissionais persistidos em fluxos específicos.
- Relatórios tenant-scoped e Gauntlet com cenários locais.

## Lacunas que bloqueiam promoção

1. Aplicar RBAC contextual a todas as mutações e provar isolamento por área/equipe.
2. Fechar backlog, papéis, alçadas e operação diária de equipes e jornadas.
3. Transformar recomendação, decisão, SLA, ação e impacto em um loop único.
4. Unificar alertas, lifecycle, rotinas e governança em um board operacional.
5. Implementar lifecycle transacional de mentoria, promoção, suspensão e aposentadoria.
6. Provar um conector real do onboarding ao relatório, além do laboratório.
7. Versionar contratos de KPI e preservar impacto das alterações.
8. Tornar o relatório executivo narrativo, reconciliado e com drill-down até a evidência.
9. Provar soak de 24 horas, carga, chaos, backup, restore e rollback.
10. Publicar oferta, ICP, escopo, preço, SLA e suporte do piloto.

## Ordem obrigatória de execução

### P0 — Fundamento operacional

1. Verdade dos dados e sessão E2E autenticada reproduzível.
2. Hierarquia, memberships, RBAC contextual e auditoria.
3. Work graph, backlog e Kanban operacional persistidos.
4. Conexão → discovery → assessment → probe → admissão → primeiro evento.
5. Contrato versionado de autonomia, ação, KPI, contexto e release.
6. KPI → sinal → recomendação → decisão → ação → impacto.
7. Lifecycle completo e transferência de trabalho na aposentadoria.
8. Relatório executivo reconciliado com o control plane.
9. Gauntlet de carga, chaos, recuperação, isolamento e Web Vitals.

### P1 — Moat de workforce intelligence

- Workspace do AI Workforce Business Partner.
- Workforce Twin para replay, shadow, canary e simulação.
- Governança de datasets e imitation learning.
- Recomendação de composição de equipes com aprovação humana.
- Comparação entre autonomia prevista e impacto observado.

### P2 — Extensão futura

- Perfil de agentes ciberfísicos.
- Telemetria ROS 2, MQTT, OPC UA e OTLP.
- Segurança física, digital twins e sim-to-real.
- O Muster observa e governa; não controla atuadores no estágio inicial.

## Fontes de verdade

- Produto e requisitos: `docs/PRD-MUSTER-WORKFORCE-OS.md`.
- Priorização operacional: `docs/ROADMAP-OPERACIONAL-MUSTER.md`.
- Maturidade comercial: `docs/MATURITY-EVALUATOR.md`.
- Evidência e testes: `docs/GAUNTLET-OPERACIONAL.md`.
- Autonomia e workforce intelligence: `docs/ESTRATEGIA-AUTONOMIA-E-WORKFORCE-INTELLIGENCE.md`.
- Regressão e contexto: `docs/ESTRATEGIA-REGRESSAO-E-CONTEXTO.md`.
- Jornadas A2A: `docs/JORNADAS-A2A.md`.
- Tenancy e segurança: `docs/TENANCY-SECURITY.md`.
- Integrações: `docs/INTEGRACAO-PLATAFORMAS-EXTERNAS.md`.

## Convenção Linear → Orca

- Time Linear: `MUS`.
- Iniciativa principal: `MUS-5` — Muster operacional para piloto pago.
- Gates do roadmap: `MUS-6` a `MUS-13`.
- Primeira worktree vinculada: `MUS-6-verdade-dados-e2e`.
- Um épico representa um gate de produto, não uma camada técnica.
- Cada issue precisa declarar driver, resultado observável, evidência e owner.
- Issues de UI e backend do mesmo fluxo devem compartilhar o mesmo pai.
- O trabalho começa em uma worktree vinculada à issue Linear.
- A conclusão exige teste, evidência e link do PR; mover código sem prova não fecha a issue.
- Descobertas fora do escopo viram issues filhas, sem ampliar silenciosamente a tarefa atual.

## Primeira sessão no Orca

1. Abrir `Muster-AI-Workforce-Operations`.
2. Ler este arquivo e o PRD antes de planejar alterações.
3. Selecionar uma issue do Linear vinculada a um gate P0.
4. Criar uma worktree a partir da branch-base configurada.
5. Executar os testes mais específicos antes dos gates amplos.
6. Anexar evidência reproduzível à issue e ao relatório do Gauntlet.
