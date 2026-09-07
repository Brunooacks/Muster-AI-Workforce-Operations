import { isExecutionBackend, type ExecutionBackend } from "./execution";

export type RunnerMode = "live" | "dry-run";

export interface RunnerConfig {
  baseUrl: string;
  agentId: string;
  authToken: string;
  task: string;
  mode: RunnerMode;
  model: string;
  llmApiKey: string;
  llmBaseUrl?: string;
  backend: ExecutionBackend;
  workspace: string;
  dockerContainer?: string;
  remoteGatewayUrl?: string;
  remoteToken?: string;
  taskTimeoutMs: number;
  maxOutputBytes: number;
  heartbeatIntervalSeconds: number;
  agentVersion: string;
}

export const DEFAULT_TASK =
  "Analise a saúde operacional de um agente de suporte, proponha uma próxima ação e registre a decisão.";

function optional(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = environment[name]?.trim();
  return value || undefined;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = optional(environment, name);
  if (!value) throw new Error(`Variável ${name} é obrigatória.`);
  return value;
}

function positiveInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = optional(environment, name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Variável ${name} deve ser um inteiro positivo.`);
  }
  return value;
}

function httpUrl(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Variável ${name} deve conter uma URL válida.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Variável ${name} deve usar http ou https.`);
  }
  return value.replace(/\/+$/, "");
}

export function parseRunnerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RunnerConfig {
  const modeValue = optional(environment, "AGENT_MODE") ?? "live";
  if (modeValue !== "live" && modeValue !== "dry-run") {
    throw new Error("AGENT_MODE deve ser live ou dry-run.");
  }

  const backendValue = optional(environment, "MUSTER_EXECUTION_BACKEND") ?? "local";
  if (!isExecutionBackend(backendValue)) {
    throw new Error("MUSTER_EXECUTION_BACKEND deve ser local, docker ou remote.");
  }

  const agentId = required(environment, "MUSTER_AGENT_ID");
  const authToken = required(environment, "MUSTER_AUTH_TOKEN");
  const llmApiKey = modeValue === "dry-run"
    ? "dry-run"
    : optional(environment, "OPENAI_API_KEY")
      ?? required(environment, "AI_INTEGRATIONS_OPENAI_API_KEY");

  const remoteGatewayUrl = optional(environment, "MUSTER_EXECUTION_GATEWAY_URL");
  const llmBaseUrl = optional(environment, "OPENAI_BASE_URL")
    ?? optional(environment, "AI_INTEGRATIONS_OPENAI_BASE_URL");

  return {
    baseUrl: httpUrl(
      optional(environment, "MUSTER_BASE_URL") ?? "http://localhost:8080",
      "MUSTER_BASE_URL",
    ),
    agentId,
    authToken,
    task: optional(environment, "AGENT_TASK") ?? DEFAULT_TASK,
    mode: modeValue,
    model: optional(environment, "MUSTER_AGENT_MODEL") ?? "gpt-4o-mini",
    llmApiKey,
    ...(llmBaseUrl
      ? { llmBaseUrl: httpUrl(llmBaseUrl, "OPENAI_BASE_URL") }
      : {}),
    backend: backendValue,
    workspace: optional(environment, "MUSTER_WORKSPACE") ?? process.cwd(),
    ...(optional(environment, "MUSTER_DOCKER_CONTAINER")
      ? { dockerContainer: optional(environment, "MUSTER_DOCKER_CONTAINER") }
      : {}),
    ...(remoteGatewayUrl
      ? {
          remoteGatewayUrl: httpUrl(
            remoteGatewayUrl,
            "MUSTER_EXECUTION_GATEWAY_URL",
          ),
        }
      : {}),
    ...(optional(environment, "MUSTER_EXECUTION_TOKEN")
      ? { remoteToken: optional(environment, "MUSTER_EXECUTION_TOKEN") }
      : {}),
    taskTimeoutMs: positiveInteger(
      environment,
      "MUSTER_TASK_TIMEOUT_MS",
      120_000,
    ),
    maxOutputBytes: positiveInteger(
      environment,
      "MUSTER_MAX_OUTPUT_BYTES",
      120_000,
    ),
    heartbeatIntervalSeconds: positiveInteger(
      environment,
      "MUSTER_HEARTBEAT_INTERVAL_SECONDS",
      30,
    ),
    agentVersion: optional(environment, "MUSTER_AGENT_VERSION") ?? "dev",
  };
}
