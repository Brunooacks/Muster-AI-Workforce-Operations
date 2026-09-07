# Roadmap operacional do Muster

## Objetivo

Promover o Muster de protótipo funcional para um MVP operacional verificável:
uma organização consegue conectar um agente real, qualificá-lo, contratualizar
seu propósito e suas métricas, receber telemetria contínua, tomar decisões e
gerar um relatório executivo rastreável.

“100% operacional” neste roadmap significa concluir esse fluxo essencial com
GitHub, SDK/webhook universal e runtime local/Docker. O catálogo amplo de
providers permanece evolutivo; uma integração só pode ser chamada de `live`
quando autenticação, coleta e teste ponta a ponta existirem.

### Driver inegociável de priorização

```text
qualquer plataforma
  → agente + propósito + contrato de métricas
  → execução e telemetria contínua
  → comparação contrato × desempenho
  → escalar | mentorar | recalibrar | suspender | aposentar
  → squad híbrida | profissional + agentes | jornada A2A
  → relatório executivo + impacto comprovado
```

Esse loop é o moat do Muster. A prioridade não é maximizar telas ou integrações
listadas, mas aumentar a quantidade de agentes reais que completam o fluxo sem
intervenção técnica. Entregas que exibem dados sem ação, registram decisão sem
continuidade ou conectam sem telemetria verificável não contam como capacidade
operacional concluída.

## Diagnóstico em 2 de setembro de 2026

### Evidência no banco local

- A organização Clerk `My Organization` possui 1 membro, 0 equipes e 0 agentes.
- O tenant legado `org_default` possui 19 agentes, 2 equipes, 3.391 execuções em
  agosto e 20.757 em julho.
- Os três snapshots executivos da organização autenticada possuem 0% de
  cobertura porque o relatório respeita o isolamento por tenant e não encontra
  agentes ou eventos nessa organização.

Portanto, os dados não “sumiram”: estão em outro tenant. Falta ao produto um
bootstrap explícito para criar dados de laboratório no tenant autenticado ou
importar dados autorizados, além de um diagnóstico de cobertura antes da
geração do relatório.

## Avanço operacional em 6 de setembro de 2026

- O tenant autenticado possui 21 agentes e 21 avaliações de governança
  persistidas; a cobertura não depende mais de cards cenográficos.
- Grupos de acesso possuem CRUD, presets, permissões explícitas e escopo por
  organização, área ou equipe, com membros sincronizados com o Clerk.
- O worker reavalia telemetria a cada segundo e o comando atualiza a projeção de
  governança a cada cinco segundos.
- Direction, Protection, Proof, saúde do contexto, fundamentação, risco de
  alucinação, regressão, drift de input e recomendações são persistidos por agente.
- A navegação autenticada foi verificada nas nove rotas principais sem erro de
  console; o Playwright público passou em desktop e mobile com 62/62 cenários.
- As integrações reais com PostgreSQL passaram em 15/15 cenários cobrindo tenant,
  acesso contextual, telemetria, conectores, relatórios e planos profissionais.
- O Admin Console centraliza criação e troca de organizações via Clerk, membros,
  grupos de acesso, permissões e entrada administrativa para criação de equipes;
  as squads continuam focadas na execução, não na administração do tenant.

### Limite atual da autogovernança

O Muster já detecta, classifica, recomenda e abre alertas automaticamente. Ele
não deve executar mudanças irreversíveis sozinho. O próximo gate aplica as
permissões contextuais a todas as mutações, transforma recomendações aprovadas
em ações idempotentes e exige aprovação humana quando risco, reversibilidade ou
contrato assim determinarem.

### Estado por capacidade

| Capacidade | Estado atual | Lacuna de produto |
|---|---|---|
| Autenticação | Clerk real e sem bypass | E2E autenticado depende de sessão manual |
| Tenancy | Isolamento por organização e Admin Console para organização, membros e acessos | Sem importador e gestão de entitlements por plano |
| Estrutura | Organização, área, propósito e equipe no banco | Área não restringe acesso; configurações de workspace/equipe são parciais |
| Conectores | GitHub nativo; SDK/webhook universal | Outros providers são contrato ou catálogo, não adapters nativos |
| Discovery | GitHub real e catálogo demonstrativo | A UI ainda permite “ativar” contrato como se fosse conexão |
| Pré-assessment | Heurística de código, propósito, telemetria e métricas | Não executa o agente nem valida qualidade real |
| Métricas | Catálogo CRUD, starter kits, herança/criação na admissão e contrato de ingestão | Falta governar versionamento e impacto de alterações em métricas já contratadas |
| Telemetria | Eventos, heartbeat, envelope externo, outbox e reavaliação | Falta wizard de teste, reconciliação e cobertura visível por fonte |
| Relatórios | Snapshot mensal tenant-scoped | Não explica ausência de dados e não inclui hierarquia, jornada e plano de ação |
| Gauntlet | Workloads offline e testes de componentes | Mede o harness; ainda não prova o fluxo autenticado e integrado do produto |

## Modelo operacional alvo

```text
Organização
  └── Unidade / Área
      └── Grupo de trabalho / Squad
          └── Jornada / Workstream
              ├── Profissionais humanos
              └── Agentes e subagentes
                  └── Execuções, evidências, métricas, decisões e ações
```

### Acesso

- **Organização:** owner, admin, auditor e member.
- **Área:** leader, manager, analyst e viewer, com escopo explícito.
- **Equipe:** owner, supervisor, operator e observer.
- **Agente:** identidade de serviço própria com scopes como `events:write`,
  `heartbeat:write`, `evidence:write` e `actions:read`.
- **Auditoria:** toda alteração de configuração, KPI, autonomia, recomendação e
  acesso gera evento append-only com ator, tenant e timestamp.

### Contrato do profissional digital

Todo agente admitido precisa ter:

1. identidade e plataforma de origem;
2. organização, área, equipe e owner;
3. propósito, responsabilidades, limites e resultado esperado;
4. autonomia e direitos de decisão;
5. KPIs ativos com fórmula, fonte, janela, baseline, meta e evidência;
6. credencial/adapter de telemetria validado;
7. cadência de avaliação, SLA e plano de ação;
8. classificação clara entre dado observado, inferido e sintético.

## Jornada de conexão desejada

1. **Escolher origem:** GitHub, webhook/SDK, Docker/local ou adapter nativo.
2. **Autenticar e testar:** salvar segredo cifrado e executar health check real.
3. **Descobrir:** listar candidatos com origem e confiança, sem criar agentes.
4. **Pré-qualificar:** analisar código, prompts, ferramentas, guardrails e sinais.
5. **Executar probe:** rodar uma tarefa segura ou ingerir um evento de teste.
6. **Contratualizar:** confirmar propósito, owners, autonomia, KPIs e baseline.
7. **Admitir:** criar agente, escopo de acesso e credencial de serviço.
8. **Validar telemetria:** mostrar o primeiro evento, heartbeat e freshness.
9. **Calibrar:** operar em observação até atingir amostra e confiança mínimas.
10. **Promover:** liberar operação contínua com alertas e revisão periódica.

Cada etapa precisa mostrar `não iniciado`, `em configuração`, `validado`,
`degradado` ou `bloqueado`. “Contrato pronto” nunca deve aparecer como
“conectado”.

## Experiência do novo relatório

O relatório deve ser uma narrativa de decisão, não uma exportação de cards:

1. **Capa executiva:** período, tenant, fonte, cobertura, freshness e modo dos dados.
2. **Resumo:** o que mudou, por que importa e quais decisões são necessárias.
3. **Propósito:** cumprimento de contrato por área, equipe, jornada e agente.
4. **Portfólio:** valor/propósito × saúde operacional, com drill-down.
5. **Tendência:** atual × mês anterior × baseline × meta.
6. **Operação:** volume, sucesso, qualidade, custo opcional, latência e intervenções.
7. **Risco:** alertas, violações, decisões humanas, autonomia e evidência.
8. **Ações:** recomendação, decisão, owner, SLA, estado e impacto posterior.
9. **Qualidade dos dados:** fontes ausentes, amostra, confiança e limitações.
10. **Anexo auditável:** IDs de evidência, contratos e eventos utilizados.

Antes de gerar, a tela deve mostrar um `Data Readiness Check`. Se o tenant não
tiver eventos, o produto explica onde há dados, oferece criar laboratório no
tenant atual e impede um relatório vazio de parecer válido.

## Roadmap priorizado

### Bloco 0 — Verdade dos dados e recuperação do relatório

**Prazo paralelo:** 2 a 3 dias úteis.

- Criar bootstrap opt-in de laboratório dentro da organização autenticada.
- Criar importador seguro do `org_default` para um tenant escolhido, sem mover
  dados silenciosamente.
- Exibir origem, tenant, período, cobertura e classificação real/sintética.
- Adicionar preflight do relatório e impedir snapshot vazio sem explicação.
- Refazer o HTML/PDF do Gauntlet e o relatório executivo com a estrutura acima.

**Gate G0:** contagens do relatório iguais às consultas de referência; nenhum
snapshot vazio silencioso; drill-down chega ao evento/evidência de origem.

### Bloco 1 — Hierarquia e controle de acesso

**Prazo paralelo:** 4 a 5 dias úteis.

- Completar CRUD de organização, áreas, equipes, memberships e convites.
- Aplicar escopo de área/equipe em consultas, relatórios e ações.
- Separar identidade humana, identidade do agente e credencial de integração.
- Implementar matriz RBAC testável e trilha de auditoria.
- Tornar configurações de perfil, workspace e notificações persistentes.

**Gate G1:** owner administra estrutura; supervisor opera somente seu escopo;
observer não altera dados; testes provam ausência de vazamento entre tenants e áreas.

### Bloco 2 — Conexão e admissão end-to-end

**Prazo paralelo:** 5 a 6 dias úteis.

- Transformar conectores em máquina de estados baseada em capacidades reais.
- Entregar wizard único: conectar → descobrir → assess → probe → admitir → validar.
- Consolidar GitHub e SDK/webhook como caminhos oficialmente suportados.
- Criar kit Docker/local com health check, heartbeat e exemplo instrumentado.
- Adicionar adapter OpenTelemetry mínimo para traces de execução.
- Gerar instruções específicas por runtime e um diagnóstico copiável.

**Gate G2:** um usuário conecta e observa o primeiro evento real em até 15
minutos; falhas indicam causa e próxima ação; nenhum provider fictício aparece conectado.

### Bloco 3 — Contrato de KPI e supervisão contínua

**Prazo paralelo:** 5 a 6 dias úteis.

- Vincular métricas do catálogo a agente, equipe, jornada e propósito.
- Versionar fórmula, baseline, meta, janela, owner, fonte e política de confiança.
- Criar mapeador de sinais externos para contratos de KPI.
- Exibir cobertura, freshness, atraso, amostra e proveniência em tempo real.
- Conectar recomendação aprovada/rejeitada às ações, owners e SLAs já existentes.
- Recalcular impacto depois da ação para responder se a intervenção funcionou.

**Gate G3:** toda métrica exibida possui fonte e contrato; toda recomendação
gera decisão rastreável; toda ação possui acompanhamento antes/depois.

### Bloco 4 — Relatórios e gestão encantadora

**Prazo paralelo:** 4 a 5 dias úteis.

- Implementar relatório executivo interativo com drill-down hierárquico.
- Criar templates Board, Performance, Risk e Operação.
- Adicionar evolução mensal, baseline/meta, matriz propósito × saúde e coortes.
- Gerar PDF consistente com a versão navegável.
- Criar leitura assistida por IA somente sobre fatos e evidências recuperáveis.

**Gate G4:** o gestor entende em menos de cinco minutos o que aconteceu, quais
agentes precisam de ação, quem responde e qual evidência sustenta a decisão.

### Bloco 5 — Gauntlet real e promoção do MVP

**Prazo paralelo:** 4 a 5 dias úteis.

- Criar tenant E2E descartável com Clerk, organização, áreas e equipes.
- Executar os quatro agentes Gauntlet dentro do Muster, não somente offline.
- Validar conexão, admissão, credencial, telemetria, KPI, relatório e ação.
- Cobrir todas as rotas autenticadas e controles principais no navegador.
- Rodar baseline, stress e chaos em local e Docker.
- Provar replay, idempotência, isolamento, restart e perda de provider.
- Publicar scorecard de aprovação com artefatos, screenshots, traces e SQL.

**Gate G5:** zero gaps P0/P1, 100% das jornadas críticas aprovadas, paridade de
dados confirmada e recuperação dentro dos SLOs definidos.

## Paralelização recomendada

| Frente | Responsabilidade | Blocos |
|---|---|---|
| A — Core e tenancy | hierarquia, RBAC, auditoria, migrações | 0, 1 e 3 |
| B — Integrações | connector state machine, SDK, webhook, Docker e OTEL | 2 e 3 |
| C — Produto e relatório | onboarding, conexão guiada, dashboards e PDF | 0, 2 e 4 |
| D — Gauntlet e qualidade | fixtures, E2E autenticado, carga, caos e evidência | todos |

- **Execução sequencial:** 25 a 30 dias úteis.
- **Execução paralela em quatro frentes:** 15 a 18 dias úteis.
- **Primeira entrega utilizável:** G0 + caminho GitHub/SDK de G2 em 5 dias úteis.

As frentes compartilham contratos OpenAPI e fixtures; alterações de UI não podem
inventar estados ausentes no backend.

## Critérios de “MVP pronto”

- Um novo tenant começa vazio por decisão explícita ou recebe laboratório opt-in.
- Um agente real percorre conexão, assessment, admissão e telemetria sem intervenção técnica.
- O gestor cria ou adota KPIs e vê fonte, baseline, meta, freshness e confiança.
- Organização, área, equipe, jornada, humano e agente aparecem na mesma cadeia.
- Recomendações resultam em decisões, ações, owners, SLA e verificação de impacto.
- Relatório e dashboard conciliam com o banco e distinguem real, inferido e sintético.
- Todas as jornadas críticas possuem E2E autenticado e evidência reproduzível.
- O Gauntlet mede o produto integrado; testes offline ficam apenas como pré-check.

## Dependências do usuário

1. Manter uma sessão Clerk de teste ou autorizar a criação de tenant E2E descartável.
2. Indicar um repositório/agente real para o caminho GitHub.
3. Executar ou indicar um agente local/Docker para o caminho SDK/webhook.
4. Aprovar se os dados legados devem ser clonados para `My Organization` ou se
   deve ser criado um laboratório novo e isolado.

Tokens e credenciais permanecem locais e nunca entram nos relatórios.
