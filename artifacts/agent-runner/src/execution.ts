import { spawn } from "node:child_process";
import { statSync } from "node:fs";

export type ExecutionBackend = "local" | "docker" | "remote";

export type TaskKey =
  | "inspect_workspace"
  | "run_tests"
  | "typecheck"
  | "validate_compose";

export interface ExecutionResult {
  taskKey: TaskKey;
  backend: ExecutionBackend;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface TaskExecutorOptions {
  backend: ExecutionBackend;
  cwd: string;
  dockerContainer?: string;
  remoteGatewayUrl?: string;
  remoteToken?: string;
  fetchImpl?: typeof fetch;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface TaskExecutor {
  execute(taskKey: TaskKey): Promise<ExecutionResult>;
}

interface CommandSpec {
  program: string;
  args: string[];
}

const TASKS: Record<TaskKey, CommandSpec> = {
  inspect_workspace: { program: "git", args: ["status", "--short"] },
  run_tests: { program: "pnpm", args: ["test"] },
  typecheck: { program: "pnpm", args: ["run", "typecheck"] },
  validate_compose: { program: "docker", args: ["compose", "config", "--quiet"] },
};

const TASK_KEYS = Object.keys(TASKS) as TaskKey[];
const OUTPUT_TRUNCATED_MARKER = "\n[output truncated]";
const MIN_OUTPUT_BYTES = Buffer.byteLength(OUTPUT_TRUNCATED_MARKER, "utf8") + 1;

export function isExecutionBackend(value: string): value is ExecutionBackend {
  return value === "local" || value === "docker" || value === "remote";
}

export function isTaskKey(value: string): value is TaskKey {
  return TASK_KEYS.includes(value as TaskKey);
}

export function taskKeys(): TaskKey[] {
  return [...TASK_KEYS];
}

export function commandForTask(
  taskKey: TaskKey,
  options: Pick<TaskExecutorOptions, "backend" | "cwd" | "dockerContainer">,
): CommandSpec {
  const task = TASKS[taskKey];
  if (!task) throw new Error(`Tarefa não permitida: ${taskKey}`);
  if (!isExecutionBackend(options.backend)) {
    throw new Error(`Backend de execução inválido: ${String(options.backend)}`);
  }

  if (options.backend === "local") return { program: task.program, args: [...task.args] };
  if (options.backend === "remote") {
    throw new Error("Backend remote não possui comando local; use o gateway de execução.");
  }
  if (!options.dockerContainer) {
    throw new Error("MUSTER_DOCKER_CONTAINER é obrigatório no backend docker.");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(options.dockerContainer)) {
    throw new Error("MUSTER_DOCKER_CONTAINER contém caracteres inválidos.");
  }

  return {
    program: "docker",
    args: [
      "exec",
      "--workdir",
      options.cwd,
      options.dockerContainer,
      task.program,
      ...task.args,
    ],
  };
}

function utf8Prefix(buffer: Buffer, maxBytes: number): Buffer {
  let end = Math.min(maxBytes, buffer.length);
  while (end > 0 && end < buffer.length && (buffer[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return buffer.subarray(0, end);
}

export function truncateOutput(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8");
  return truncateBuffer(buffer, maxBytes);
}

function truncateBuffer(buffer: Buffer, maxBytes: number): string {
  if (buffer.length <= maxBytes) return buffer.toString("utf8");
  const marker = Buffer.from(OUTPUT_TRUNCATED_MARKER, "utf8");
  const prefix = utf8Prefix(buffer, maxBytes - marker.length);
  return Buffer.concat([prefix, marker]).toString("utf8");
}

class BoundedOutput {
  private readonly chunks: Buffer[] = [];
  private totalBytes = 0;
  private retainedBytes = 0;

  constructor(private readonly maxBytes: number) {}

  append(chunk: Buffer | string): void {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
    this.totalBytes += buffer.length;
    const retainLimit = this.maxBytes + 4;
    const remaining = retainLimit - this.retainedBytes;
    if (remaining <= 0) return;
    const retained = buffer.subarray(0, remaining);
    this.chunks.push(retained);
    this.retainedBytes += retained.length;
  }

  render(): string {
    const value = Buffer.concat(this.chunks);
    return this.totalBytes > this.maxBytes
      ? truncateBuffer(value, this.maxBytes)
      : value.toString("utf8");
  }
}

function validateDirectory(cwd: string): void {
  try {
    if (!statSync(cwd).isDirectory()) {
      throw new Error("não é um diretório");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`MUSTER_WORKSPACE inválido (${cwd}): ${detail}`);
  }
}

function validateOptions(options: TaskExecutorOptions): void {
  if (!isExecutionBackend(options.backend)) {
    throw new Error(`Backend de execução inválido: ${String(options.backend)}`);
  }
  if (!Number.isSafeInteger(options.timeoutMs ?? 120_000) || (options.timeoutMs ?? 120_000) <= 0) {
    throw new Error("timeoutMs deve ser um inteiro positivo.");
  }
  if (!Number.isSafeInteger(options.maxOutputBytes ?? 120_000)
    || (options.maxOutputBytes ?? 120_000) < MIN_OUTPUT_BYTES) {
    throw new Error(`maxOutputBytes deve ser um inteiro maior ou igual a ${MIN_OUTPUT_BYTES}.`);
  }
  if (options.backend !== "remote") validateDirectory(options.cwd);
  if (options.backend === "docker") {
    commandForTask("inspect_workspace", options);
  }
  if (options.backend === "remote") {
    if (!options.remoteGatewayUrl) {
      throw new Error("MUSTER_EXECUTION_GATEWAY_URL é obrigatório no backend remote.");
    }
    if (!options.remoteToken?.trim()) {
      throw new Error("MUSTER_EXECUTION_TOKEN é obrigatório no backend remote.");
    }
    try {
      const gateway = new URL(options.remoteGatewayUrl);
      if (gateway.protocol !== "http:" && gateway.protocol !== "https:") {
        throw new Error("protocolo não suportado");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`MUSTER_EXECUTION_GATEWAY_URL inválida: ${detail}`);
    }
  }
}

export function createTaskExecutor(options: TaskExecutorOptions): TaskExecutor {
  validateOptions(options);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxOutputBytes = options.maxOutputBytes ?? 120_000;
  const doFetch = options.fetchImpl ?? fetch;

  async function executeRemote(taskKey: TaskKey): Promise<ExecutionResult> {
    const remoteGatewayUrl = options.remoteGatewayUrl!;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(
        `${remoteGatewayUrl.replace(/\/+$/, "")}/tasks`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${options.remoteToken}`,
          },
          body: JSON.stringify({ taskKey }),
          signal: controller.signal,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as Partial<ExecutionResult>;
      if (!response.ok) {
        return {
          taskKey,
          backend: "remote",
          command: `remote:${taskKey}`,
          exitCode: response.status,
          stdout: "",
          stderr: typeof payload.stderr === "string"
            ? truncateOutput(payload.stderr, maxOutputBytes)
            : `Gateway respondeu ${response.status}`,
          durationMs: Date.now() - startedAt,
        };
      }
      if (typeof payload.exitCode !== "number" || !Number.isFinite(payload.exitCode)) {
        return {
          taskKey,
          backend: "remote",
          command: `remote:${taskKey}`,
          exitCode: 1,
          stdout: "",
          stderr: "Gateway retornou uma resposta inválida: exitCode ausente.",
          durationMs: Date.now() - startedAt,
        };
      }
      return {
        taskKey,
        backend: "remote",
        command: typeof payload.command === "string" ? payload.command : `remote:${taskKey}`,
        exitCode: payload.exitCode,
        stdout: typeof payload.stdout === "string" ? truncateOutput(payload.stdout, maxOutputBytes) : "",
        stderr: typeof payload.stderr === "string" ? truncateOutput(payload.stderr, maxOutputBytes) : "",
        durationMs: typeof payload.durationMs === "number" ? payload.durationMs : Date.now() - startedAt,
      };
    } catch (error) {
      const timedOut = controller.signal.aborted
        || (error instanceof Error && error.name === "AbortError");
      return {
        taskKey,
        backend: "remote",
        command: `remote:${taskKey}`,
        exitCode: timedOut ? 124 : 1,
        stdout: "",
        stderr: timedOut
          ? `Tarefa remota excedeu o timeout de ${timeoutMs}ms.`
          : error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function execute(taskKey: TaskKey): Promise<ExecutionResult> {
    if (!isTaskKey(taskKey)) throw new Error(`Tarefa não permitida: ${String(taskKey)}`);
    if (options.backend === "remote") return executeRemote(taskKey);
    const spec = commandForTask(taskKey, options);
    const startedAt = Date.now();
    const output = new BoundedOutput(maxOutputBytes);
    const errors = new BoundedOutput(maxOutputBytes);

    const exitCode = await new Promise<number>((resolve) => {
      let settled = false;
      let timedOut = false;
      let killTimer: NodeJS.Timeout | undefined;
      let child: ReturnType<typeof spawn>;

      const terminate = (signal: NodeJS.Signals) => {
        if (process.platform !== "win32" && child.pid) {
          try {
            process.kill(-child.pid, signal);
            return;
          } catch {}
        }
        child.kill(signal);
      };

      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        resolve(code);
      };

      try {
        child = spawn(spec.program, spec.args, {
          cwd: options.cwd,
          env: options.environment ?? process.env,
          detached: process.platform !== "win32",
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        errors.append(`Falha ao iniciar ${spec.program}: ${error instanceof Error ? error.message : String(error)}`);
        resolve(127);
        return;
      }

      const timer = setTimeout(() => {
        timedOut = true;
        errors.append(`\nTarefa excedeu o timeout de ${timeoutMs}ms.`);
        terminate("SIGTERM");
        killTimer = setTimeout(() => {
          terminate("SIGKILL");
          finish(124);
        }, 1_000);
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer | string) => output.append(chunk));
      child.stderr?.on("data", (chunk: Buffer | string) => errors.append(chunk));
      child.on("error", (error) => {
        errors.append(`Falha ao iniciar ${spec.program}: ${error.message}`);
        finish(timedOut ? 124 : 127);
      });
      child.on("close", (code) => {
        finish(timedOut ? 124 : code ?? 1);
      });
    });

    return {
      taskKey,
      backend: options.backend,
      command: [spec.program, ...spec.args].join(" "),
      exitCode,
      stdout: output.render(),
      stderr: errors.render(),
      durationMs: Date.now() - startedAt,
    };
  }

  return { execute };
}
