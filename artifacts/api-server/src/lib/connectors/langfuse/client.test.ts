import { describe, expect, it, vi } from "vitest";
import { createLangfuseClient } from "./client";
import {
  f2Credential,
  f2ObservationPages,
  f2ProjectsResponse,
  f2ScorePages,
} from "./fixtures/f2-api";

const range = {
  from: new Date("2026-10-01T00:00:00.000Z"),
  to: new Date("2026-10-02T00:00:00.000Z"),
};

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

async function collect<T>(pages: AsyncIterable<T[]>): Promise<T[]> {
  const result: T[] = [];
  for await (const page of pages) result.push(...page);
  return result;
}

describe("createLangfuseClient", () => {
  it("pagina observações em três requisições com os campos permitidos", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(f2ObservationPages[0]))
      .mockResolvedValueOnce(json(f2ObservationPages[1]))
      .mockResolvedValueOnce(json(f2ObservationPages[2]));
    const client = createLangfuseClient({ credential: f2Credential, fetchImpl });

    const observations = await collect(client.listObservations(range));

    expect(observations.map((observation) => observation.id)).toEqual([
      "obs-f2-1",
      "obs-f2-2",
      "obs-f2-3",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const urls = fetchImpl.mock.calls.map(([url]) => String(url));
    const queries = urls.map((url) => new URL(url).searchParams);
    expect(queries.every((query) => query.get("fields") === "core,basic,usage,model,metrics")).toBe(true);
    expect(queries.every((query) => !query.has("io") && !query.has("metadata"))).toBe(true);
    expect(urls[1]).toContain("cursor=f2-observations-page-2");
    expect(urls[2]).toContain("cursor=f2-observations-page-3");
  });

  it("autentica em Basic e envia AbortSignal para cada requisição", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(f2ProjectsResponse));
    const client = createLangfuseClient({ credential: f2Credential, fetchImpl });

    await expect(client.listProjects()).resolves.toEqual(f2ProjectsResponse.data);

    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init.headers as Headers).get("authorization")).toBe(
      `Basic ${Buffer.from("pk-lf-f2-public:sk-lf-f2-secret").toString("base64")}`,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
  });

  it("pagina scores apenas com os campos permitidos", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ ...f2ScorePages[0], meta: { limit: 1000, cursor: "f2-scores-page-2" } }))
      .mockResolvedValueOnce(json(f2ScorePages[0]));
    const client = createLangfuseClient({ credential: f2Credential, fetchImpl });

    const scores = await collect(client.listScores(range));

    expect(scores.map((score) => score.id)).toEqual(["score-f2-1", "score-f2-1"]);
    const queries = fetchImpl.mock.calls.map(([url]) => new URL(String(url)).searchParams);
    expect(queries.every((query) => query.get("fields") === "subject,annotation,details")).toBe(true);
    expect(queries.every((query) => !query.has("io") && !query.has("metadata"))).toBe(true);
    expect(queries.every((query) => query.get("limit") === "100")).toBe(true);
    expect(queries[1]!.get("cursor")).toBe("f2-scores-page-2");
  });

  it("respeita Retry-After ao receber 429", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "rate limited" }, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(json(f2ProjectsResponse));
    const client = createLangfuseClient({ credential: f2Credential, fetchImpl, sleep });

    await client.listProjects();

    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("respeita Retry-After no formato de data HTTP", async () => {
    const now = 1_790_000_000_000;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        json({ error: "rate limited" }, 429, { "retry-after": new Date(now + 3_000).toUTCString() }),
      )
      .mockResolvedValueOnce(json(f2ProjectsResponse));
    const client = createLangfuseClient({ credential: f2Credential, fetchImpl, sleep });

    await client.listProjects();

    expect(sleep).toHaveBeenCalledWith(3_000);
    dateNow.mockRestore();
  });

  it("repete 5xx até o limite e devolve erro tipado", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(json({ error: "indisponível" }, 503));
    const client = createLangfuseClient({ credential: f2Credential, fetchImpl, sleep });

    await expect(client.listProjects()).rejects.toMatchObject({
      code: "langfuse_request_failed",
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("não repete 401 e devolve o erro de autorização", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ error: "unauthorized" }, 401));
    const client = createLangfuseClient({ credential: f2Credential, fetchImpl });

    await expect(client.listProjects()).rejects.toMatchObject({
      code: "langfuse_unauthorized",
      status: 401,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
