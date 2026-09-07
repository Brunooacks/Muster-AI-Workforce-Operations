import { readFile } from "node:fs/promises";
import { buildOnboardingBattery } from "./onboarding-battery-model";

function argument(name: string): string | undefined {
  const value = process.argv.find((item) => item.startsWith(`--${name}=`));
  return value?.slice(name.length + 3);
}

const agentId = argument("agent-id")?.trim();
const tokenFile = argument("token-file")?.trim();
const baseUrl = (argument("base-url") ?? "http://localhost:8081").replace(
  /\/+$/,
  "",
);

if (!agentId || !tokenFile) {
  throw new Error(
    "Use --agent-id=<id> --token-file=<arquivo> [--base-url=http://localhost:8081]",
  );
}

const token = (await readFile(tokenFile, "utf8")).trim();
if (!token) throw new Error("A credencial temporária está vazia.");

async function post(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${path} respondeu ${response.status}: ${message.slice(0, 300)}`);
  }
}

const battery = buildOnboardingBattery();
await post(`/agents/${agentId}/heartbeat`, {
  runtime: "local-docker",
  version: "1.1.0",
  intervalSeconds: 30,
  status: "healthy",
  metadata: {
    battery: "onboarding-operational",
    runId: battery.runId,
  },
});

let nextIndex = 0;
let delivered = 0;
const workers = Array.from({ length: 8 }, async () => {
  while (nextIndex < battery.events.length) {
    const index = nextIndex;
    nextIndex += 1;
    await post(`/agents/${agentId}/events`, battery.events[index]!);
    delivered += 1;
  }
});
await Promise.all(workers);

console.log(
  JSON.stringify(
    {
      runId: battery.runId,
      agentId,
      heartbeat: 1,
      baselineExecutions: battery.baselineExecutions,
      candidateExecutions: battery.candidateExecutions,
      eventsDelivered: delivered,
      errors: battery.events.filter((event) => event.kind === "error").length,
      escalations: battery.events.filter((event) => event.kind === "escalation")
        .length,
      humanCorrections: battery.events.filter(
        (event) => event.kind === "feedback",
      ).length,
    },
    null,
    2,
  ),
);
