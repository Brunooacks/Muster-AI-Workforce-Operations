/**
 * End-to-end MVP validation. Requires the API in local-dev mode and a running
 * database. It validates the contract that matters for adoption:
 * heartbeat -> supervision freshness -> execution telemetry -> reevaluation
 * -> evidence persistence -> idempotent reevaluation.
 */
export {};

const baseUrl = process.env.MUSTER_BASE_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api${path}`, init);
  const body = await response.text();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${response.status}: ${body}`);
  return body ? (JSON.parse(body) as T) : (undefined as T);
}

async function main(): Promise<void> {
  const agents = await request<Array<{ id: string; name: string }>>("/agents");
  const agent = agents[0];
  if (!agent) throw new Error("Nenhum agente encontrado. Rode o seed ou admita um agente.");

  await request(`/agents/${agent.id}/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runtime: "mvp-validator", version: "local", intervalSeconds: 30, status: "healthy" }),
  });
  const supervision = await request<{ status: string; isStale: boolean }>(`/agents/${agent.id}/supervision`);
  if (supervision.status !== "live" || supervision.isStale) throw new Error(`Supervisão inválida: ${JSON.stringify(supervision)}`);

  await request(`/agents/${agent.id}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "execution", durationMs: 800, costCents: 3, tokensIn: 100, tokensOut: 80, success: true, metadata: { validator: true } }),
  });
  const first = await request<{ dataSource: string; rulesFired?: string[] }>(`/agents/${agent.id}/reevaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const second = await request<{ changed: boolean }>(`/agents/${agent.id}/reevaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const evidence = await request<Array<{ id: string }>>(`/evidence?agentId=${encodeURIComponent(agent.id)}`);
  if (first.dataSource !== "telemetry") throw new Error(`Reavaliação não usou telemetria: ${JSON.stringify(first)}`);
  if (second.changed) throw new Error("Reavaliação repetida não foi idempotente.");
  if (evidence.length === 0) throw new Error("Nenhuma evidência persistida.");

  console.log(JSON.stringify({ ok: true, agent: agent.name, supervision, evidenceCount: evidence.length, first, second }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
