# Gauntlet Progress — Muster

## Estado global

- Branch: `codex/feat/gauntlet-1-validator`
- Rodadas concluídas: 1 — validador E2E; 2 — zero dado semeado; consolidação —
  autenticação real, tenancy, KPIs, conectores seguros, runner e telemetria contínua
- Próxima rodada: Clerk E2E automatizado, autorização integral, carga, retenção e caos operacional
- Baseline capturado em: 2026-08-14
- Gate atual: typecheck, 275 testes de API, 15 integrações PostgreSQL, 60 E2E públicos e 9 rotas autenticadas aprovados

## Rodada — acesso contextual e governança contínua — 2026-09-06

### Entregas

- CRUD tenant-scoped de grupos de acesso com presets e escopos de organização,
  área e equipe.
- Sincronização de membros com Clerk e resolução de permissões efetivas.
- Avaliação contínua por agente com Direction, Protection, Proof, contexto,
  fundamentação, risco de alucinação, regressão e drift de input.
- Backfill automático para agentes já existentes e alerta consolidado por agente.
- Painel de governança em tempo real no shell produtivo, com cobertura explícita
  e distinção entre saudável e não medido.
- Correção do proxy Vite para a API 8087, startup da API com `.env` raiz e chave
  única na fila de decisões.
- Admin Console como rota corporativa protegida, com criação de organização pelo
  Clerk, gestão de membros, grupos e permissões e entrada para criar equipes.

### Evidência

- Banco local: 21 agentes e 21 avaliações persistidas.
- Distribuição observada: 10 saudáveis, 7 com dados insuficientes, 1 em atenção e
  3 críticas antes da limpeza das fixtures de integração.
- `pnpm run typecheck && pnpm test`: aprovado; API com 275 testes aprovados.
- `pnpm run test:integration`: 6 arquivos e 15 cenários PostgreSQL aprovados.
- Playwright público controlado: 62/62 em Chromium desktop e mobile.
- Browser autenticado: Admin Console carregado com papel administrador; modal de
  nova organização e formulário administrativo de nova equipe abertos com sucesso.
- Browser autenticado: comando, portfólio, equipes, jornadas, conectores,
  governança, métricas, relatórios e configurações carregaram sem 404, bootstrap
  interrompido ou erro de console.

### Achados do Gauntlet

- O painel de governança havia sido adicionado a uma página legada não roteada;
  foi movido para o `ManagerScreen` usado pelo shell produtivo.
- O Vite apontava por padrão para `localhost:8080`, causando falha no bootstrap;
  o padrão agora é a API real em `localhost:8087`.
- Cinco workers Playwright saturavam a instância Clerk development e geravam
  timeouts de teardown. O arquivo público agora executa serialmente por projeto,
  mantendo desktop e mobile em paralelo.
- Um segundo worker concorrente pode consumir a mesma fixture de integração;
  a suíte PostgreSQL deve executar com a API isolada até existir leader election.

### Gate residual

- Aplicar a matriz de permissões contextuais a todas as mutações, não somente à
  gestão de grupos e equipes.
- Automatizar sessão Clerk de teste sem bypass.
- Separar worker em processo dedicado com lease/leader election.
- Provar carga, retenção, replay, dead-letter e recuperação do provider.

## Rodada 0 — baseline

### Estado inicial

- `pnpm run typecheck`: passou sem erros.
- `pnpm test`: passou com 126 testes.
  - API: 112 testes.
  - Agent runner: 7 testes.
  - Telemetry reporter: 7 testes.
- Postgres local: `muster-postgres` saudável em `localhost:5433`.
- API: iniciada em `localhost:8087`.
- Web: ativa em `localhost:5173`.
- Frota real de teste ativa: `qualifier-crewai`, `prospector-langchain`, `outreach-agno`.

### Baseline visual

Capturas em `output/gauntlet/baseline/`:

- `comando.png`
- `frota.png`
- `agentes.png`
- `alertas.png`
- `governanca.png`
- `metricas.png`

As seis rotas renderizaram. Foi identificado um erro de console preexistente na
tela de Governança: breadcrumbs irmãos usavam a mesma chave `Governança`. A
correção usa o título da página como segunda chave e entra no verificador visual
da Rodada 1.

### Score dos verificadores

| Verificador | Score | Evidência |
|---|---:|---|
| Typecheck | 10/10 | `/tmp/muster-gauntlet-baseline-typecheck.log` |
| Testes | 10/10 | `/tmp/muster-gauntlet-baseline-test.log` |
| Seis telas | 8/10 | seis PNGs; erro de chave duplicada identificado |
| Stack local | 10/10 | Postgres, web, três agentes e API ativos |
| E2E autônomo | 2/10 | `validate-mvp` cobre parte do ciclo, mas não cria/limpa frota nem decide |

### Abordagens que falharam

- Docker via sandbox não acessou o socket local. A verificação foi refeita com
  permissão restrita ao ambiente local e confirmou os containers esperados.
- API não estava ativa em `8087` no início do baseline. Foi iniciada com a
  configuração de `.claude/launch.json`.

### Próxima ação

Criar `scripts/src/e2e-agent.ts`, público e idempotente, estendendo o fluxo já
provado por `validate-mvp`: criar três agentes, gerar telemetria com perfis
distintos, reavaliar, registrar decisão, verificar auditoria e limpar a frota.

## Rodada 1 — agente validador E2E

### Objetivo

Executar o ciclo atual do produto exclusivamente pela API pública, sem acesso
direto ao banco, e falhar com payload observado sempre que uma invariante não
for atendida.

### Estado

Concluída.

### Tentativas e evidências

1. A execução via sandbox falhou antes do script com `listen EPERM` no socket
   temporário do `tsx`. Estratégia alterada: execução local com permissão
   restrita ao comando `pnpm --filter @workspace/scripts run e2e`.
2. O primeiro preflight chamou `GET /api/health` e recebeu `404 Cannot GET
   /api/health`. O health check não pertence ao prefixo público `/api` usado
   pelo helper. Estratégia alterada: validar disponibilidade e autenticação com
   `GET /api/agents`, que também exercita a superfície real necessária ao E2E.
3. A primeira execução funcional criou, exercitou, decidiu, auditou e removeu
   os três agentes em 610 ms, mas falhou na comparação: todos receberam
   `observation`. O payload mostrou `insufficient-kpi-evidence` em primeiro
   lugar, apesar de 30 execuções e confiança 90, porque a reavaliação não
   propagava o baseline já declarado na Carteira de Trabalho. Estratégia
   alterada: usar essa declaração como disponibilidade de baseline ao avaliar
   contratos KPI derivados da telemetria, mantendo bloqueio quando a carteira
   não declarar baseline.
4. O teste unitário isolado de `reevaluate.test.ts` não coletou casos porque o
   módulo inicializa o cliente de banco e `DATABASE_URL` não estava presente no
   processo avulso. O typecheck da API passou. Estratégia alterada: repetir o
   teste com a URL do Postgres local, igual ao ambiente oficial da suíte.
5. O E2E repetido ainda mostrou o mesmo blocker porque a API ativa executava o
   bundle construído antes da correção; `pnpm run dev` faz build e start, sem
   watch/HMR. Estratégia alterada: reiniciar a API para reconstruir `dist` antes
   da próxima execução. Não é uma terceira tentativa da mesma estratégia.
6. O E2E passou no novo build, porém a suíte completa encontrou regressão de
   ambiente: o novo helper puro foi colocado em `reevaluate.ts`, módulo que
   inicializa banco ao ser importado. Sem `DATABASE_URL`, `pnpm test` não
   coletou `reevaluate.test.ts`. Estratégia alterada: mover o helper para
   `evaluation-metrics.ts`, que não possui efeito colateral de banco.

### Resultado

- `pnpm --filter @workspace/scripts run e2e`: passou em 498 ms.
- Perfis e vereditos: saudável → `mentor` (70), degradando → `observation`
  (59), errático → `retire` (28).
- Telemetria: 30 execuções por perfil, refletidas muito abaixo do limite de 30s.
- Comitê: decisões `approved`/`disagreed` persistidas com usuário Clerk, data,
  confiança 90,3 e rastro recuperado por `/api/agents/:id/verdicts`.
- Evidência: 7 registros por agente, vinculados ao agente correto.
- Idempotência: segunda reavaliação sem eventos novos retornou `changed: false`.
- Limpeza: três agentes sintéticos removidos ao final.
- Governança: erro React de chave duplicada corrigido; seis telas sem erro de
  console.

### Score dos verificadores

| Verificador | Score | Evidência |
|---|---:|---|
| E2E público | 10/10 | execução completa com três perfis e limpeza |
| Typecheck | 10/10 | monorepo limpo |
| Testes | 10/10 | 128 testes, acima do baseline de 126 |
| Seis telas | 10/10 | seis rotas sem erro de console |
| Auditoria | 10/10 | decisão, autor, confiança e evidência reconstruídos |

## Rodada 2 — zero dado semeado por padrão

### Objetivo

Impedir que o produto calcule desempenho fabricado quando não há telemetria,
mantendo o modo de demonstração apenas atrás de flag explícita e nunca em
produção.

### Estado

Concluída.

### Mudanças

- `ALLOW_SEEDED_EVALUATIONS` nasce desligada por padrão.
- `NODE_ENV=production` ignora a flag mesmo quando configurada como `true`.
- Boot não cria frota demo nem executa backfill sem a flag.
- Admissão sem telemetria cria cinco camadas vazias, score 0, confiança 0 e
  rationale explícita de “sem evidência”.
- Reavaliação pública acrescenta `dataSource: none` de forma aditiva ao
  contrato OpenAPI; clientes TypeScript e Zod foram regenerados.
- Camadas faltantes usam estado vazio, não fallback semeado.
- Série histórica sintética só é criada no modo demo explícito.
- O E2E ganhou o passo `reject-fabricated-evaluation` e limpa quatro agentes.

### Evidência

- Relatório E2E: `output/gauntlet/round-2/e2e.log` (`ok: true`, 518 ms).
- Resultado sem telemetria: `dataSource: none`, `healthScore: 0`,
  `verdict: observation`.
- Resultado com telemetria: `mentor`, `observation` e `retire`, sem regressão.
- `pnpm run typecheck`: passou.
- `pnpm test`: 133 testes passaram.
  - API: 119.
  - Agent runner: 7.
  - Telemetry reporter: 7.
- Capturas pós-rodada em `output/gauntlet/round-2/`; mesmas dimensões do
  baseline e zero erros de console nas seis rotas.

### Score dos verificadores

| Verificador | Score | Evidência |
|---|---:|---|
| Zero dado fabricado | 10/10 | flag off por padrão, produção bloqueada, E2E `none` |
| Contrato OpenAPI | 10/10 | enum aditivo e codegen executado |
| E2E público | 10/10 | `output/gauntlet/round-2/e2e.log` |
| Typecheck | 10/10 | monorepo limpo |
| Testes | 10/10 | 133 testes, baseline 126 |
| Seis telas | 10/10 | capturas 1265px, console limpo |

### Decisão pendente para a Rodada 3

O modelo de credencial por agente afeta onboarding e operação. Antes de
implementar, confirmar se o MVP deve usar uma API key estática revogável por
agente (mais simples), chave com rotação/versionamento, ou credencial por
workload usando assinatura curta. A recomendação para o piloto é API key
estática exibida uma única vez, hash SHA-256 em repouso, prefixo identificável,
escopo de um agente e rotação manual.

### Observação de versionamento

A branch foi criada, mas nenhum commit foi feito porque o worktree já continha
um conjunto grande de mudanças MVP não commitadas, inclusive nos mesmos
arquivos. Commitar automaticamente misturaria rodadas e trabalho anterior sem
uma separação confiável.

## Lacuna registrada — ciclo de revisão do agente individual

Levantada em 2026-08-19, durante a preparação da demo.

**Assimetria:** no nível da jornada, `journey_recommendation_actions` tem
responsável, tipo de ator (Muster, agente externo ou humano), modo de execução,
escopo de controle, `status`, SLA, prazo e evidência — o ciclo de execução e
acompanhamento existe. No nível do agente individual, `verdicts.nextActions` é
um JSON com ação, dono e prazo: **sem status, sem acompanhamento, sem evidência
de conclusão**. Depois de um veredito "Mentorar", ninguém marca o que foi feito
e o sistema não sabe se a ação aconteceu.

**Consequência:** o ciclo hoje só se fecha implicitamente — nova telemetria,
nova reavaliação, e o Histórico de Avaliações mostra se melhorou. Funciona como
medição de resultado, mas não como acompanhamento de execução.

**Próxima rodada proposta:** dar ao agente individual a mesma paridade da
jornada — ações com status, responsável, prazo e evidência; e a pergunta que
fecha o ciclo na tela: "a mentoria funcionou?", comparando o veredito atual com
o da janela em que a ação foi aprovada.

**Verificador:** aprovar um veredito com três ações, marcar uma como concluída,
reavaliar após nova telemetria e ver na tela a comparação entre o antes e o
depois da ação — com o E2E afirmando essa cadeia.

## Plano — tenancy utilizável (rodadas 6 a 8)

Levantado em 2026-08-19, após auditoria das rotas.

### Achado que define a ordem

O middleware `requireOrg` resolve o tenant e falha fechada, e as escritas já
gravam `org_id`. Mas **as leituras não filtram**: `fleet.ts` tem cinco consultas
a tabelas-raiz e nenhuma menção a `orgId`; o padrão se repete em journeys,
mixed-teams, catalog e connectors. Na prática, a organização A enxergaria os
dados da B. A fundação existe; a tranca, não.

Por isso a ordem é: **aplicar o escopo antes de construir tela**. Uma interface
de convite sobre isolamento que não vigora só aumenta a superfície do problema.

### Rodada 6 — o isolamento passa a vigorar

- Teste de vazamento cruzado primeiro: duas organizações, dados em cada uma, e a
  afirmação de que A não lê nem escreve nada de B. Deve **falhar** ao ser escrito
  — é o que prova que o problema é real.
- Filtrar por `orgId` toda leitura de entidade-raiz; entidades filhas herdam pelo
  join com o pai.
- Rotas por agente (`/agents/:id/...`) validam posse antes de responder, para o
  404 não virar oráculo de existência.

**Verificador:** o teste de vazamento passa; E2E segue verde; suíte não regride.

### Rodada 7 — organização como objeto de primeira classe

- Criar organização, renomear, listar membros.
- Convite por e-mail com papel (owner, admin, member) e aceite.
- Troca de organização ativa quando o usuário pertence a mais de uma — hoje a
  API devolve 409 nesse caso, de propósito, porque adivinhar seria pior.

**Verificador:** dois usuários em organizações distintas operam a mesma
instância sem se ver, pela interface.

### Rodada 8 — alçada por perfil na interface

- Papéis de equipe já existem no banco (owner, supervisor, operator, observer)
  com direitos de decisão por membro, mas a interface não os aplica: quem é
  observador vê os mesmos botões de quem é dono.
- Esconder ou desabilitar ação conforme o papel, com a razão visível — botão
  cinza sem explicação gera chamado de suporte.
- A API valida o papel também, porque interface não é controle de acesso.

**Verificador:** um observador não consegue aprovar veredito nem pela tela nem
por chamada direta à API.

## Consolidação arquitetural — 2026-08-23

Esta consolidação substitui as pendências técnicas já entregues nas seções
históricas anteriores; os itens de produto ainda não implementados continuam
válidos.

### Entregue

- Bypass removido: Clerk é obrigatório na API e no frontend, com CORS por
  allowlist e landing pública separada das rotas autenticadas.
- Tenant utilizável: organização ativa vem do Clerk, o vínculo é verificado no
  provedor, o tenant local é provisionado e o cache/onboarding muda junto com
  usuário + organização.
- Isolamento aplicativo: evidências, catálogo, jornadas, frota, deduplicação e
  mutações sensíveis são tenant-scoped; RBAC protege configuração e operação.
- Credenciais: chaves próprias por agente para ingestão e segredos de conectores
  cifrados com AES-256-GCM, AAD por conector e migração legada bloqueada.
- Execução híbrida: runner validado nos backends local, Docker e gateway remoto,
  com allowlist, timeout, limite de saída e heartbeat.
- Métricas: 38 contratos em sete kits, com domínio, fórmula, baseline, owner,
  freshness, confiança, guardrail e impacto decisório.
- Supervisão contínua: outbox transacional, `SKIP LOCKED`, lock por
  tenant/agente, debounce, retry, dead-letter, recuperação de lease, polling e
  SSE durável.
- Experiência: Mission Control acompanha atividade de projeção em polling de
  dois segundos; métricas, Agent 360 e Jornadas A2A ganharam leitura operacional.
- Contrato: OpenAPI inclui autenticação bearer, organizações, KPI/insights,
  saúde do worker, atividade contínua e SSE; clientes React e Zod regenerados.

### Verificadores aprovados

- `pnpm run build`: typecheck do monorepo e builds de API/frontends aprovados.
- `pnpm test`: 289 testes puros aprovados; seis integrações ficam fora da suíte
  padrão por dependerem de PostgreSQL.
- `pnpm run test:integration`: seis testes PostgreSQL de tenancy e outbox
  aprovados em banco migrado.
- `pnpm --filter @workspace/db run migrate`: migrations `0012` e `0013`
  aplicadas com sucesso.
- Docker Compose: configuração validada nos perfis padrão, `agent` e
  `agent-docker`.
- Playwright: doze cenários descobertos — seis públicos em desktop/mobile e
  seis autenticados em desktop.
- `git diff --check`: nenhum erro de whitespace.

### Gate externo restante

O ambiente local não possui `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`,
`VITE_CLERK_PUBLISHABLE_KEY` nem `PLAYWRIGHT_STORAGE_STATE`. Por isso os doze
cenários de browser não foram executados nesta consolidação; o bloqueio é de
configuração externa, não um bypass temporário. O comando reproduzível é
`pnpm run validate:gauntlet` depois de configurar Clerk, iniciar PostgreSQL/API
e fornecer a sessão de teste.

### Próximos gates de escala

- RLS PostgreSQL com transação request-scoped e role sem `BYPASSRLS`.
- KMS/Vault com rotação online e chaves por ambiente ou tenant.
- Testes de carga, retenção/particionamento do outbox e worker independente.
- Broker/fan-out para throughput elevado e milhares de conexões SSE.
- Alertas de heartbeat stale, backlog, dead-letter e guardrails de KPI.
- Fluxos de convite/gestão de membros e autorização contextual na interface.

## Rodada UX — scorecard gerencial multicamada — 2026-08-23

### Objetivo

Unir a clareza do modelo de agente como profissional com a profundidade da
visão gerencial anterior, sem transformar retorno financeiro no único critério.
O gestor deve conseguir ler custo por execução, acurácia, eficácia, eficiência,
adoção, governança, confiabilidade e cumprimento do propósito na mesma jornada.

### Mudanças

- A entrada do Workforce OS passou a ser uma visão gerencial configurável.
- O gestor escolhe quais métricas aparecem sem alterar contratos ou guardrails.
- Custo por execução e economia mensal aparecem junto de qualidade, resultado,
  adoção, governança, confiabilidade e propósito.
- O histórico consolidado compara quatro dimensões durante seis meses.
- O portfólio por equipe preserva cada dimensão em vez de produzir um ranking
  universal opaco.
- A fila de decisões ordena sinais por risco, impacto e prazo e leva ao
  prontuário do agente.
- O prontuário individual recebeu o mesmo scorecard da visão gerencial para não
  perder contexto entre diagnóstico e decisão.
- Um Gauntlet da decisão expõe suficiência de evidência, comparabilidade,
  aderência ao papel, acionabilidade e accountability humana.

### Abordagem corrigida

A primeira direção visual priorizou propósito e contrato, mas removeu métricas,
histórico e economia demais. A rodada seguinte recuperou gráficos e análise de
equipes, porém ainda não oferecia uma entrada gerencial consolidada. A estratégia
final mantém propósito como eixo e trata as demais métricas como lentes
complementares e configuráveis.

### Verificadores

| Verificador | Score | Evidência |
|---|---:|---|
| Clareza gerencial | 9/10 | scorecard agrupado e configurável |
| Profundidade analítica | 9/10 | oito KPIs, histórico e portfólio por equipe |
| Continuidade da jornada | 9/10 | visão gerencial abre prontuário com as mesmas lentes |
| Acionabilidade | 9/10 | fila de decisões e gates antes da execução |
| Não-regressão técnica | 10/10 | typecheck completo, build e 289 testes aprovados |
| Dados reais | 4/10 | experiência ainda usa dados demonstrativos isolados |

### Evidência técnica

- `pnpm run typecheck`: aprovado em todos os projetos do monorepo.
- `pnpm --filter @workspace/muster run build`: aprovado; 2.555 módulos.
- `pnpm test`: 289 testes aprovados; seis integrações PostgreSQL ignoradas pela
  suíte padrão, conforme configuração existente.

### Próxima ação

Promover o scorecard demonstrativo para um contrato OpenAPI aditivo e alimentar
cada lente com telemetria real. O primeiro corte deve cobrir custo por execução,
acurácia, eficácia, eficiência e adoção para um agente de engenharia e uma
jornada A2A, mantendo estados explícitos de `sem evidência` quando não houver
dados suficientes.

## Rodada UX — continuidade de rotas — 2026-08-23

### Falha observada

As rotas canônicas apontavam para componentes legados diferentes, enquanto o
novo Workforce OS mantinha a tela ativa apenas em estado local. Ao navegar pelo
produto, a URL e o shell visual divergiam e o usuário retornava ao modelo antigo.

### Correção

- Um contrato único liga tela, grupo, rótulo e URL canônica.
- Comando, guia, relatórios, portfólio, profissional, métricas, equipes,
  jornadas, benchmarks, conectores e governança usam o mesmo shell produtivo.
- Admissão, alertas, configurações, perfil e conexão de telemetria preservam as
  funções existentes em modo embutido, sem remontar o layout legado.
- A navegação atualiza a URL e a URL restaura a tela correta em reload, voltar e
  avançar do navegador.
- `/frota` permanece como alias compatível do novo portfólio.
- `/agentes/:id/conectar` preserva o ID do agente e abre a integração dentro do
  mesmo shell.
- O atalho de uma linha do portfólio passa explicitamente o agente escolhido,
  eliminando a abertura acidental do profissional selecionado anteriormente.

### Gates

- Contrato puro: rotas e telas únicas, alias controlado e IDs codificados.
- Público: toda rota do novo shell redireciona sem sessão e não vaza conteúdo.
- Autenticado: cada URL deve renderizar `data-workforce-screen` correspondente.
- Jornada: clicar em todos os itens mantém o shell novo e nunca cria
  `.workspace-shell`, marcador do layout legado.
- Portfólio: abrir Vega deve terminar em `/agentes/vega`.
- O comando `validate:gauntlet` inclui os testes puros antes das integrações e
  dos testes de navegador.

### Resultado desta rodada

- Testes focados do frontend: 21/21 aprovados.
- Suíte do monorepo: 317 testes aprovados; oito integrações PostgreSQL são
  condicionais na execução padrão.
- Integrações PostgreSQL dedicadas: 8/8 aprovadas.
- Playwright público: 42/42 aprovados em desktop e mobile.
- Build Vite e typecheck do frontend: aprovados.
- Playwright autenticado: cenários implementados, mas não executados porque
  `PLAYWRIGHT_STORAGE_STATE` não está configurado no ambiente atual.
