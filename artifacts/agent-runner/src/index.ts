import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { createMusterReporter } from "@workspace/telemetry-reporter";
import { createTaskExecutor, type ExecutionBackend, type ExecutionResult } from "./execution";
import { createTaskTools, type WorkNote } from "./task-tools";

const DEFAULT_TASK =
  "Analise a saúde operacional de um agente de suporte, proponha uma próxima ação e registre a decisão.";

function env(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Variável ${name} é obrigatória.`);
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("\n")
    .trim();
}

interface RunnerResult {
  messages?: Array<{
    content?: unknown;
    usage_metadata?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  }>;
}

function usageFromResult(result: unknown): { tokensIn?: number; tokensOut?: number } {
  const messages = (result as RunnerResult).messages ?? [];
  const usage = messages[messages.length - 1]?.usage_metadata;
  return {
    ...(usage?.input_tokens !== undefined ? { tokensIn: usage.input_tokens } : {}),
    ...(usage?.output_tokens !== undefined ? { tokensOut: usage.output_tokens } : {}),
  };
}

async function api<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api${path}`);
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

async function resolveAgentId(baseUrl: string): Promise<string> {
  const configured = process.env.MUSTER_AGENT_ID?.trim();
  if (configured) return configured;
  const agents = await api<Array<{ id: string }>>(baseUrl, "/agents");
  const first = agents[0];
  if (!first) throw new Error("Nenhum agente encontrado. Defina MUSTER_AGENT_ID ou admita um agente primeiro.");
  return first.id;
}

async function main(): Promise<void> {
  const baseUrl = env("MUSTER_BASE_URL", "http://localhost:8080");
  const agentId = await resolveAgentId(baseUrl);
  const task = env("AGENT_TASK", DEFAULT_TASK);
  const mode = env("AGENT_MODE", "live");
  const model = env("MUSTER_AGENT_MODEL", "gpt-4o-mini");
  const apiKey = mode === "dry-run"
    ? "dry-run"
    : env("OPENAI_API_KEY", process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
  const baseURL = process.env.OPENAI_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const backend = env("MUSTER_EXECUTION_BACKEND", "local") as ExecutionBackend;
  if (backend !== "local" && backend !== "docker" && backend !== "remote") {
    throw new Error("MUSTER_EXECUTION_BACKEND deve ser local, docker ou remote.");
  }
  const executor = createTaskExecutor({
    backend,
    cwd: env("MUSTER_WORKSPACE", process.cwd()),
    dockerContainer: process.env.MUSTER_DOCKER_CONTAINER,
    remoteGatewayUrl: process.env.MUSTER_EXECUTION_GATEWAY_URL,
    remoteToken: process.env.MUSTER_EXECUTION_TOKEN,
    timeoutMs: Number(process.env.MUSTER_TASK_TIMEOUT_MS ?? 120_000),
  });
  const runId = crypto.randomUUID();
  const notes: WorkNote[] = [];
  const taskExecutions: ExecutionResult[] = [];

  const reporter = createMusterReporter({
    baseUrl,
    agentId,
    token: process.env.MUSTER_AUTH_TOKEN,
    onError: (error) => console.error(`[telemetry] ${String(error)}`),
  });

  const heartbeatIntervalSeconds = Number(process.env.MUSTER_HEARTBEAT_INTERVAL_SECONDS ?? 30);
  reporter.startHeartbeat({
    runtime: backend,
    version: process.env.MUSTER_AGENT_VERSION ?? "dev",
    intervalSeconds: heartbeatIntervalSeconds,
    status: "healthy",
    metadata: { runId, framework: "langchain", model },
  });

  const tools = createTaskTools(notes, executor, taskExecutions);
  const modelConfig = {
    model,
    temperature: 0.1,
    apiKey,
    ...(baseURL ? { configuration: { baseURL } } : {}),
  };
  const agent = mode === "dry-run"
    ? null
    : createAgent({
        model: new ChatOpenAI(modelConfig),
        tools,
        name: "muster_operations_agent",
        systemPrompt:
          "Você é um agente operacional do Muster. Use read_task primeiro. Se a tarefa pedir validação ou execução, use apenas execute_task com uma chave permitida; nunca invente comandos. Registre a decisão com record_work_note. Não execute ações irreversíveis e seja objetivo.",
      });

  console.log(`Executando agente ${agentId} (${model}, modo=${mode})`);
  console.log(`runId=${runId}`);
  console.log(`tarefa=${task}`);

  const result = await reporter.trackExecution<RunnerResult>(
    async () => {
      if (!agent) {
        notes.push({
          action: "Validar a integração do runner com o Muster",
          rationale: "Execução local dry-run: sem chamada a modelo externo.",
          createdAt: new Date().toISOString(),
        });
        return {
          messages: [{
            content: "Dry-run concluído: runner, ferramentas e telemetria estão configurados.",
          }],
        };
      }
      return agent.invoke({ messages: [{ role: "user", content: task }] });
    },
    {
      metadata: {
        runId,
        runtime: backend,
        executionBackend: backend,
        framework: "langchain",
        model,
        taskType: "operations",
      },
      enrich: usageFromResult,
    },
  );

  const messages = result.messages ?? [];
  const finalMessage = messages[messages.length - 1] as { content?: unknown } | undefined;
  const output = textFromContent(finalMessage?.content ?? "");
  await reporter.report({
    kind: "feedback",
    success: true,
    metadata: {
      runId,
      runtime: backend,
      executionBackend: backend,
      framework: "langchain",
      model,
      taskType: "operations",
      ...usageFromResult(result),
      output: output.slice(0, 2000),
      notes,
      taskExecutions,
    },
  });

  console.log("\nResultado:\n" + output);
  console.log("\nAções registradas:\n" + JSON.stringify(notes, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
