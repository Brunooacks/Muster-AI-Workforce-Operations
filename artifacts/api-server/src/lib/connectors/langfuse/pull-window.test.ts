import { describe, expect, it } from "vitest";
import { pullLangfuseWindow } from "./pull-window";

const range = {
  from: new Date("2026-10-01T00:00:00.000Z"),
  to: new Date("2026-10-02T00:00:00.000Z"),
};

async function* pages<T>(...values: T[][]): AsyncGenerator<T[]> {
  yield* values;
}

describe("pullLangfuseWindow", () => {
  it("agrupa scores de trace e observação e remove dados sensíveis", async () => {
    const result = await pullLangfuseWindow(
      {
        listProjects: async () => [{ id: "project-f2", name: "Projeto F2" }],
        listObservations: () =>
          pages([
            {
              id: "obs-f2-1",
              traceId: "trace-f2-1",
              traceName: "Agente suporte",
              input: { prompt: "segredo" },
              output: "resposta",
              metadata: { email: "cliente@example.com" },
            },
          ]),
        listScores: () =>
          pages([
            { id: "score-f2-trace", subject: { kind: "trace", id: "trace-f2-1" } },
            {
              id: "score-f2-observation",
              subject: { kind: "observation", id: "obs-f2-1", traceId: "trace-f2-1" },
            },
            { id: "score-f2-session", subject: { kind: "session", id: "session-f2" } },
          ]),
      },
      range,
    );

    expect(result).toMatchObject({
      projectId: "project-f2",
      truncated: false,
      traces: [
        {
          traceId: "trace-f2-1",
          observations: [{ id: "obs-f2-1", traceId: "trace-f2-1" }],
          scores: [{ id: "score-f2-trace" }, { id: "score-f2-observation" }],
        },
      ],
    });
    expect(JSON.stringify(result.traces)).not.toContain("segredo");
    expect(JSON.stringify(result.traces)).not.toContain("cliente@example.com");
    expect(result.warnings).toContain("Score Langfuse ignorado: subject.kind session não é associado a uma trace.");
  });

  it("interrompe ao atingir o máximo de traces", async () => {
    const result = await pullLangfuseWindow(
      {
        listProjects: async () => [{ id: "project-f2", name: "Projeto F2" }],
        listObservations: () =>
          pages([
            { id: "obs-f2-1", traceId: "trace-f2-1" },
            { id: "obs-f2-2", traceId: "trace-f2-2" },
          ]),
        listScores: () => pages([]),
      },
      { ...range, maxTraces: 1 },
    );

    expect(result.truncated).toBe(true);
    expect(result.traces).toEqual([
      { traceId: "trace-f2-1", observations: [{ id: "obs-f2-1", traceId: "trace-f2-1" }], scores: [] },
    ]);
  });

  it("avisa e ignora observações sem traceId", async () => {
    const result = await pullLangfuseWindow(
      {
        listProjects: async () => [{ id: "project-f2", name: "Projeto F2" }],
        listObservations: () => pages([{ id: "obs-sem-trace" }]),
        listScores: () => pages([]),
      },
      range,
    );

    expect(result.traces).toEqual([]);
    expect(result.warnings).toContain("Observação Langfuse ignorada: traceId ausente.");
  });
});
