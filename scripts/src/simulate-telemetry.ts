/**
 * Simulador de execuções — gera telemetria realista para agentes da frota via
 * o conector oficial (@workspace/telemetry-reporter), exatamente como um
 * agente em execução reportaria. Serve para demonstrar o ciclo completo:
 * agente executa → reporta evento → Muster armazena → reavaliação → decisão.
 *
 * Perfis (um por agente, em ordem de frota):
 *   healthy   — alto volume, ~96% sucesso, latência estável   → tende a PROMOTE
 *   degrading — sucesso decai 95%→60% ao longo da janela      → tende a MENTOR
 *   erratic   — ~55% sucesso, caro, muitos erros/escalações   → tende a RETIRE
 *
 * Uso (API rodando com AUTH_DEV_BYPASS=true):
 *   pnpm --filter @workspace/scripts run simulate-telemetry
 *   pnpm --filter @workspace/scripts run simulate-telemetry -- --days=30 --base-url=http://localhost:8080
 */
import {
  createMusterReporter,
  type AgentEvent,
} from "@workspace/telemetry-reporter";

interface AgentSummary {
  id: string;
  name: string;
  slug: string;
}

type ProfileKey = "healthy" | "degrading" | "erratic";

interface Profile {
  key: ProfileKey;
  executionsPerDay: [number, number];
  /** success prob at start and end of the window (linear interp). */
  successStart: number;
  successEnd: number;
  latencyMs: [number, number];
  costCents: [number, number];
  tokensIn: [number, number];
  tokensOut: [number, number];
  errorsPerDay: [number, number];
  escalationsPerDay: [number, number];
}

const PROFILES: Profile[] = [
  {
    key: "healthy",
    executionsPerDay: [10, 16],
    successStart: 0.95,
    successEnd: 0.97,
    latencyMs: [700, 1600],
    costCents: [2, 5],
    tokensIn: [800, 2000],
    tokensOut: [200, 900],
    errorsPerDay: [0, 1],
    escalationsPerDay: [0, 1],
  },
  {
    key: "degrading",
    executionsPerDay: [8, 14],
    successStart: 0.95,
    successEnd: 0.6,
    latencyMs: [900, 3500],
    costCents: [3, 8],
    tokensIn: [1000, 2600],
    tokensOut: [300, 1200],
    errorsPerDay: [0, 3],
    escalationsPerDay: [1, 4],
  },
  {
    key: "erratic",
    executionsPerDay: [4, 20],
    successStart: 0.6,
    successEnd: 0.5,
    latencyMs: [1500, 9000],
    costCents: [8, 25],
    tokensIn: [2000, 6000],
    tokensOut: [500, 3000],
    errorsPerDay: [2, 6],
    escalationsPerDay: [1, 5],
  },
];

// Mulberry32 — RNG determinístico para simulações reproduzíveis.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRange(rng: () => number) {
  return (lo: number, hi: number) => lo + rng() * (hi - lo);
}

function buildEvents(profile: Profile, days: number, seed: number): AgentEvent[] {
  const rng = mulberry32(seed);
  const range = makeRange(rng);
  const events: AgentEvent[] = [];
  const now = Date.now();
  const dayMs = 86_400_000;

  for (let day = days - 1; day >= 0; day -= 1) {
    // progress: 0 no dia mais antigo → 1 hoje (dirige a degradação).
    const progress = days <= 1 ? 1 : (days - 1 - day) / (days - 1);
    const dayStart = now - day * dayMs - range(0, 4) * 3_600_000;
    const successProb =
      profile.successStart + (profile.successEnd - profile.successStart) * progress;

    const executions = Math.round(range(...profile.executionsPerDay));
    for (let i = 0; i < executions; i += 1) {
      const latencyStretch = 1 + progress * (profile.key === "degrading" ? 1.5 : 0);
      events.push({
        kind: "execution",
        ts: new Date(dayStart - range(0, 18) * 3_600_000),
        success: rng() < successProb,
        durationMs: Math.round(range(...profile.latencyMs) * latencyStretch),
        costCents: Math.round(range(...profile.costCents)),
        tokensIn: Math.round(range(...profile.tokensIn)),
        tokensOut: Math.round(range(...profile.tokensOut)),
        metadata: { simulated: true, profile: profile.key },
      });
    }

    const errors = Math.round(range(...profile.errorsPerDay) * (0.5 + progress));
    for (let i = 0; i < errors; i += 1) {
      events.push({
        kind: "error",
        ts: new Date(dayStart - range(0, 18) * 3_600_000),
        durationMs: Math.round(range(500, 4000)),
        costCents: Math.round(range(1, 4)),
        metadata: { simulated: true, profile: profile.key, message: "timeout upstream" },
      });
    }

    const escalations = Math.round(range(...profile.escalationsPerDay) * (0.5 + progress));
    for (let i = 0; i < escalations; i += 1) {
      events.push({
        kind: "escalation",
        ts: new Date(dayStart - range(0, 18) * 3_600_000),
        metadata: { simulated: true, profile: profile.key, reason: "fora da alçada" },
      });
    }
  }
  return events;
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function api<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const baseUrl = arg(
    "base-url",
    process.env.MUSTER_BASE_URL ?? "http://localhost:8080",
  ).replace(/\/+$/, "");
  const days = Number(arg("days", "30"));
  const count = Number(arg("agents", "3"));

  const agents = await api<AgentSummary[]>(baseUrl, "/agents");
  if (agents.length === 0) {
    throw new Error("Frota vazia — suba a API primeiro (o seed cria os agentes demo).");
  }
  const targets = agents.slice(0, Math.min(count, PROFILES.length));

  console.log(`Simulando ${days} dias de execuções contra ${baseUrl}\n`);

  for (const [index, agent] of targets.entries()) {
    const profile = PROFILES[index]!;
    const reporter = createMusterReporter({
      baseUrl,
      agentId: agent.id,
      onError: (err) => console.error(`  ! falha de entrega: ${String(err)}`),
    });

    const events = buildEvents(profile, days, 1000 + index);
    const delivered = await reporter.reportMany(events);
    console.log(
      `• ${agent.name} [${profile.key}] — ${delivered}/${events.length} eventos entregues`,
    );

    const outcome = await api<{
      verdict: string;
      healthScore: number;
      dataSource: string;
      rationale: string;
    }>(baseUrl, `/agents/${agent.id}/reevaluate`, { method: "POST", body: "{}" });
    console.log(
      `  ↳ reavaliação: verdict=${outcome.verdict} health=${outcome.healthScore} fonte=${outcome.dataSource}`,
    );
    console.log(`  ↳ ${outcome.rationale}\n`);
  }

  console.log("Pronto — abra a frota no Muster e veja os agentes com dados reais.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
