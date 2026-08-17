import { describe, expect, it } from "vitest";
import { commandForTask, createTaskExecutor, isTaskKey, taskKeys } from "./execution";

describe("task execution catalog", () => {
  it("accepts only catalogued task keys", () => {
    expect(isTaskKey("run_tests")).toBe(true);
    expect(isTaskKey("rm -rf /" as string)).toBe(false);
    expect(taskKeys()).toContain("validate_compose");
  });

  it("never builds a shell command for the local backend", () => {
    expect(commandForTask("run_tests", { backend: "local" })).toEqual({
      program: "pnpm",
      args: ["test"],
    });
  });

  it("wraps the same allowlisted task for a configured Docker container", () => {
    expect(commandForTask("typecheck", {
      backend: "docker",
      dockerContainer: "muster-agent-workload",
    })).toEqual({
      program: "docker",
      args: ["exec", "muster-agent-workload", "pnpm", "run", "typecheck"],
    });
  });

  it("uses the same task contract through a remote gateway", async () => {
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
    expect(result.backend).toBe("remote");
    expect(result.stdout).toBe("ok");
  });

  it("reports the result of a local task", async () => {
    const executor = createTaskExecutor({
      backend: "local",
      cwd: process.cwd(),
      timeoutMs: 10_000,
    });
    const result = await executor.execute("inspect_workspace");

    expect(result.exitCode).toBe(0);
    expect(result.backend).toBe("local");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
