import { describe, expect, it, vi } from "vitest";
import {
  VELTRIX_RUN_HEADER,
  VELTRIX_TASK_HEADER,
  createMusterReporter,
  taskFromVeltrixHeaders,
  withMusterExecutionContext,
  type AgentEvent,
} from "./index";

function okFetch() {
  return vi.fn(async () => new Response(JSON.stringify({ accepted: true }), { status: 202 }));
}

const base = { baseUrl: "http://muster.local", agentId: "agent-1" };

describe("createMusterReporter", () => {
  it("posts the event to the ingest endpoint with bearer token", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, token: "tok", fetchImpl });

    const ok = await reporter.report({ kind: "execution", success: true, durationMs: 1200 });

    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("http://muster.local/api/agents/agent-1/events");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({
      kind: "execution",
      success: true,
      durationMs: 1200,
    });
  });

  it("serializes Date ts as ISO 8601", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    const ts = new Date("2026-07-01T12:00:00.000Z");

    await reporter.report({ ts });

    const [, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).ts).toBe("2026-07-01T12:00:00.000Z");
  });

  it("never throws: network failure resolves false and hits onError", async () => {
    const onError = vi.fn();
    const reporter = createMusterReporter({
      ...base,
      onError,
      fetchImpl: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    await expect(reporter.report({})).resolves.toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("non-2xx resolves false", async () => {
    const reporter = createMusterReporter({
      ...base,
      fetchImpl: vi.fn(async () => new Response("{}", { status: 404 })),
    });
    await expect(reporter.report({})).resolves.toBe(false);
  });

  it("reportMany counts only delivered events", async () => {
    let calls = 0;
    const reporter = createMusterReporter({
      ...base,
      fetchImpl: vi.fn(async () => {
        calls += 1;
        return new Response("{}", { status: calls === 2 ? 500 : 202 });
      }),
    });
    const delivered = await reporter.reportMany([{}, {}, {}]);
    expect(delivered).toBe(2);
  });

  it("trackExecution reports success with duration and enrichment", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });

    const result = await reporter.trackExecution(
      async () => ({ answer: 42, tokens: 100 }),
      { enrich: (r) => ({ tokensOut: (r as { tokens: number }).tokens }) },
    );

    expect(result.answer).toBe(42);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchImpl.mock.calls[0]! as unknown as [string, RequestInit])[1].body as string,
    ) as AgentEvent;
    expect(body.kind).toBe("execution");
    expect(body.success).toBe(true);
    expect(body.tokensOut).toBe(100);
    expect(typeof body.durationMs).toBe("number");
  });

  it("adds a versioned execution manifest without collecting raw input", async () => {
    const metadata = withMusterExecutionContext(
      { feature: "qualification" },
      {
        correlation: { runId: "run-1", journeyId: "journey-1" },
        release: { releaseId: "release-7", group: "canary" },
        configuration: { model: "model-a", promptVersion: "prompt-3" },
        input: {
          taskClass: "lead-qualification",
          hash: "sha256:input",
          captureMode: "metadata_only",
        },
        context: {
          captureMode: "local_only",
          required: ["crm-account"],
          sources: [{ type: "api", ref: "crm-account", status: "available" }],
        },
      },
    );

    expect(metadata).toEqual({
      feature: "qualification",
      muster: {
        schemaVersion: "1.0",
        correlation: { runId: "run-1", journeyId: "journey-1" },
        release: { releaseId: "release-7", group: "canary" },
        configuration: { model: "model-a", promptVersion: "prompt-3" },
        input: {
          taskClass: "lead-qualification",
          hash: "sha256:input",
          captureMode: "metadata_only",
        },
        context: {
          captureMode: "local_only",
          required: ["crm-account"],
          sources: [{ type: "api", ref: "crm-account", status: "available" }],
        },
      },
    });
    expect(JSON.stringify(metadata)).not.toContain("rawInput");
  });

  it("trackExecution carries the manifest on success and error", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    const executionContext = {
      release: { releaseId: "release-8" },
      input: { taskClass: "support", captureMode: "metadata_only" as const },
    };

    await reporter.trackExecution(() => "ok", { executionContext });
    await expect(reporter.trackExecution(() => {
      throw new Error("failed");
    }, { executionContext })).rejects.toThrow("failed");

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    const bodies = fetchImpl.mock.calls.map((call) => {
      const [, init] = call as unknown as [string, RequestInit];
      return JSON.parse(init.body as string);
    });
    expect(bodies[0].metadata.muster.release.releaseId).toBe("release-8");
    expect(bodies[1].metadata.muster.release.releaseId).toBe("release-8");
    expect(bodies[1].metadata.message).toBe("failed");
  });

  it("trackExecution reports kind=error and re-throws", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });

    await expect(
      reporter.trackExecution(() => {
        throw new Error("agent exploded");
      }),
    ).rejects.toThrow("agent exploded");

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchImpl.mock.calls[0]! as unknown as [string, RequestInit])[1].body as string,
    ) as AgentEvent;
    expect(body.kind).toBe("error");
    expect((body.metadata as { message: string }).message).toBe("agent exploded");
  });
});

describe("tarefas (cunha · C1.4)", () => {
  function bodies(fetchImpl: ReturnType<typeof okFetch>) {
    return fetchImpl.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string));
  }

  it("startTask → report leva taskId/runId/attempt 1, sem retryOf", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    const run = reporter.startTask({ taskId: "task-1", runId: "run-1" });

    await run.report({ kind: "execution", success: true, costCents: 4, contextTokens: 300, model: "m-small" });

    expect(bodies(fetchImpl)).toEqual([
      {
        kind: "execution",
        success: true,
        costCents: 4,
        contextTokens: 300,
        model: "m-small",
        taskId: "task-1",
        runId: "run-1",
        attempt: 1,
      },
    ]);
  });

  it("retry calcula attempt e retryOf a partir do run anterior (encadeado)", () => {
    const reporter = createMusterReporter({ ...base, fetchImpl: okFetch() });
    const first = reporter.startTask({ taskId: "task-1", runId: "run-1" });
    const second = reporter.retry(first, { runId: "run-2" });
    const third = second.retry({ runId: "run-3" });

    expect({ ...second }).toMatchObject({ taskId: "task-1", runId: "run-2", attempt: 2, retryOf: "run-1" });
    expect({ ...third }).toMatchObject({ taskId: "task-1", runId: "run-3", attempt: 3, retryOf: "run-2" });
  });

  it("startTask sem ids gera ids distintos", () => {
    const reporter = createMusterReporter({ ...base, fetchImpl: okFetch() });
    const a = reporter.startTask();
    const b = reporter.startTask();
    expect(a.taskId).not.toBe(b.taskId);
    expect(a.runId).not.toBe(a.taskId);
    expect(a.attempt).toBe(1);
  });

  it("review manda human_review com decisão, minutos e revisor", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    const run = reporter.retry({ taskId: "task-1", runId: "run-1", attempt: 1 }, { runId: "run-2" });

    await run.review({ approved: false, minutes: 6.5, by: "ana@cliente" });

    expect(bodies(fetchImpl)).toEqual([
      {
        kind: "human_review",
        taskId: "task-1",
        runId: "run-2",
        attempt: 2,
        success: false,
        acceptedBy: "ana@cliente",
        humanMinutes: 6.5,
      },
    ]);
  });

  it("accept auto leva regra e versão; human não leva versão", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    const run = reporter.startTask({ taskId: "t", runId: "r" });

    await run.accept({ by: "regra:schema-ok", kind: "auto", ruleVersion: "v3" });
    await reporter.accept(run, { by: "revisora", kind: "human" });

    expect(bodies(fetchImpl)).toEqual([
      { kind: "feedback", taskId: "t", runId: "r", attempt: 1, acceptedBy: "regra:schema-ok", acceptedByKind: "auto", acceptedRuleVersion: "v3" },
      { kind: "feedback", taskId: "t", runId: "r", attempt: 1, acceptedBy: "revisora", acceptedByKind: "human" },
    ]);
  });

  it("rework vira reworkCount e acceptedAt Date vira ISO", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    await reporter.report({ rework: 2, acceptedAt: new Date("2026-10-01T00:00:00.000Z") });
    expect(bodies(fetchImpl)).toEqual([{ reworkCount: 2, acceptedAt: "2026-10-01T00:00:00.000Z" }]);
  });

  it("trackExecution do run leva os campos da tarefa no sucesso e no erro", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    const run = reporter.startTask({ taskId: "t", runId: "r" });

    await run.trackExecution(async () => "ok", { enrich: () => ({ costCents: 2 }) });
    await expect(run.retry({ runId: "r2" }).trackExecution(async () => { throw new Error("falhou"); })).rejects.toThrow("falhou");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const [ok, erro] = bodies(fetchImpl);
    expect(ok).toMatchObject({ kind: "execution", success: true, costCents: 2, taskId: "t", runId: "r", attempt: 1 });
    expect(erro).toMatchObject({ kind: "error", taskId: "t", runId: "r2", attempt: 2, retryOf: "r" });
  });

  it("taskFromVeltrixHeaders lê x-veltrix-task/x-veltrix-run de objeto ou Headers", () => {
    expect(VELTRIX_TASK_HEADER).toBe("x-veltrix-task");
    expect(VELTRIX_RUN_HEADER).toBe("x-veltrix-run");
    expect(taskFromVeltrixHeaders({ "X-Veltrix-Task": "t1", "x-veltrix-run": ["r1"] })).toEqual({ taskId: "t1", runId: "r1" });
    expect(taskFromVeltrixHeaders(new Headers({ "x-veltrix-task": "t2" }))).toEqual({ taskId: "t2" });
  });

  it("evento antigo (sem campos de tarefa) sai igual ao da versão anterior", async () => {
    const fetchImpl = okFetch();
    const reporter = createMusterReporter({ ...base, fetchImpl });
    const legado: AgentEvent = { kind: "escalation", durationMs: 5, metadata: { a: 1 } };
    await reporter.report(legado);
    expect(bodies(fetchImpl)).toEqual([{ kind: "escalation", durationMs: 5, metadata: { a: 1 } }]);
  });
});
