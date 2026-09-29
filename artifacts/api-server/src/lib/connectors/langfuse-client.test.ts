import { describe, expect, it, vi } from "vitest";

import {
  LangfusePublicClient,
  parseLangfuseCredentialBundle,
  validateLangfuseBaseUrl,
} from "./langfuse-client";

describe("parseLangfuseCredentialBundle", () => {
  it("accepts the versioned Langfuse credential bundle", () => {
    expect(
      parseLangfuseCredentialBundle(
        JSON.stringify({
          version: 1,
          baseUrl: "https://cloud.langfuse.com/",
          publicKey: "pk-lf-example-public-key",
          secretKey: "sk-lf-example-secret-key",
          environment: "production",
        }),
      ),
    ).toEqual({
      version: 1,
      baseUrl: "https://cloud.langfuse.com",
      publicKey: "pk-lf-example-public-key",
      secretKey: "sk-lf-example-secret-key",
      environment: "production",
    });
  });

  it.each([
    "not json",
    JSON.stringify({ version: 2 }),
    JSON.stringify({ version: 1, baseUrl: "https://cloud.langfuse.com", publicKey: "", secretKey: "secret" }),
  ])("rejects malformed credential data", (serialized) => {
    expect(() => parseLangfuseCredentialBundle(serialized)).toThrow(
      "Invalid Langfuse credential bundle",
    );
  });
});

describe("validateLangfuseBaseUrl", () => {
  it("only permits HTTPS public URLs by default", () => {
    expect(validateLangfuseBaseUrl("https://langfuse.example.com/api/")).toBe(
      "https://langfuse.example.com/api",
    );
    expect(() => validateLangfuseBaseUrl("http://langfuse.example.com")).toThrow(
      "Langfuse URL must use HTTPS",
    );
    expect(() => validateLangfuseBaseUrl("https://user:pass@langfuse.example.com")).toThrow(
      "Langfuse URL cannot contain credentials",
    );
  });

  it("permits local HTTP only when explicitly enabled", () => {
    expect(() => validateLangfuseBaseUrl("http://localhost:3000")).toThrow(
      "Langfuse URL must use HTTPS",
    );
    expect(
      validateLangfuseBaseUrl("http://localhost:3000/", { allowLoopbackHttp: true }),
    ).toBe("http://localhost:3000");
  });
});

describe("LangfusePublicClient", () => {
  it("uses bounded observations queries without IO fields and classifies an empty project", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { page: 1, totalPages: 1 } }), { status: 200 }),
    );
    const client = new LangfusePublicClient(
      {
        version: 1,
        baseUrl: "https://cloud.langfuse.com",
        publicKey: "pk-lf-public",
        secretKey: "sk-lf-secret",
      },
      {
        fetch: fetchMock,
        lookup: vi.fn().mockResolvedValue([{ address: "104.18.18.84", family: 4 }]),
      },
    );

    await expect(client.testConnection()).resolves.toEqual({ status: "empty_project" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/public/v2/observations?");
    expect(String(url)).toContain("fields=core%2Cbasic%2Cmetadata%2Cusage%2Cmetrics%2Ctrace_context");
    expect(String(url)).toContain("fromStartTime=");
    expect(String(url)).toContain("toStartTime=");
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("pk-lf-public:sk-lf-secret").toString("base64")}`,
    });
  });

  it("does not follow redirects to protect connector credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://untrusted.example" } }),
    );
    const client = new LangfusePublicClient(
      {
        version: 1,
        baseUrl: "https://cloud.langfuse.com",
        publicKey: "pk-lf-public",
        secretKey: "sk-lf-secret",
      },
      {
        fetch: fetchMock,
        lookup: vi.fn().mockResolvedValue([{ address: "104.18.18.84", family: 4 }]),
      },
    );

    await expect(client.testConnection()).resolves.toEqual({ status: "rejected_url" });
  });

  it("rejects targets that resolve to a private network address", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new LangfusePublicClient(
      {
        version: 1,
        baseUrl: "https://langfuse.example.com",
        publicKey: "pk-lf-public",
        secretKey: "sk-lf-secret",
      },
      {
        fetch: fetchMock,
        lookup: vi.fn().mockResolvedValue([{ address: "10.0.0.5", family: 4 }]),
      },
    );

    await expect(client.testConnection()).resolves.toEqual({ status: "rejected_url" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not accept oversized API responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-length": "1024" },
      }),
    );
    const client = new LangfusePublicClient(
      {
        version: 1,
        baseUrl: "https://cloud.langfuse.com",
        publicKey: "pk-lf-public",
        secretKey: "sk-lf-secret",
      },
      {
        fetch: fetchMock,
        lookup: vi.fn().mockResolvedValue([{ address: "104.18.18.84", family: 4 }]),
        maxResponseBytes: 100,
      },
    );

    await expect(client.testConnection()).resolves.toEqual({ status: "unavailable" });
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [404, "incompatible"],
    [429, "rate_limited"],
    [503, "unavailable"],
  ] as const)("classifies HTTP %i safely", async (status, expected) => {
    const client = new LangfusePublicClient(
      {
        version: 1,
        baseUrl: "https://cloud.langfuse.com",
        publicKey: "pk-lf-public",
        secretKey: "sk-lf-secret",
      },
      {
        fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status })),
        lookup: vi.fn().mockResolvedValue([{ address: "104.18.18.84", family: 4 }]),
      },
    );

    await expect(client.testConnection()).resolves.toEqual({ status: expected });
  });

  it("classifies aborted requests without exposing credentials", async () => {
    const client = new LangfusePublicClient(
      {
        version: 1,
        baseUrl: "https://cloud.langfuse.com",
        publicKey: "pk-lf-public",
        secretKey: "sk-lf-secret",
      },
      {
        fetch: vi.fn<typeof fetch>().mockRejectedValue(new DOMException("aborted", "AbortError")),
        lookup: vi.fn().mockResolvedValue([{ address: "104.18.18.84", family: 4 }]),
      },
    );

    await expect(client.testConnection()).resolves.toEqual({ status: "timeout" });
  });
});
