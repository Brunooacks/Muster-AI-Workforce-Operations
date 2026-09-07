import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { createMusterReporter } from "@workspace/telemetry-reporter";
import { parseRunnerConfig } from "./config";
import { createTaskExecutor, type ExecutionResult } from "./execution";
import { createTaskTools, type WorkNote } from "./task-tools";

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

async function main(): Promise<void> {
  const config = parseRunnerConfig();
  const executor = createTaskExecutor({
    backend: config.backend,
    cwd: config.workspace,
    dockerContainer: config.dockerContainer,
    remoteGatewayUrl: config.remoteGatewayUrl,
    remoteToken: config.remoteToken,
    timeoutMs: config.taskTimeoutMs,
    maxOutputBytes: config.maxOutputBytes,
  });
  const runId = crypto.randomUUID();
  const notes: WorkNote[] = [];
  const taskExecutions: ExecutionResult[] = [];

  const reporter = createMusterReporter({
    baseUrl: config.baseUrl,
    agentId: config.agentId,
    token: config.authToken,
    onError: (error) => console.error(`[telemetry] ${String(error)}`),
  });

  const heartbeatOptions = {
    runtime: config.backend,
    version: config.agentVersion,
    intervalSeconds: config.heartbeatIntervalSeconds,
    status: "healthy",
    metadata: { runId, framework: "langchain", model: config.model },
  } as const;
  const authenticated = await reporter.heartbeat({
    ...heartbeatOptions,
    metadata: { ...heartbeatOptions.metadata, phase: "authentication" },
  });
  if (!authenticated) {
    throw new Error(
      "Falha ao autenticar o runner no Muster. Verifique MUSTER_AGENT_ID e MUSTER_AUTH_TOKEN.",
    );
  }
  const stopHeartbeat = reporter.startHeartbeat(heartbeatOptions);

  try {
    const tools = createTaskTools(notes, executor, taskExecutions);
    const modelConfig = {
      model: config.model,
      temperature: 0.1,
      apiKey: config.llmApiKey,
      ...(config.llmBaseUrl
        ? { configuration: { baseURL: config.llmBaseUrl } }
        : {}),
    };
    const agent = config.mode === "dry-run"
      ? null
      : createAgent({
          model: new ChatOpenAI(modelConfig),
          tools,
          name: "muster_operations_agent",
          systemPrompt:
            "Você é um agente operacional do Muster. Use read_task primeiro. Se a tarefa pedir validação ou execução, use apenas execute_task com uma chave permitida; nunca invente comandos. Registre a decisão com record_work_note. Não execute ações irreversíveis e seja objetivo.",
        });

    console.log(`Executando agente ${config.agentId} (${config.model}, modo=${config.mode})`);
    console.log(`runId=${runId}`);
    console.log(`tarefa=${config.task}`);

    const result = await reporter.trackExecution<RunnerResult>(
      async () => {
        if (!agent) {
          notes.push({
            action: "Validar a integração do runner com o Muster",
            rationale: "Execução dry-run autenticada: sem chamada a modelo externo.",
            createdAt: new Date().toISOString(),
          });
          return {
            messages: [{
              content: "Dry-run concluído: identidade, runner, ferramentas e telemetria estão configurados.",
            }],
          };
        }
        return agent.invoke({ messages: [{ role: "user", content: config.task }] });
      },
      {
        metadata: {
          runId,
          runtime: config.backend,
          executionBackend: config.backend,
          framework: "langchain",
          model: config.model,
          taskType: "operations",
        },
        enrich: usageFromResult,
      },
    );

    const messages = result.messages ?? [];
    const finalMessage = messages[messages.length - 1] as { content?: unknown } | undefined;
    const output = textFromContent(finalMessage?.content ?? "");
    const feedbackDelivered = await reporter.report({
      kind: "feedback",
      success: true,
      metadata: {
        runId,
        runtime: config.backend,
        executionBackend: config.backend,
        framework: "langchain",
        model: config.model,
        taskType: "operations",
        ...usageFromResult(result),
        output: output.slice(0, 2000),
        notes,
        taskExecutions,
      },
    });
    if (!feedbackDelivered) {
      throw new Error("A execução terminou, mas a telemetria final não foi entregue ao Muster.");
    }

    console.log("\nResultado:\n" + output);
    console.log("\nAções registradas:\n" + JSON.stringify(notes, null, 2));
  } finally {
    stopHeartbeat();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
