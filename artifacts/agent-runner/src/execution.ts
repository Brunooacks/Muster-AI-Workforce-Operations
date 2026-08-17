import { spawn } from "node:child_process";

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

export function isTaskKey(value: string): value is TaskKey {
  return TASK_KEYS.includes(value as TaskKey);
}

export function taskKeys(): TaskKey[] {
  return [...TASK_KEYS];
}

export function commandForTask(
  taskKey: TaskKey,
  options: Pick<TaskExecutorOptions, "backend" | "dockerContainer">,
): CommandSpec {
  const task = TASKS[taskKey];
  if (!task) throw new Error(`Tarefa não permitida: ${taskKey}`);

  if (options.backend === "local") return { program: task.program, args: [...task.args] };
  if (options.backend === "remote") {
    throw new Error("Backend remote não possui comando local; use o gateway de execução.");
  }
  if (!options.dockerContainer) {
    throw new Error("MUSTER_DOCKER_CONTAINER é obrigatório no backend docker.");
  }

  return {
    program: "docker",
    args: ["exec", options.dockerContainer, task.program, ...task.args],
  };
}

function truncate(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  return `${Buffer.from(value, "utf8").subarray(0, maxBytes).toString("utf8")}\n[output truncated]`;
}

export function createTaskExecutor(options: TaskExecutorOptions): TaskExecutor {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxOutputBytes = options.maxOutputBytes ?? 120_000;
  const doFetch = options.fetchImpl ?? fetch;

  async function executeRemote(taskKey: TaskKey): Promise<ExecutionResult> {
    if (!options.remoteGatewayUrl) {
      throw new Error("MUSTER_EXECUTION_GATEWAY_URL é obrigatório no backend remote.");
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(
        `${options.remoteGatewayUrl.replace(/\/+$/, "")}/tasks`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(options.remoteToken
              ? { authorization: `Bearer ${options.remoteToken}` }
              : {}),
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
          stderr: typeof payload.stderr === "string" ? payload.stderr : `Gateway respondeu ${response.status}`,
          durationMs: Date.now() - startedAt,
        };
      }
      return {
        taskKey,
        backend: "remote",
        command: typeof payload.command === "string" ? payload.command : `remote:${taskKey}`,
        exitCode: typeof payload.exitCode === "number" ? payload.exitCode : 0,
        stdout: typeof payload.stdout === "string" ? truncate(payload.stdout, maxOutputBytes) : "",
        stderr: typeof payload.stderr === "string" ? truncate(payload.stderr, maxOutputBytes) : "",
        durationMs: typeof payload.durationMs === "number" ? payload.durationMs : Date.now() - startedAt,
      };
    } catch (error) {
      return {
        taskKey,
        backend: "remote",
        command: `remote:${taskKey}`,
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function execute(taskKey: TaskKey): Promise<ExecutionResult> {
    if (options.backend === "remote") return executeRemote(taskKey);
    const spec = commandForTask(taskKey, options);
    const startedAt = Date.now();
    const output: string[] = [];
    const errors: string[] = [];

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(spec.program, spec.args, {
        cwd: options.cwd,
        env: process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let settled = false;
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        if (!settled) {
          settled = true;
          resolve(124);
        }
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer | string) => output.push(String(chunk)));
      child.stderr.on("data", (chunk: Buffer | string) => errors.push(String(chunk)));
      child.on("error", (error) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        resolve(code ?? 1);
      });
    });

    return {
      taskKey,
      backend: options.backend,
      command: [spec.program, ...spec.args].join(" "),
      exitCode,
      stdout: truncate(output.join(""), maxOutputBytes),
      stderr: truncate(errors.join(""), maxOutputBytes),
      durationMs: Date.now() - startedAt,
    };
  }

  return { execute };
}
