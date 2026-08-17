import { describe, expect, it } from "vitest";
import { createTaskTools, type WorkNote } from "./task-tools";
import type { ExecutionResult } from "./execution";

describe("agent task tools", () => {
  it("records an operational work note", async () => {
    const notes: WorkNote[] = [];
    const [, recordWorkNote] = createTaskTools(notes);
    const result = await recordWorkNote.invoke({
      action: "Revisar a taxa de sucesso nas próximas 24 horas",
      rationale: "A tarefa exige confirmação antes de uma mudança irreversível.",
    });

    expect(result).toContain("Ação registrada");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.action).toContain("taxa de sucesso");
  });

  it("executes only a catalogued task and keeps its result for telemetry", async () => {
    const notes: WorkNote[] = [];
    const executions: ExecutionResult[] = [];
    const fakeResult: ExecutionResult = {
      taskKey: "typecheck",
      backend: "local",
      command: "pnpm run typecheck",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      durationMs: 4,
    };
    const [, , executeTask] = createTaskTools(notes, {
      execute: async () => fakeResult,
    }, executions);

    const result = await executeTask.invoke({ taskKey: "typecheck" });

    expect(JSON.parse(result)).toMatchObject({ ok: true, taskKey: "typecheck" });
    expect(executions).toEqual([fakeResult]);
    expect(notes[0]?.action).toBe("Executar tarefa typecheck");
  });
});
