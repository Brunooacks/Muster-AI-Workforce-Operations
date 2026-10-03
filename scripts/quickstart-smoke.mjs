#!/usr/bin/env node
import { randomUUID } from "node:crypto";

function apiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function jsonResponse(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label}: resposta não contém JSON.`);
  }
  return body;
}

async function postJson(fetchImpl, url, token, payload) {
  return fetchImpl(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function expectAccepted(response, label, expectedDuplicate) {
  const body = await jsonResponse(response, label);
  if (response.status !== 202 || body.accepted !== true) {
    throw new Error(`${label}: esperava 202 accepted; recebeu ${response.status}.`);
  }
  if (expectedDuplicate !== undefined && body.duplicate !== expectedDuplicate) {
    throw new Error(
      `${label}: esperava duplicate=${expectedDuplicate}; recebeu ${String(body.duplicate)}.`,
    );
  }
  return body;
}

export function readSmokeEnvironment(env = process.env) {
  const missing = ["MUSTER_URL", "MUSTER_AGENT_ID", "MUSTER_AGENT_TOKEN"]
    .filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}.`);
  }
  return {
    baseUrl: env.MUSTER_URL,
    agentId: env.MUSTER_AGENT_ID,
    token: env.MUSTER_AGENT_TOKEN,
  };
}

/**
 * Exercises the partner's least-privileged ingestion path. There is no GET
 * telemetry endpoint available to an agent credential, so the POST receipts
 * are the verification boundary for this smoke test.
 */
export async function runQuickstartSmoke({
  baseUrl,
  agentId,
  token,
  fetchImpl = fetch,
  idempotencyKey = randomUUID(),
  now = () => new Date(),
  log = console.log,
}) {
  const agentPath = `/api/agents/${encodeURIComponent(agentId)}`;
  const heartbeatUrl = apiUrl(baseUrl, `${agentPath}/heartbeat`);
  const eventUrl = apiUrl(baseUrl, `${agentPath}/events`);

  const heartbeat = await postJson(fetchImpl, heartbeatUrl, token, {
    runtime: "design-partner-smoke",
    status: "healthy",
    intervalSeconds: 60,
  });
  await expectAccepted(heartbeat, "heartbeat");

  const event = {
    idempotencyKey,
    kind: "execution",
    ts: now().toISOString(),
    durationMs: 1,
    success: true,
    metadata: { source: "quickstart-smoke" },
  };
  await expectAccepted(
    await postJson(fetchImpl, eventUrl, token, event),
    "primeiro evento",
    false,
  );
  await expectAccepted(
    await postJson(fetchImpl, eventUrl, token, event),
    "reenvio idempotente",
    true,
  );

  const invalidToken = await postJson(fetchImpl, heartbeatUrl, "token-invalido", {
    status: "healthy",
  });
  if (invalidToken.status !== 401) {
    throw new Error(`token inválido: esperava 401; recebeu ${invalidToken.status}.`);
  }

  log("Smoke concluído: heartbeat aceito, evento idempotente e 401 inválido confirmados.");
  return { idempotencyKey };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  runQuickstartSmoke(readSmokeEnvironment()).catch((error) => {
    console.error(`Smoke falhou: ${error.message}`);
    process.exitCode = 1;
  });
}
