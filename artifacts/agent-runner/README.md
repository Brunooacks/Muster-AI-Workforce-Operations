# Muster Agent Runner

Runner operacional usando LangChain JS. Ele executa tarefas allowlisted em um
workspace, registra decisões e envia heartbeat, execução, erro e feedback para
o Muster usando a identidade de máquina do próprio agente.

## Identidade obrigatória

O runner não usa sessão humana, não descobre agentes por listagem e não possui
atalho de autenticação. Todos os modos, inclusive `dry-run`, exigem:

- `MUSTER_AGENT_ID`: identidade do agente já admitido no tenant.
- `MUSTER_AUTH_TOKEN`: API key emitida especificamente para esse agente.
- `MUSTER_BASE_URL`: origem da API do Muster; padrão `http://localhost:8080`.

Na inicialização, o runner envia um heartbeat autenticado. Credenciais
inválidas, agente incorreto, API indisponível ou telemetria final não entregue
fazem o processo terminar com erro. Nunca reutilize cookie ou token de uma
sessão humana como `MUSTER_AUTH_TOKEN`.

## Dry-run autenticado

O `dry-run` não chama um modelo externo, mas valida identidade, heartbeat e
ingestão de telemetria reais:

```bash
AGENT_MODE=dry-run \
MUSTER_AGENT_ID=agent-id \
MUSTER_AUTH_TOKEN=agent-api-key \
MUSTER_BASE_URL=http://localhost:8080 \
MUSTER_WORKSPACE="$PWD" \
pnpm --filter @workspace/agent-runner run start
```

Para o modo `live`, informe também `OPENAI_API_KEY`. Endpoints compatíveis com
a API da OpenAI podem ser usados com `OPENAI_BASE_URL`.

## Catálogo seguro

`execute_task` aceita apenas estas chaves:

- `inspect_workspace`: `git status --short`.
- `run_tests`: `pnpm test`.
- `typecheck`: `pnpm run typecheck`.
- `validate_compose`: `docker compose config --quiet`.

As chamadas usam `spawn` sem shell e sem argumentos fornecidos pelo modelo. O
runner valida o diretório, limita stdout/stderr, encerra tarefas por timeout e
registra erros de inicialização como resultado auditável. Configure limites com
`MUSTER_TASK_TIMEOUT_MS` e `MUSTER_MAX_OUTPUT_BYTES`.

## Imagem Docker e workspace montado

A imagem contém somente o runner e suas dependências. O projeto avaliado não é
copiado para ela: deve ser montado em `/workspace` e estar preparado com as
dependências compatíveis com Linux.

```bash
docker build \
  --target runner \
  -f artifacts/agent-runner/Dockerfile \
  -t muster-agent-runner .

docker run --rm \
  --mount type=bind,src="$PWD",dst=/workspace \
  --add-host=host.docker.internal:host-gateway \
  -e AGENT_MODE=dry-run \
  -e MUSTER_AGENT_ID=agent-id \
  -e MUSTER_AUTH_TOKEN=agent-api-key \
  -e MUSTER_BASE_URL=http://host.docker.internal:8080 \
  muster-agent-runner
```

A imagem padrão possui Git e pnpm, mas não Docker CLI. Isso cobre os backends
`local` e `remote` mantendo a imagem menor e sem acesso ao daemon do host. Para
executar `validate_compose` no backend local, use também a variante
`runner-docker`; o socket não precisa ser montado quando a tarefa apenas valida
o arquivo Compose.

## Backend Docker

Use o alvo `runner-docker` somente quando o runner precisar executar a tarefa
dentro de outro container. O container alvo também deve expor o workspace no
mesmo caminho configurado em `MUSTER_WORKSPACE`:

```bash
docker build \
  --target runner-docker \
  -f artifacts/agent-runner/Dockerfile \
  -t muster-agent-runner:docker .

docker run --rm \
  --mount type=bind,src="$PWD",dst=/workspace \
  --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
  -e MUSTER_EXECUTION_BACKEND=docker \
  -e MUSTER_DOCKER_CONTAINER=muster-agent-workload \
  -e MUSTER_WORKSPACE=/workspace \
  -e MUSTER_AGENT_ID=agent-id \
  -e MUSTER_AUTH_TOKEN=agent-api-key \
  -e MUSTER_BASE_URL=http://host.docker.internal:8080 \
  muster-agent-runner:docker
```

Montar `/var/run/docker.sock` concede ao runner controle equivalente ao do
daemon e potencialmente do host. Restrinja essa opção a workers dedicados,
execute com credenciais mínimas e nunca exponha o socket em workloads não
confiáveis.

## Backend remote e on-premises

O backend `remote` delega somente a chave allowlisted para um gateway controlado
em cloud, edge ou on-premises. Telemetria e execução possuem credenciais
separadas:

```bash
MUSTER_EXECUTION_BACKEND=remote \
MUSTER_EXECUTION_GATEWAY_URL=https://worker.example.com \
MUSTER_EXECUTION_TOKEN=worker-api-key \
MUSTER_AGENT_ID=agent-id \
MUSTER_AUTH_TOKEN=agent-api-key \
pnpm --filter @workspace/agent-runner run start
```

O gateway recebe `POST /tasks` com `{ "taskKey": "run_tests" }` e deve retornar
`exitCode`, `stdout`, `stderr`, `durationMs` e opcionalmente `command`. O token
do gateway é obrigatório, o timeout é propagado pelo cancelamento HTTP e saídas
remotas recebem o mesmo limite aplicado às execuções locais.

## Contrato operacional

- `read_task`: lê contexto e restrições da tarefa.
- `record_work_note`: registra uma próxima ação verificável.
- `execute_task`: executa somente tarefas do catálogo.
- `heartbeat`: autenticação da identidade e disponibilidade do runtime.
- `execution`: duração, sucesso, backend e tokens quando disponíveis.
- `error`: falha com contexto do run.
- `feedback`: saída final, notas e execuções para auditoria.
