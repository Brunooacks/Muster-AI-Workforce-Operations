# Gauntlet operacional

O Gauntlet operacional complementa os testes sintéticos com trabalho que possui
gabarito e resultado observável. A versão 3 cobre oito profissionais:

1. **Atlas Build Sentinel** — executa `git diff --check`, testes da API, do
   runner e do laboratório.
2. **Nara Support Operator** — classifica acesso, cobrança, falha técnica e tentativa
   de prompt injection, preservando o handoff humano.
3. **Dora Finance Reconciler** — reconcilia pagamento exato, divergência,
   duplicidade e ausência.
4. **Lume Opportunity Analyst** — prioriza iniciativas e bloqueia propostas
   sem owner, mesmo quando o retorno aparente é alto.
5. **Cora Context Steward** — valida completude, freshness e confiança dos
   dados recebidos antes da execução.
6. **Iris Policy Guardian** — aplica menor privilégio e exige humano para
   ações irreversíveis ou fora da alçada.
7. **Gaia Handoff Supervisor** — mede perda de contexto, aceite e SLA nas
   transferências de jornadas A2A.
8. **Nexo Hybrid Runtime Router** — escolhe execução local ou fallback cloud
   sem violar residência de dados e orçamento.

Cada admissão é vinculada à área **Laboratório de Stress**, possui três owners,
deveres, proibições, autonomia, limites e 12 métricas distribuídas entre
eficácia, eficiência, adoção, governança e valor. A rotina valida o payload e
relê o prontuário persistido antes de aceitar a admissão como concluída.

Cada perfil recebe uma identidade operacional própria no Muster: **Operação
saudável**, **Carga alta** ou **Falha controlada**. Isso impede que a telemetria
de caos contamine a baseline e permite comparar profissionais com o mesmo papel
sob condições diferentes.

## Perfis

| Perfil | Objetivo | Concorrência | Falhas injetadas |
|---|---|---:|---:|
| `baseline` | Provar o fluxo e capturar a referência | 4 | nenhuma |
| `stress` | Pressionar execução e ingestão | 32 | nenhuma |
| `chaos` | Medir degradação, latência e governança | 16 | 1 a cada 11 |

## Execução sem API

Valida workloads, gabaritos, comandos reais e geração do relatório sem admitir
agentes:

```bash
pnpm --filter @workspace/scripts run gauntlet:operational -- --profile=baseline --offline
pnpm --filter @workspace/scripts run gauntlet:operational -- --profile=stress --offline
pnpm --filter @workspace/scripts run gauntlet:operational -- --profile=chaos --offline
```

## Execução integrada

Com API, PostgreSQL e frontend ativos, exporte um token Clerk de uma sessão com
papel `owner` ou `admin`:

```bash
export MUSTER_AUTH_TOKEN='token-da-sessao'
export MUSTER_BASE_URL='http://localhost:8187'
pnpm run validate:operational -- --profile=stress
```

Para evitar variável de ambiente e histórico acidental, prefira um arquivo
temporário fora do repositório:

```bash
printf '%s' 'token-da-sessao' > /tmp/muster-session-token
chmod 600 /tmp/muster-session-token
pnpm run stress:muster -- --rounds=3 --token-file=/tmp/muster-session-token --base-url=http://localhost:8081
```

Para obter o token sem compartilhá-lo no chat:

1. Entre em `http://localhost:5273/sign-in`.
2. Abra o console do navegador e execute
   `await window.Clerk.session.getToken()`.
3. Copie o valor retornado para o `export` no seu terminal.

## Regra de evidência

O resultado deve ser publicado por camada; testes ignorados nunca contam como
aprovação:

| Camada | O que comprova | O que não comprova |
|---|---|---|
| Contrato estático | rota, seletor ou chamada existem no código | que o usuário consegue concluir o fluxo |
| Unitário | regra pura e tratamento de borda | persistência, autenticação ou integração |
| Integração PostgreSQL | isolamento, transação e efeito persistido | usabilidade no navegador |
| E2E público | landing, login, redirects e responsividade básica | operação autenticada |
| E2E autenticado | clique real, API, persistência e próxima ação | escala, disponibilidade ou provedor externo |
| Operacional/caos | throughput, recuperação e degradação controlada | capacidade cloud ainda não ensaiada |

Nenhum gate pode ser descrito como “funcional” usando somente os testes de
contrato estático. O relatório deve separar `passed`, `failed` e `skipped`, além
de informar se os dados foram simulados, determinísticos ou originados de um
runtime externo.

## Playwright autenticado

A suíte usa `@clerk/testing` e o ticket de teste do Clerk; não há `storageState`
manual, token pessoal ou leitura de `.env`. Cada execução gera um e-mail Clerk
derivado do e-mail-base, um usuário, dois tenants marcados como `musterE2E` e
duas áreas no tenant primário. O teardown remove os tenants no Muster e no Clerk,
remove o usuário marcado e apaga os artefatos locais. Reexecutar o cleanup é
seguro quando um recurso já foi removido.

Configure apenas uma instância Clerk de desenvolvimento/teste. As chaves devem
ser `pk_test_` e `sk_test_`; a suíte recusa chaves de produção e e-mail que não
contenha `+clerk_test@`:

```bash
export CLERK_TEST_PUBLISHABLE_KEY='pk_test_...'
export CLERK_TEST_SECRET_KEY='sk_test_...'
export E2E_CLERK_USER_EMAIL='muster.e2e+clerk_test@example.com'
export E2E_CLERK_ORG_NAME='Muster E2E descartável'
# Opcional; este é o padrão local da MUS-107.
export E2E_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5443/muster'
pnpm --filter @workspace/muster run test:e2e:authenticated
```

O ambiente local reservado é Postgres `muster-mus107-pg` na porta `5443`, API na
`8187` e web na `5273`. A configuração do Playwright define essas duas últimas
portas automaticamente. O comando cria o `storageState` apenas durante a rodada
e o teardown o remove ao final, junto do fixture.

O job `e2e-authenticated` usa os quatro segredos acima no GitHub Actions. A
ausência de qualquer um falha antes de iniciar servidores, indicando exatamente
os nomes faltantes. A imagem do job já inclui Chromium compatível com Playwright;
nenhum comando de instalação de browser é necessário.

As verificações negativas fazem parte do setup: uma sessão válida do tenant
primário recebe `404` ao buscar um agente real do tenant isolado, e um token de
uma sessão Clerk revogada recebe `401` da API.

### Evidência de 7 de setembro de 2026

- Frontend: 51 unitários aprovados, zero ignorados.
- Backend: 278 unitários aprovados; os 18 testes PostgreSQL que o comando comum
  sinaliza como ignorados foram executados separadamente e todos passaram.
- E2E público: 62 jornadas aprovadas em desktop e mobile.
- E2E autenticado: 1 setup Clerk e 28 jornadas aprovadas, incluindo admissão,
  navegação, conectores, dados da API e decisões de aprovar, ajustar e rejeitar.
- Typecheck do frontend aprovado.

Durante essa campanha foram encontrados e corrigidos: autenticação inteira
silenciosamente ignorada; fixture com resposta aninhada interpretada como agente,
gerando `/agentes/undefined`; mutações paralelas no mesmo tenant; dependência de
slug desabilitado no Clerk; e catálogo de métricas maior que a viewport.

Ainda não estão aprovados por essa camada: conectores reais de terceiros,
concorrência de produção, longa duração, recuperação cloud/on-premise, matriz
multiusuário completa, acessibilidade e regressão visual pixel a pixel.

O fluxo integrado lista a frota, admite ou reutiliza cada profissional, emite
uma credencial própria, envia heartbeat, processa e entrega eventos em paralelo,
reavalia, consulta telemetria e confirma o estado de supervisão. A credencial
temporária de cada profissional é revogada ao final da rodada, inclusive quando
uma entrega falha.

## Rotina multiciclo

`stress:muster` executa baseline, carga alta e falha controlada várias vezes. Na
primeira rodada de cada perfil também roda o agente de desenvolvimento; nas
rodadas seguintes concentra a pressão nos sete workloads operacionais, evitando
repetir suítes de testes caras sem reduzir o volume de telemetria.

```bash
# Validação local sem escrever no Muster
pnpm run stress:muster -- --rounds=2 --profiles=baseline,chaos --offline

# Campanha integrada recomendada
pnpm run stress:muster -- --rounds=3 --profiles=baseline,stress,chaos \
  --token-file=/tmp/muster-session-token --base-url=http://localhost:8081
```

Cada campanha gera `routine.json`, `routine.md` e `routine.html` em
`output/gauntlet/routine/<run-id>/`, além do relatório detalhado de cada rodada.

O relatório separa duas naturezas de tempo. O **p50/p95 operacional** representa
o tempo do trabalho modelado no contrato de cada cenário; o **tempo real da
campanha** mede a duração efetiva do processo local. No modo integrado, a
**vazão de ingestão** mede somente a entrega dos eventos à API do Muster. Essa
separação evita confundir uma função determinística rápida com uma operação de
negócio instantânea.

Falhas controladas produzem dois registros correlacionados: a execução com
`success=false` e um evento `error`. Assim, eficácia e taxa de erro degradam de
forma observável, sem retirar a execução do denominador.

O prontuário profissional também possui um ciclo de decisão auditável:

- **Aprovar plano:** libera as ações do agente e cria validação humana com SLA.
- **Solicitar ajuste:** preserva a versão anterior e agenda reformulação e revisão.
- **Rejeitar plano:** bloqueia a execução e transfere a decisão de continuidade ao humano.

Cada decisão exige justificativa, fica isolada por tenant e mantém histórico
append-only com owner, prazo, ator e próximo ciclo de revisão.

Credenciais em texto puro existem apenas em memória durante a execução e nunca
entram no relatório.

## Saída

Cada rodada grava `report.json` e `report.md` em
`output/gauntlet/operational/<run-id>-<perfil>/`. O JSON contém resultados por
item; o Markdown contém a leitura executiva; o HTML traz indicadores e barras
comparáveis.

Depois de executar os três perfis, gere a comparação consolidada:

```bash
pnpm --filter @workspace/scripts run gauntlet:report
```

Abra `output/gauntlet/operational/comparison.html`.

## Laboratório Cenyra

Os agentes locais de exploração também possuem um bridge de admissão:

```bash
# Audita e normaliza o histórico sem escrever no Muster
pnpm --filter @workspace/scripts run bridge:cenyra -- --offline

# Admite os quatro profissionais e entrega o histórico real
pnpm --filter @workspace/scripts run bridge:cenyra
```

O bridge cadastra **Radar Melhor Lance** (LangChain), **Outbid Global Scout**
(CrewAI), **YC RFS Opportunity Miner** (Agno) e **Portfolio Synthesizer**. Cada
execução preserva fonte, framework, registros, links, duração, tokens, custo em
USD, cobertura de tradução/enriquecimento e motivo da degradação. Custo não é
convertido para BRL sem uma política de câmbio explícita.

### Evidência de 2 de setembro de 2026

| Perfil | Execuções | Corretas | Falhas | Qualidade | Achado principal |
|---|---:|---:|---:|---:|---|
| Baseline | 64 | 64 | 0 | 100% | Atlas p95 5,19 s |
| Carga alta | 1.504 | 1.504 | 0 | 100% | Atlas p95 11,61 s sob concorrência |
| Falha controlada | 604 | 550 | 54 | 91,06% | 18 falhas detectadas por agente de negócio |

O Cenyra forneceu 48 execuções históricas e 178 oportunidades. A configuração
LLM encontrada era um placeholder de 11 caracteres apontando para
`localhost:9/unused`; por isso o laboratório permanece em fallback heurístico e
marca a ausência de enriquecimento, em vez de apresentar análise como real.

## Cloud e on-premise

O mesmo contrato deve ser executado em três ambientes antes do piloto:

- **Local:** runner direto e PostgreSQL local.
- **Docker/on-premise:** runner isolado, rede degradada, restart e perda do
  provider com fallback.
- **Cloud:** gateway remoto em AWS, Azure ou GCP, com credencial de workload,
  OpenTelemetry e orçamento por cenário.

Cloud exige uma conta de laboratório, região, orçamento e autorização para
criar recursos. Nenhuma credencial cloud deve ser colocada no repositório.

## Campanha evolutiva

| Onda | Cenário | Evidência esperada | Gate |
|---|---|---|---|
| 0 | Unitário, integração e rotas públicas | 340 testes de código, 14 integrações PostgreSQL e 54 jornadas públicas | concluído |
| 1 | Workloads reais local | qualidade, p50/p95, throughput, custo e decisão por domínio | concluído |
| 2 | Admissão e telemetria integrada | 24 identidades Gauntlet + 4 profissionais Cenyra, credencial individual, heartbeat, execuções e supervisão | token Clerk |
| 3 | Docker/on-premise | isolamento, restart, backlog, replay e recuperação de provider | imagem base disponível |
| 4 | Falhas de dados | pausa do PostgreSQL, outbox, duplicidade, ordenação e idempotência | zero perda e zero dupla contagem |
| 5 | Falhas de execução | CPU, memória, latência, packet loss, timeout e kill do runner | recuperação dentro do SLO |
| 6 | Inferência híbrida | vLLM local indisponível, circuit breaker e fallback cloud | rastreabilidade e orçamento preservados |
| 7 | Cloud | escala, identidade de workload, OpenTelemetry e caos controlado | piloto aprovado |

O plano detalhado, com owners e tarefas automatizadas, está em
`docs/PLANO-GAUNTLET-CENARIOS.md`.

A distinção formal entre persona, runtime, trabalho observado, IA comprovada e
resultado validado está em `docs/VALIDACAO-AGENTES-REAIS.md`.
