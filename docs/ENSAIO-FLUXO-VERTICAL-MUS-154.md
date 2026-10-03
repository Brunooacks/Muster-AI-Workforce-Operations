# MUS-154 — ensaio do fluxo vertical local

## Objetivo e limite da evidência

Este registro separa a preparação verificável do ensaio autenticado. A execução
foi feita em ambiente local isolado, sem usar dados pessoais, segredos ou
serviços de produção. Uma etapa só é marcada como aprovada quando houver
evidência executada; preparação, código existente e documentação não substituem
o fluxo autenticado.

## Ambiente reservado

| Componente | Valor do ensaio |
|---|---|
| PostgreSQL | container `muster-mus154-pg`, `127.0.0.1:5444` |
| API | `http://127.0.0.1:8287` (pendente de chaves Clerk de desenvolvimento) |
| Web | `http://127.0.0.1:5373` (pendente de chaves Clerk de desenvolvimento) |
| Banco | `muster` |

O banco foi criado exclusivamente para este ensaio e recebeu todas as migrations
com sucesso. O container será removido ao encerrar a campanha.

## Evidência pré-login executada

| Etapa | Comando | Resultado |
|---|---|---|
| Instalação reprodutível | `pnpm install --frozen-lockfile` | aprovado; lockfile inalterado |
| Schema PostgreSQL | `DATABASE_URL=…:5444/muster pnpm --filter @workspace/db run migrate` | aprovado |
| Gauntlet operacional baseline | `pnpm run validate:operational -- --profile=baseline --offline` | aprovado: 164/164 workloads corretos |
| Avaliação rápida de maturidade | `pnpm run evaluate:maturity` | gerou relatório; 8/100 em modo `fast`, sem gates executados |

Artefatos locais ignorados pelo Git:

- `output/gauntlet/operational/2026-10-01T00-13-11-948Z-baseline/report.{json,md,html}`
- `output/maturity/2026-10-01T00-13-11-511Z/report.{json,md,html}`

O baseline offline cobriu Atlas, Nara, Dora, Lume, Cora, Iris, Gaia e Nexo. Ele
prova os workloads e seus gabaritos, mas não prova admissão, autorização,
telemetria persistida, dashboard ou decisões na interface.

## Comparação com 07/09/2026

A baseline anterior registrou **64/100**, estágio seguro **design partners**,
com integrações PostgreSQL, E2E autenticado e E2E público aprovados. O resultado
rápido atual de **8/100** não deve ser lido como queda de 56 pontos: em
`--mode=fast`, o avaliador não roda suites e classifica os gates como ausentes
naquela invocação. A comparação válida será atualizada somente depois de executar
`pnpm run evaluate:maturity -- --mode=full --base-url=http://127.0.0.1:5373`
com a sessão Clerk de desenvolvimento.

## Roteiro autenticado pendente

1. Iniciar API em `8287` e web em `5373` com chaves Clerk de desenvolvimento
   fornecidas pelo Bruno, sem gravá-las em arquivo.
2. Bruno entrar na aplicação e ativar uma organização de teste.
3. Admitir um agente pelo fluxo da interface e emitir a credencial do agente.
4. Enviar evento real por `@workspace/telemetry-reporter` ou script, usando a
   credencial temporária; confirmar métrica no dashboard.
5. Criar ou abrir equipe/jornada e registrar as três decisões: aprovar, solicitar
   ajuste e rejeitar, cada uma com sua justificativa de teste.
6. Abrir o relatório executivo e capturar screenshots locais sem dados pessoais.
7. Executar `pnpm run validate:operational` integrado e a avaliação de maturidade
   completa; anexar os caminhos dos relatórios e o resultado final nesta página.

## Estado atual

- Fluxo autenticado: **pendente de chaves Clerk de desenvolvimento e login do Bruno**.
- P0/P1: nenhum identificado nesta fase pré-login.
- Capturas de tela: pendentes da sessão autenticada.

