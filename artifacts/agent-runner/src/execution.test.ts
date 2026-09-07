import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  commandForTask,
  createTaskExecutor,
  isTaskKey,
  taskKeys,
  truncateOutput,
  type TaskKey,
} from "./execution";

const temporaryDirectories: string[] = [];

function executionFixture(program: string) {
  const root = mkdtempSync(join(tmpdir(), "muster-runner-"));
  temporaryDirectories.push(root);
  const bin = join(root, "bin");
  const workspace = join(root, "workspace");
  mkdirSync(bin);
  mkdirSync(workspace);
  const executable = join(bin, "git");
  writeFileSync(executable, `#!/usr/bin/env node\n${program}\n`, "utf8");
  chmodSync(executable, 0o755);
  return {
    workspace,
    environment: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
    },
  };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("task execution catalog", () => {
  it("accepts only exact catalogued task keys", () => {
    expect(isTaskKey("run_tests")).toBe(true);
    expect(isTaskKey("rm -rf /")).toBe(false);
    expect(isTaskKey("run_tests; cat /etc/passwd")).toBe(false);
    expect(taskKeys()).toEqual([
      "inspect_workspace",
      "run_tests",
      "typecheck",
      "validate_compose",
    ]);
  });

  it("never builds a shell command for the local backend", () => {
    expect(commandForTask("run_tests", {
      backend: "local",
      cwd: "/workspace",
    })).toEqual({
      program: "pnpm",
      args: ["test"],
    });
  });

  it("rejects a task outside the allowlist even after a type cast", () => {
    expect(() => commandForTask("run_tests && whoami" as TaskKey, {
      backend: "local",
      cwd: "/workspace",
    })).toThrow("Tarefa não permitida");
  });

  it("wraps a Docker task without shell and with an explicit workspace", () => {
    expect(commandForTask("typecheck", {
      backend: "docker",
      cwd: "/workspace",
      dockerContainer: "muster-agent-workload",
    })).toEqual({
      program: "docker",
      args: [
        "exec",
        "--workdir",
        "/workspace",
        "muster-agent-workload",
        "pnpm",
        "run",
        "typecheck",
      ],
    });
  });

  it("rejects Docker container names that could be parsed as arguments", () => {
    expect(() => commandForTask("typecheck", {
      backend: "docker",
      cwd: "/workspace",
      dockerContainer: "--privileged",
    })).toThrow("caracteres inválidos");
  });
});

describe("task executor configuration", () => {
  it("rejects a missing workspace before spawning", () => {
    expect(() => createTaskExecutor({
      backend: "local",
      cwd: "/workspace/that/does/not/exist",
    })).toThrow("MUSTER_WORKSPACE inválido");
  });

  it("requires both URL and token for a remote worker", () => {
    expect(() => createTaskExecutor({
      backend: "remote",
      cwd: process.cwd(),
      remoteGatewayUrl: "https://worker.internal",
    })).toThrow("MUSTER_EXECUTION_TOKEN");
    expect(() => createTaskExecutor({
      backend: "remote",
      cwd: process.cwd(),
      remoteToken: "secret",
    })).toThrow("MUSTER_EXECUTION_GATEWAY_URL");
  });

  it("rejects invalid limits and remote protocols", () => {
    expect(() => createTaskExecutor({
      backend: "local",
      cwd: process.cwd(),
      timeoutMs: 0,
    })).toThrow("timeoutMs");
    expect(() => createTaskExecutor({
      backend: "remote",
      cwd: process.cwd(),
      remoteGatewayUrl: "file:///tmp/worker",
      remoteToken: "secret",
    })).toThrow("URL inválida");
  });
});

describe("remote execution", () => {
  it("uses the same task contract with a mandatory bearer token", async () => {
    let requestBody = "";
    const executor = createTaskExecutor({
      backend: "remote",
      cwd: process.cwd(),
      remoteGatewayUrl: "http://worker.internal",
      remoteToken: "secret",
      fetchImpl: async (_input, init) => {
        requestBody = String(init?.body ?? "");
        expect(init?.headers).toMatchObject({ authorization: "Bearer secret" });
        return new Response(JSON.stringify({
          exitCode: 0,
          stdout: "ok",
          command: "worker:run_tests",
          durationMs: 12,
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    const result = await executor.execute("run_tests");
    expect(requestBody).toBe(JSON.stringify({ taskKey: "run_tests" }));
    expect(result).toMatchObject({
      backend: "remote",
      exitCode: 0,
      stdout: "ok",
    });
  });

  it("fails closed when the gateway omits exitCode", async () => {
    const executor = createTaskExecutor({
      backend: "remote",
      cwd: process.cwd(),
      remoteGatewayUrl: "http://worker.internal",
      remoteToken: "secret",
      fetchImpl: async () => new Response(JSON.stringify({ stdout: "looks good" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(executor.execute("run_tests")).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining("exitCode ausente"),
    });
  });

  it("reports a remote timeout with exit code 124", async () => {
    const executor = createTaskExecutor({
      backend: "remote",
      cwd: process.cwd(),
      remoteGatewayUrl: "http://worker.internal",
      remoteToken: "secret",
      timeoutMs: 10,
      fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    });

    await expect(executor.execute("run_tests")).resolves.toMatchObject({
      exitCode: 124,
      stderr: expect.stringContaining("timeout"),
    });
  });
});

describe("local execution", () => {
  it("reports a successful allowlisted task", async () => {
    const fixture = executionFixture('process.stdout.write("clean")');
    const executor = createTaskExecutor({
      backend: "local",
      cwd: fixture.workspace,
      environment: fixture.environment,
      timeoutMs: 10_000,
    });

    const result = await executor.execute("inspect_workspace");

    expect(result).toMatchObject({
      exitCode: 0,
      backend: "local",
      stdout: "clean",
      stderr: "",
    });
  });

  it("returns a structured spawn error", async () => {
    const root = mkdtempSync(join(tmpdir(), "muster-runner-"));
    temporaryDirectories.push(root);
    const executor = createTaskExecutor({
      backend: "local",
      cwd: root,
      environment: { ...process.env, PATH: root },
    });

    const result = await executor.execute("inspect_workspace");

    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain("Falha ao iniciar git");
  });

  it("terminates a task that exceeds its timeout", async () => {
    const fixture = executionFixture("setInterval(() => undefined, 10_000)");
    const executor = createTaskExecutor({
      backend: "local",
      cwd: fixture.workspace,
      environment: fixture.environment,
      timeoutMs: 20,
    });

    const result = await executor.execute("inspect_workspace");

    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("timeout de 20ms");
  });

  it("truncates UTF-8 output within the configured byte limit", async () => {
    const fixture = executionFixture('process.stdout.write("🚀".repeat(100))');
    const executor = createTaskExecutor({
      backend: "local",
      cwd: fixture.workspace,
      environment: fixture.environment,
      maxOutputBytes: 64,
    });

    const result = await executor.execute("inspect_workspace");

    expect(result.stdout).toContain("[output truncated]");
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(64);
    expect(result.stdout).not.toContain("�");
  });

  it("truncates plain values without exceeding the byte limit", () => {
    const result = truncateOutput("á".repeat(100), 40);
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(40);
    expect(result).toContain("[output truncated]");
    expect(result).not.toContain("�");
  });
});
