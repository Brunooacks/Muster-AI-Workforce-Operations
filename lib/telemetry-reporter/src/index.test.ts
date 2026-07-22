import { describe, expect, it, vi } from "vitest";
import { createMusterReporter, type AgentEvent } from "./index";

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
