import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMusterReporter } from "@workspace/telemetry-reporter";
import {
  profileConfig,
  runOperationalWorkloads,
  type GauntletProfile,
  type WorkloadDomain,
  type WorkloadSummary,
} from "./gauntlet-workloads";
import {
  gauntletAgentName,
  gauntletRuntimeStatus,
} from "./gauntlet-identities";
import {
  buildGauntletAdmission,
  validateAdmittedAgent,
  validateGauntletAdmission,
} from "./gauntlet-admission";
import { requireMusterSessionToken } from "./muster-session";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "../..");

interface AgentSummary {
  id: string;
  name: string;
}

interface AgentApiKey {
  key: { id: string };
  plaintext: string;
}

interface AgentDetail {
  agent: { id: string; areaId?: string | null; name: string; role: string };
  identity: {
    shouldDo: string[];
    shouldNotDo: string[];
    limits: string[];
    autonomyLevel: string;
  };
  owners: {
    businessOwner: string;
    technicalOwner: string;
    governanceSponsor: string;
  };
  latestEvaluation: {
    layers: Array<{ key: string; metrics: unknown[] }>;
  };
}

interface AreaSummary {
  id: string;
  name: string;
}

interface Reevaluation {
  healthScore: number;
  verdict: string;
  dataSource: string;
  changed: boolean;
}

interface TelemetrySummary {
  totalExecutions: number;
  successRate: number | null;
  avgDurationMs: number | null;
  totalCostCents: number;
  errorRate: number | null;
  escalationRate: number | null;
}

interface SupervisionSummary {
  status: string;
  isStale: boolean;
  runtime?: string | null;
}

interface OnlineResult {
  scenarioId: string;
  agentId: string;
  deliveredEvents: number;
  executionEvents: number;
  errorEvents: number;
  reevaluation: Reevaluation;
  telemetry: TelemetrySummary;
  supervision: SupervisionSummary;
  admission: {
    areaId: string;
    ownerCount: number;
    metricCount: number;
    valid: boolean;
  };
  deliveryDurationMs: number;
  deliveryThroughputPerSecond: number;
}

function argument(name: string): string | undefined {
  const prefixed = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (prefixed) return prefixed.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? "true" : undefined;
}

function parseProfile(value: string | undefined): GauntletProfile {
  if (value === undefined) return "baseline";
  if (value === "baseline" || value === "stress" || value === "chaos") return value;
  throw new Error(`Perfil inválido: ${value}. Use baseline, stress ou chaos.`);
}

const ALL_DOMAINS: WorkloadDomain[] = [
  "development",
  "customer-support",
  "finance",
  "business",
  "context",
  "governance",
  "journey",
  "reliability",
];

function parseDomains(value: string | undefined): WorkloadDomain[] | undefined {
  if (!value || value === "all") return undefined;
  const domains = value.split(",").map((item) => item.trim()).filter(Boolean);
  const invalid = domains.filter((domain) => !ALL_DOMAINS.includes(domain as WorkloadDomain));
  if (invalid.length > 0) throw new Error(`Domínios inválidos: ${invalid.join(", ")}.`);
  return domains as WorkloadDomain[];
}

const profile = parseProfile(argument("profile"));
const domains = parseDomains(argument("domains"));
const offline = argument("offline") === "true";
const cleanup = argument("cleanup") === "true";
const baseUrl = (argument("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const sessionToken = offline ? null : requireMusterSessionToken(process.env, argument("token-file"));
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = resolve(WORKSPACE, argument("output") ?? `output/gauntlet/operational/${runId}-${profile}`);

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${sessionToken}`,
      ...init.headers,
    },
  });
  const rawBody = await response.text();
  const body = rawBody ? JSON.parse(rawBody) as unknown : undefined;
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} respondeu ${response.status}: ${rawBody.slice(0, 500)}`);
  }
  return body as T;
}

async function ensureGauntletArea(): Promise<AreaSummary> {
  const list = await api<{ areas: AreaSummary[] }>("/areas");
  const existing = list.areas.find((area) => area.name === "Laboratório de Stress");
  if (existing) return existing;
  try {
    return await api<AreaSummary>("/areas", {
      method: "POST",
      body: JSON.stringify({
        name: "Laboratório de Stress",
        description: "Agentes admitidos para carga, caos, regressão e validação de governança.",
        leader: "Gauntlet Product Owner",
        costCenter: "LAB-AI-OPS",
      }),
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("409")) throw error;
    const refreshed = await api<{ areas: AreaSummary[] }>("/areas");
    const concurrent = refreshed.areas.find((area) => area.name === "Laboratório de Stress");
    if (!concurrent) throw error;
    return concurrent;
  }
}

async function deliverToMuster(summaries: WorkloadSummary[]): Promise<OnlineResult[]> {
  const existingAgents = await api<AgentSummary[]>("/agents");
  const area = await ensureGauntletArea();
  const onlineResults: OnlineResult[] = [];

  for (const summary of summaries) {
    const name = gauntletAgentName(summary.agentName, profile);
    const existing = existingAgents.find((agent) => agent.name === name);
    const payload = buildGauntletAdmission(summary, profile, area.id);
    const payloadIssues = validateGauntletAdmission(payload);
    if (payloadIssues.length > 0) {
      throw new Error(`${name}: admissão inválida — ${payloadIssues.join("; ")}.`);
    }
    const detail = existing
      ? await api<AgentDetail>(`/agents/${encodeURIComponent(existing.id)}`)
      : await api<AgentDetail>("/agents", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    const agentId = detail.agent.id;
    const persistedIssues = validateAdmittedAgent(detail, area.id);
    if (persistedIssues.length > 0) {
      throw new Error(`${name}: admissão não persistida — ${persistedIssues.join("; ")}.`);
    }
    const metricCount = detail.latestEvaluation.layers.reduce(
      (total, layer) => total + layer.metrics.length,
      0,
    );
    const credential = await api<AgentApiKey>(`/agents/${encodeURIComponent(agentId)}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ label: `gauntlet-${profile}-${runId}` }),
    });
    try {
      const reporter = createMusterReporter({ baseUrl, agentId, token: credential.plaintext, timeoutMs: 10_000 });
      const heartbeatDelivered = await reporter.heartbeat({
        runtime: "local",
        version: "operational-gauntlet-3",
        intervalSeconds: 30,
        status: gauntletRuntimeStatus(profile),
        metadata: { runId, profile, scenarioId: summary.scenarioId, areaId: area.id },
      });
      if (!heartbeatDelivered) throw new Error(`Heartbeat não entregue para ${summary.agentName}.`);

      const concurrency = profileConfig(profile).concurrency;
      let nextIndex = 0;
      let deliveredEvents = 0;
      let executionEvents = 0;
      let errorEvents = 0;
      const deliveryStartedAt = process.hrtime.bigint();
      const workers = Array.from({ length: Math.min(concurrency, summary.results.length) }, async () => {
        while (nextIndex < summary.results.length) {
          const resultIndex = nextIndex;
          nextIndex += 1;
          const result = summary.results[resultIndex]!;
          const delivered = await reporter.report({
            kind: "execution",
            success: result.success,
            durationMs: Math.max(0, Math.round(result.durationMs)),
            costCents: result.costCents,
            metadata: {
              runId,
              profile,
              scenarioId: result.scenarioId,
              domain: result.domain,
              itemId: result.itemId,
              expected: result.expected,
              observed: result.observed,
              evidence: result.metadata,
            },
          });
          if (delivered) {
            deliveredEvents += 1;
            executionEvents += 1;
          }
          if (!result.success) {
            const errorDelivered = await reporter.report({
              kind: "error",
              durationMs: Math.max(0, Math.round(result.durationMs)),
              costCents: result.costCents,
              metadata: {
                runId,
                profile,
                scenarioId: result.scenarioId,
                itemId: result.itemId,
                observed: result.observed,
                evidence: result.metadata,
              },
            });
            if (errorDelivered) {
              deliveredEvents += 1;
              errorEvents += 1;
            }
          }
        }
      });
      await Promise.all(workers);
      const deliveryDurationMs = Math.max(
        1,
        Number(process.hrtime.bigint() - deliveryStartedAt) / 1_000_000,
      );
      const expectedEvents = summary.results.length + (summary.total - summary.successful);
      if (deliveredEvents !== expectedEvents) {
        throw new Error(`${summary.agentName}: ${deliveredEvents}/${expectedEvents} eventos entregues.`);
      }

      const reevaluation = await api<Reevaluation>(`/agents/${encodeURIComponent(agentId)}/reevaluate`, {
        method: "POST",
        body: "{}",
      });
      const telemetry = await api<TelemetrySummary>(`/agents/${encodeURIComponent(agentId)}/telemetry/30d`);
      const supervision = await api<SupervisionSummary>(`/agents/${encodeURIComponent(agentId)}/supervision`);
      onlineResults.push({
        scenarioId: summary.scenarioId,
        agentId,
        deliveredEvents,
        executionEvents,
        errorEvents,
        reevaluation,
        telemetry,
        supervision,
        admission: {
          areaId: area.id,
          ownerCount: 3,
          metricCount,
          valid: true,
        },
        deliveryDurationMs: Math.round(deliveryDurationMs),
        deliveryThroughputPerSecond: Number(
          ((deliveredEvents / deliveryDurationMs) * 1_000).toFixed(2),
        ),
      });
    } finally {
      await api(`/agents/${encodeURIComponent(agentId)}/api-keys/${encodeURIComponent(credential.key.id)}/revoke`, {
        method: "POST",
        body: "{}",
      });
    }
  }

  return onlineResults;
}

async function cleanupAgents(): Promise<number> {
  const agents = await api<AgentSummary[]>("/agents");
  const targets = agents.filter((agent) => agent.name.startsWith("[gauntlet-real]"));
  for (const target of targets) {
    await api(`/agents/${encodeURIComponent(target.id)}`, { method: "DELETE" });
  }
  return targets.length;
}

function markdownReport(summaries: WorkloadSummary[], onlineResults: OnlineResult[]): string {
  const table = summaries.map((summary) =>
    `| ${summary.agentName} | ${summary.domain} | ${summary.total} | ${summary.qualityRate}% | ${summary.p95DurationMs} ms | ${summary.throughputPerSecond}/s |`,
  ).join("\n");
  const online = onlineResults.length === 0
    ? "Execução offline: admissão, ingestão e veredito aguardam `MUSTER_AUTH_TOKEN`."
    : onlineResults.map((result) =>
        `- ${result.scenarioId}: admissão válida com ${result.admission.metricCount} métricas, ${result.executionEvents} execuções + ${result.errorEvents} erros, ingestão ${result.deliveryThroughputPerSecond}/s, saúde ${result.reevaluation.healthScore}, veredito ${result.reevaluation.verdict}, supervisão ${result.supervision.status}.`,
      ).join("\n");
  return `# Gauntlet operacional — ${profile}\n\n` +
    `- Run ID: ${runId}\n- Perfil: ${profile}\n- Modo: ${offline ? "offline" : "integrado ao Muster"}\n\n` +
    `| Agente | Domínio | Execuções | Qualidade | P95 operacional | Vazão local |\n|---|---|---:|---:|---:|---:|\n${table}\n\n` +
    `## Integração Muster\n\n${online}\n`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlReport(summaries: WorkloadSummary[], onlineResults: OnlineResult[]): string {
  const totalExecutions = summaries.reduce((total, summary) => total + summary.total, 0);
  const totalSuccessful = summaries.reduce((total, summary) => total + summary.successful, 0);
  const overallQuality = Number(((totalSuccessful / Math.max(1, totalExecutions)) * 100).toFixed(2));
  const cards = summaries.map((summary) => `
    <article class="scenario">
      <div><span>${escapeHtml(summary.domain)}</span><h2>${escapeHtml(summary.agentName)}</h2></div>
      <div class="quality"><strong>${summary.qualityRate}%</strong><small>aderência ao gabarito</small></div>
      <div class="bar"><i style="width:${Math.max(0, Math.min(100, summary.qualityRate))}%"></i></div>
      <dl>
        <div><dt>Execuções</dt><dd>${summary.total}</dd></div>
        <div><dt>P95 operacional</dt><dd>${summary.p95DurationMs} ms</dd></div>
        <div><dt>Vazão local</dt><dd>${summary.throughputPerSecond}/s</dd></div>
        <div><dt>Falhas</dt><dd>${summary.total - summary.successful}</dd></div>
      </dl>
    </article>`).join("");
  const online = onlineResults.length === 0
    ? "Admissão online pendente do token Clerk. Os workloads e gabaritos foram executados localmente."
    : onlineResults.map((result) =>
        `${escapeHtml(result.scenarioId)}: ${result.deliveredEvents} eventos a ${result.deliveryThroughputPerSecond}/s, saúde ${result.reevaluation.healthScore}, ${escapeHtml(result.reevaluation.verdict)}.`,
      ).join("<br>");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gauntlet operacional — ${profile}</title><style>
    :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#e8edf7;background:#070b14}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 85% 0,#16264d 0,transparent 36%),#070b14}main{max-width:1240px;margin:auto;padding:56px 28px 80px}.eyebrow{color:#78a7ff;text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:800}h1{font-size:clamp(42px,7vw,82px);line-height:.95;letter-spacing:-.055em;margin:18px 0 16px;max-width:900px}.lead{color:#99a6bc;font-size:20px;max-width:760px;line-height:1.5}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:36px 0}.stat,.scenario,.status{border:1px solid #263452;background:rgba(13,20,35,.86);border-radius:22px}.stat{padding:24px}.stat strong{display:block;font-size:36px}.stat span,small,dt{color:#8f9cb2}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.scenario{padding:24px}.scenario>div:first-child{display:flex;justify-content:space-between;gap:18px}.scenario span{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#78a7ff}.scenario h2{font-size:22px;margin:7px 0 22px}.quality{display:flex;align-items:end;justify-content:space-between}.quality strong{font-size:34px}.bar{height:10px;background:#1d2940;border-radius:999px;overflow:hidden;margin:14px 0 22px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#37d6bb,#78a7ff);border-radius:inherit}dl{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0}dt{font-size:11px;text-transform:uppercase}dd{margin:5px 0 0;font-weight:750}.status{padding:22px;margin-top:18px;color:#b8c3d5}.status strong{color:#e8edf7}@media(max-width:780px){.stats,.grid{grid-template-columns:1fr}dl{grid-template-columns:repeat(2,1fr)}}
  </style></head><body><main><div class="eyebrow">Muster · operational gauntlet</div><h1>${profile} com trabalho verificável.</h1><p class="lead">Oito especialidades exercitam desenvolvimento, atendimento, finanças, negócio, contexto, governança, jornadas A2A e resiliência híbrida com gabarito e falhas observáveis.</p><section class="stats"><div class="stat"><strong>${totalExecutions}</strong><span>execuções</span></div><div class="stat"><strong>${overallQuality}%</strong><span>qualidade consolidada</span></div><div class="stat"><strong>${profileConfig(profile).concurrency}</strong><span>concorrência máxima</span></div></section><section class="grid">${cards}</section><section class="status"><strong>Integração Muster:</strong> ${online}</section></main></body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(outputDirectory, { recursive: true });
  if (cleanup) {
    if (offline) throw new Error("--cleanup exige execução online com MUSTER_AUTH_TOKEN.");
    const removed = await cleanupAgents();
    console.log(`Agentes do Gauntlet removidos: ${removed}.`);
    return;
  }

  console.log(`Gauntlet operacional: perfil=${profile}, modo=${offline ? "offline" : "online"}`);
  const summaries = await runOperationalWorkloads({ profile, workspace: WORKSPACE, domains });
  const onlineResults = offline ? [] : await deliverToMuster(summaries);
  const report = { runId, profile, offline, config: profileConfig(profile), summaries, onlineResults };
  writeFileSync(resolve(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(resolve(outputDirectory, "report.md"), markdownReport(summaries, onlineResults));
  writeFileSync(resolve(outputDirectory, "report.html"), htmlReport(summaries, onlineResults));

  for (const summary of summaries) {
    console.log(`${summary.agentName}: ${summary.successful}/${summary.total} corretas, p95=${summary.p95DurationMs}ms, throughput=${summary.throughputPerSecond}/s`);
  }
  console.log(`Relatório: ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
