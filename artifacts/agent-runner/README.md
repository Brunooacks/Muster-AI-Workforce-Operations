# Muster Agent Runner

Runner mínimo de um agente operacional usando `createAgent` do LangChain JS.
Ele executa uma tarefa, usa ferramentas, registra a decisão e envia eventos de
execução/erro/feedback para o Muster.

## Validar sem LLM

1. Suba o Postgres e a API com `AUTH_DEV_BYPASS=true`.
2. Garanta que exista pelo menos um agente admitido no Muster.
3. Execute:

```bash
AGENT_MODE=dry-run \
MUSTER_BASE_URL=http://localhost:8080 \
pnpm --filter @workspace/agent-runner run start
```

O `dry-run` não chama um provedor de modelo: valida resolução do agente,
ferramentas, medição de duração e ingestão de telemetria.

## Tarefas permitidas

O agente não recebe shell arbitrário. A ferramenta `execute_task` só aceita as
chaves `inspect_workspace`, `run_tests`, `typecheck` e `validate_compose`.
Assim, uma tarefa pode ser medida e auditada sem transformar o runner em um
terminal remoto irrestrito.

## Executar em Docker

```bash
docker compose up -d postgres
AGENT_MODE=dry-run docker compose --profile agent run --rm agent-runner
```

Para executar de verdade, use `AGENT_MODE=live`, `OPENAI_API_KEY` e, se
necessário, `OPENAI_BASE_URL` para um endpoint compatível.

Para executar uma tarefa dentro de um container já existente, habilite o
backend Docker explicitamente. Isso exige acesso ao socket Docker e ao nome do
container alvo:

```bash
MUSTER_DOCKER_CONTAINER=muster-agent-workload \
docker compose --profile agent-docker run --rm agent-runner-docker
```

Esse perfil é deliberadamente separado: montar o socket Docker equivale a dar
controle elevado sobre o daemon do host.

Para cloud ou on-premise, o runner pode delegar a mesma tarefa a um worker
remoto. O worker recebe `POST /tasks` com `{ "taskKey": "run_tests" }` e deve
retornar `exitCode`, `stdout`, `stderr`, `durationMs` e opcionalmente `command`:

```bash
MUSTER_EXECUTION_BACKEND=remote \
MUSTER_EXECUTION_GATEWAY_URL=https://worker.example.com \
MUSTER_EXECUTION_TOKEN=... \
pnpm --filter @workspace/agent-runner run start
```

## Contrato operacional

- `read_task`: lê contexto e restrições da tarefa.
- `record_work_note`: registra a próxima ação recomendada.
- `execute_task`: executa somente tarefas do catálogo allowlisted.
- `execution`: duração, sucesso e tokens quando o modelo os retornar.
- `error`: falha da execução com mensagem no metadata.
- `feedback`: saída final e notas para auditoria.
