# Gauntlet Progress — Muster

## Estado global

- Branch: `codex/feat/gauntlet-1-validator`
- Rodadas concluídas: 1 — validador E2E; 2 — zero dado semeado por padrão
- Próxima rodada: 3 — credencial própria por agente
- Baseline capturado em: 2026-08-14
- Orçamento de rodadas restante: 23
- Limite temporal informado: 6 horas

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
- Comitê: decisões `approved`/`disagreed` persistidas com `dev-user`, data,
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
