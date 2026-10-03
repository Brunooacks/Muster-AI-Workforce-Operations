# Go/no-go do MVP — design partners convidados

Este roteiro transforma os gates de `docs/MVP-GO-LIVE-2026-09-05.md` em uma
decisão reproduzível para o MVP. Ele não autoriza deploy, acesso ao domínio,
SSH, nem uso de segredos: essas ações continuam sob responsabilidade do Bruno.

> A validação no domínio real ocorre somente depois da MUS-158. Até lá, registre
> o resultado como pendente na MUS-162; não marque **Go** por evidência local.

## Regra de decisão

Declare **Go** somente com todos os itens obrigatórios aprovados, evidências
anexadas à MUS-162 e zero condição de no-go. Declare **No-go** diante de bypass
de autenticação, `5xx` no fluxo vertical, vazamento entre organizações, evento
perdido ou duplicado, CTA crítico sem persistência, relatório vazio tratado como
conclusão, ou migration sem rollback comprovado.

`<dominio>`, `<sha-da-release>` e demais valores entre `<...>` são
placeholders. Nunca coloque tokens, senhas, certificados ou URLs privadas nesta
documentação ou na issue.

## Checklist público e de infraestrutura

| Gate                            | Comando / evidência                                                                                                                                                                                                                                        | Responsável                  | Depende do Bruno?         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------- |
| Corte aprovado                  | SHA do commit, PR e CI verde (`typecheck`, `test`, `build`, `actionlint`) anexados à MUS-162                                                                                                                                                               | Codex                        | Não                       |
| DNS e TLS                       | `MUSTER_REQUIRE_TLS=true pnpm release:smoke -- https://<dominio>`; guardar saída com `PASS TLS certificate validated` e, se enviado, o cabeçalho HSTS                                                                                                      | Bruno executa; Codex confere | Sim: domínio e DNS        |
| Healthz da release              | `MUSTER_EXPECTED_SHA=<sha-da-release> pnpm release:smoke -- https://<dominio>`; guardar `PASS /api/healthz sha=<sha-da-release>`                                                                                                                           | Codex                        | Sim: domínio              |
| Healthz do worker               | Saída do smoke deve conter `PASS /api/healthz/worker status=200`                                                                                                                                                                                           | Codex                        | Sim: domínio              |
| Rotas públicas                  | `pnpm release:smoke -- https://<dominio>`; registrar a saída de todas as páginas e da rota 404                                                                                                                                                             | Codex                        | Sim: domínio              |
| Rota protegida sem sessão       | `MUSTER_CHECK_AUTH=true pnpm release:smoke -- https://<dominio>`; guardar `PASS /api/organizations status=401`                                                                                                                                             | Codex                        | Sim: domínio              |
| SSE pelo Cloudflare sem sessão  | `MUSTER_CHECK_SSE=true pnpm release:smoke -- https://<dominio>`; guardar `PASS /api/telemetry/activity/stream status=401 within=5s`                                                                                                                        | Codex                        | Sim: domínio e Cloudflare |
| SSE autenticado pelo Cloudflare | No navegador autenticado, abrir o fluxo que consome atividade contínua; em DevTools/Network confirmar `200`, `content-type: text/event-stream`, `cache-control: no-cache, no-transform` e ausência de buffering. Registrar screenshot sem dados sensíveis. | Codex                        | Sim: Clerk prod e domínio |
| Acesso por convite              | Confirmar que o usuário de teste convidado entra; um usuário não convidado não recebe acesso. Registrar somente status e screenshot sanitizado.                                                                                                            | Bruno executa; Codex confere | Sim: Clerk prod           |
| Segredos                        | Conferir que arquivos e saída de comandos não contêm segredos; usar somente variáveis no host. Evidência: revisão do ambiente pelo Bruno, sem imprimir valores.                                                                                            | Bruno                        | Sim: secrets              |

O smoke só pode comprovar o `401` não autenticado. Cabeçalhos e entrega de
eventos SSE após autenticação exigem sessão válida e, portanto, pertencem ao
roteiro manual abaixo.

## Roteiro manual autenticado

Faça o roteiro em uma janela normal e em uma janela anônima, com duas
organizações de teste distintas (`Organização A` e `Organização B`). Registre
para cada etapa o horário, a URL sem query sensível, o resultado esperado e uma
captura sanitizada.

1. Com a conta convidada da Organização A, acesse `https://<dominio>`, faça
   login e confirme a organização ativa. Faça logout e confirme que uma rota
   protegida volta a responder `401` sem sessão.
2. Entre novamente e confirme que a organização pode ser provisionada ou
   selecionada sem intervenção direta no banco.
3. Admita ou conecte um agente real autorizado para o piloto. Anote o
   identificador mascarado e confirme que a admissão persiste após recarregar a
   página.
4. Gere um evento real do agente. Confirme no dashboard que o evento chegou,
   que a métrica esperada mudou e que a atividade contínua aparece pelo SSE.
5. Crie ou edite uma métrica, uma equipe e uma jornada. Recarregue a aplicação
   após cada operação e confirme que cada alteração persistiu.
6. Na decisão operacional, execute aprovação, ajuste e rejeição em registros
   apropriados. Confirme o histórico persistido e auditável de cada resultado.
7. Gere o relatório executivo para o mesmo período e organização. Compare os
   números com dashboard e métricas; o relatório não pode estar vazio nem usar
   dado sintético como se fosse real.
8. Em uma janela anônima, entre com a Organização B. Tente consultar, pela UI,
   uma rota e um relatório conhecidos da Organização A. A evidência esperada é
   ausência de acesso ou `404`/`403`, nunca dados da Organização A.
9. Retorne à Organização A e confirme que seus dados permanecem visíveis e
   coerentes. Registre qualquer `5xx`, atraso excessivo, duplicação ou perda de
   evento como no-go.

## Operação, recuperação e encerramento

| Gate               | Comando / evidência                                                                                                                                                                  | Responsável                    | Depende do Bruno?        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------ |
| Backup pré-release | Executar o procedimento aprovado em `deploy/remote-deploy.sh`; registrar timestamp, identificador mascarado do backup e retenção, sem expor destino ou credenciais                   | Bruno executa; Codex acompanha | Sim: SSH, host e secrets |
| Restore ensaiado   | Restaurar o backup em ambiente autorizado e comprovar healthz, organização e relatório consistentes; anexar duração e resultado sanitizado                                           | Bruno executa; Codex confere   | Sim: SSH, host e secrets |
| Rollback ensaiado  | Seguir o rollback automático/documentado em `deploy/remote-deploy.sh`; comprovar retorno à imagem anterior e `MUSTER_EXPECTED_SHA=<sha-anterior>` no smoke                           | Bruno executa; Codex confere   | Sim: SSH, host e secrets |
| Runbook            | Conferir que responsáveis conhecem os procedimentos de deploy, rollback, restore, rotação e incidente descritos no runbook de release (MUS-167); registrar owner e horário do ensaio | Bruno + Codex                  | Sim: acesso operacional  |
| Decisão final      | Anexar à MUS-162 as saídas sanitizadas, screenshots e uma tabela de gates; registrar `Go` ou `No-go`, pendências e o responsável pelo aceite                                         | Codex + Bruno                  | Sim: aceite do Bruno     |

Se qualquer evidência acima faltar, a decisão é **No-go** até a correção e a
reexecução do gate correspondente. A execução de SSH, deploy, rollback e restore
não é realizada por este roteiro automaticamente.
