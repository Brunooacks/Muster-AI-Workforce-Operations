import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { readSmokeEnvironment, runQuickstartSmoke } from "./quickstart-smoke.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

async function fakeMuster() {
  const acceptedKeys = new Set();
  const receivedEvents = [];
  const server = createServer(async (request, response) => {
    const body = JSON.parse(await new Response(request).text());
    if (request.headers.authorization !== "Bearer token-valido") {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Credencial do agente inválida ou revogada." }));
      return;
    }
    if (request.url?.endsWith("/heartbeat")) {
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify({ accepted: true }));
      return;
    }
    if (request.url?.endsWith("/events")) {
      const duplicate = acceptedKeys.has(body.idempotencyKey);
      acceptedKeys.add(body.idempotencyKey);
      if (!duplicate) receivedEvents.push(body);
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify({ accepted: true, duplicate }));
      return;
    }
    response.writeHead(404).end();
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    receivedEvents,
  };
}

describe("quickstart smoke", () => {
  it("envia heartbeat, repete o evento sem duplicá-lo e confirma token inválido", async () => {
    const fake = await fakeMuster();
    const result = await runQuickstartSmoke({
      baseUrl: fake.baseUrl,
      agentId: "agent-1",
      token: "token-valido",
      idempotencyKey: "evento-1",
      now: () => new Date("2026-10-03T12:00:00.000Z"),
      log: () => undefined,
    });

    expect(result.idempotencyKey).toBe("evento-1");
    expect(fake.receivedEvents).toEqual([{
      idempotencyKey: "evento-1",
      kind: "execution",
      ts: "2026-10-03T12:00:00.000Z",
      durationMs: 1,
      success: true,
      metadata: { source: "quickstart-smoke" },
    }]);
  });

  it("falha antes de fazer chamadas se faltar configuração", () => {
    expect(() => readSmokeEnvironment({ MUSTER_URL: "http://muster", MUSTER_AGENT_ID: "a" }))
      .toThrow("MUSTER_AGENT_TOKEN");
  });
});
