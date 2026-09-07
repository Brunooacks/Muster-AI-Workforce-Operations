import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMusterReporter } from "@workspace/telemetry-reporter";
import {
  CENYRA_PROFESSIONS,
  isCenyraRunHealthy,
  latestCenyraRuns,
  synthesisRun,
  type CenyraProfession,
  type CenyraReport,
  type CenyraRun,
} from "./cenyra-bridge-model";
import { requireMusterSessionToken } from "./muster-session";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "../..");

interface AgentSummary {
  id: string;
  name: string;
}

interface AgentApiKey {
  plaintext: string;
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
  errorRate: number | null;
  avgDurationMs: number | null;
}

interface BridgeResult {
  source: string;
  agentName: string;
  agentId: string;
  executionEvents: number;
  errorEvents: number;
  reevaluation: Reevaluation;
  telemetry: TelemetrySummary;
}

function argument(name: string): string | undefined {
  const prefixed = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (prefixed) return prefixed.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? "true" : undefined;
}

const offline = argument("offline") === "true";
const musterBaseUrl = (argument("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");
const cenyraBaseUrl = (argument("cenyra-url") ?? process.env.CENYRA_BASE_URL ?? "http://localhost:8095").replace(/\/+$/, "");
const sessionToken = offline ? null : requireMusterSessionToken();
const bridgeRunId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = resolve(
  WORKSPACE,
  argument("output") ?? `output/gauntlet/cenyra/${bridgeRunId}`,
);

async function json<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const rawBody = await response.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    throw new Error(`${init.method ?? "GET"} ${url} retornou conteúdo inválido: ${rawBody.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} respondeu ${response.status}: ${rawBody.slice(0, 500)}`);
  }
  return body as T;
}

async function musterApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return json<T>(`${musterBaseUrl}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${sessionToken}`,
      ...init.headers,
    },
  });
}

function admissionPayload(profession: CenyraProfession, latest: CenyraRun) {
  const healthy = isCenyraRunHealthy(latest);
  return {
    externalId: `local:cenyra:${profession.source}`,
    name: `[local-lab] ${profession.name}`,
    role: profession.role,
    platform: profession.platform,
    version: "cenyra-bridge-1",
    bio: profession.purpose,
    tagline: `${profession.role} · ${latest.framework}`,
    shouldDo: profession.shouldDo,
    shouldNotDo: ["Inventar evidência ausente", "Ocultar degradação de fonte ou LLM", "Executar transações nas fontes"],
    autonomyLevel: "escalates",
    autonomyNotes: "Coleta pública autônoma; mudanças de fonte, credenciais e decisões de produto exigem revisão humana.",
    limits: ["Somente páginas públicas", "Sem login nas fontes", "Sem compra, lance ou ação transacional"],
    businessOwner: "Product Discovery",
    technicalOwner: "AI Platform",
    governanceSponsor: "Muster Lab Review",
    baseline: `${latest.metrics.records_discovered} registros e ${latest.metrics.links_discovered} links na última execução.`,
    targetPayback: "Gerar uma tese validável por ciclo de descoberta.",
    businessCaseDescription: profession.purpose,
    proposedMetrics: [
      { layer: "efficacy", label: "Execução íntegra", unit: "%", target: "100%", value: healthy ? 100 : 0 },
      { layer: "efficiency", label: "Duração da coleta", unit: "ms", target: "≤ 900000 ms", value: latest.metrics.duration_ms },
      { layer: "adoption", label: "Registros descobertos", unit: "itens", target: "≥ 1", value: latest.metrics.records_discovered },
      { layer: "governance", label: "Cobertura de enriquecimento", unit: "%", target: "≥ 90%", value: latest.metrics.enrichment_coverage * 100 },
      { layer: "value", label: "Qualidade da análise", unit: "%", target: "≥ 75%", value: latest.metrics.analysis_quality * 100 },
    ],
  };
}

async function admitAndDeliver(
  profession: CenyraProfession,
  runs: CenyraRun[],
  existingAgents: AgentSummary[],
): Promise<BridgeResult> {
  const latest = latestCenyraRuns(runs).get(profession.source);
  if (!latest) throw new Error(`Nenhuma execução disponível para ${profession.source}.`);
  const name = `[local-lab] ${profession.name}`;
  const existing = existingAgents.find((agent) => agent.name === name);
  const agentId = existing?.id ?? (await musterApi<{ agent: { id: string } }>("/agents", {
    method: "POST",
    body: JSON.stringify(admissionPayload(profession, latest)),
  })).agent.id;
  const credential = await musterApi<AgentApiKey>(`/agents/${encodeURIComponent(agentId)}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ label: `cenyra-${bridgeRunId}` }),
  });
  const reporter = createMusterReporter({
    baseUrl: musterBaseUrl,
    agentId,
    token: credential.plaintext,
    timeoutMs: 15_000,
  });
  const healthy = isCenyraRunHealthy(latest);
  const heartbeatDelivered = await reporter.heartbeat({
    runtime: "docker-local",
    version: "cenyra-bridge-1",
    intervalSeconds: 86_400,
    status: healthy ? "healthy" : "degraded",
    metadata: {
      bridgeRunId,
      source: profession.source,
      framework: latest.framework,
      degradedReason: latest.metrics.degraded_reason,
    },
  });
  if (!heartbeatDelivered) throw new Error(`Heartbeat não entregue para ${profession.name}.`);

  let executionEvents = 0;
  let errorEvents = 0;
  for (const run of [...runs].sort((left, right) => left.started_at.localeCompare(right.started_at))) {
    const success = isCenyraRunHealthy(run);
    const delivered = await reporter.report({
      kind: "execution",
      ts: run.started_at,
      success,
      durationMs: run.metrics.duration_ms,
      tokensIn: run.metrics.input_tokens,
      tokensOut: run.metrics.output_tokens,
      metadata: {
        bridgeRunId,
        runId: run.id,
        source: run.source,
        framework: run.framework,
        recordsDiscovered: run.metrics.records_discovered,
        linksDiscovered: run.metrics.links_discovered,
        estimatedCostUsd: run.metrics.estimated_cost_usd,
        analysisQuality: run.metrics.analysis_quality,
        enrichmentCoverage: run.metrics.enrichment_coverage,
        translationCoverage: run.metrics.translation_coverage,
        businessDetailCoverage: run.metrics.business_detail_coverage,
        marketResearchCoverage: run.metrics.market_research_coverage,
        sourceHash: run.metrics.source_hash,
      },
    });
    if (!delivered) throw new Error(`Execução ${run.id} não entregue para ${profession.name}.`);
    executionEvents += 1;

    if (!success) {
      const errorDelivered = await reporter.report({
        kind: "error",
        ts: run.completed_at ?? run.started_at,
        durationMs: run.metrics.duration_ms,
        tokensIn: run.metrics.input_tokens,
        tokensOut: run.metrics.output_tokens,
        metadata: {
          bridgeRunId,
          runId: run.id,
          source: run.source,
          reason: run.error ?? run.metrics.degraded_reason ?? "Execução degradada sem motivo declarado.",
        },
      });
      if (!errorDelivered) throw new Error(`Erro ${run.id} não entregue para ${profession.name}.`);
      errorEvents += 1;
    }
  }

  const reevaluation = await musterApi<Reevaluation>(`/agents/${encodeURIComponent(agentId)}/reevaluate`, {
    method: "POST",
    body: "{}",
  });
  const telemetry = await musterApi<TelemetrySummary>(`/agents/${encodeURIComponent(agentId)}/telemetry/30d`);
  return { source: profession.source, agentName: name, agentId, executionEvents, errorEvents, reevaluation, telemetry };
}

function markdown(runs: CenyraRun[], results: BridgeResult[]): string {
  const latest = latestCenyraRuns(runs);
  const rows = Object.values(CENYRA_PROFESSIONS).map((profession) => {
    const current = latest.get(profession.source);
    const result = results.find((candidate) => candidate.source === profession.source);
    return `| ${profession.name} | ${profession.platform} | ${current?.status ?? "sem execução"} | ${current?.metrics.records_discovered ?? 0} | ${current?.metrics.links_discovered ?? 0} | ${current ? Math.round(current.metrics.analysis_quality * 100) : 0}% | ${current?.metrics.degraded_reason ?? current?.error ?? "—"} | ${result?.agentId ?? "admissão pendente"} |`;
  }).join("\n");
  return `# Cenyra → Muster\n\n- Bridge run: ${bridgeRunId}\n- Modo: ${offline ? "offline" : "integrado"}\n- Histórico lido: ${runs.length} execuções\n\n| Profissional | Runtime | Estado | Registros | Links | Qualidade | Degradação | Agent ID |\n|---|---|---|---:|---:|---:|---|---|\n${rows}\n`;
}

async function main(): Promise<void> {
  mkdirSync(outputDirectory, { recursive: true });
  const [sourceRuns, report] = await Promise.all([
    json<CenyraRun[]>(`${cenyraBaseUrl}/api/runs?limit=200`),
    json<CenyraReport>(`${cenyraBaseUrl}/api/report`),
  ]);
  if (!report.report_date) throw new Error("O Cenyra ainda não possui relatório consolidado.");
  const allRuns = [...sourceRuns, synthesisRun(report)];
  const results: BridgeResult[] = [];
  if (!offline) {
    const existingAgents = await musterApi<AgentSummary[]>("/agents");
    for (const profession of Object.values(CENYRA_PROFESSIONS)) {
      const runs = allRuns.filter((run) => run.source === profession.source);
      results.push(await admitAndDeliver(profession, runs, existingAgents));
    }
  }
  const payload = { bridgeRunId, offline, cenyraBaseUrl, musterBaseUrl, runs: allRuns, results };
  writeFileSync(resolve(outputDirectory, "report.json"), JSON.stringify(payload, null, 2));
  writeFileSync(resolve(outputDirectory, "report.md"), markdown(allRuns, results));
  console.log(`Cenyra: ${sourceRuns.length} execuções históricas e ${report.opportunity_count} oportunidades.`);
  console.log(offline ? "Admissão Muster pendente de MUSTER_AUTH_TOKEN." : `${results.length} profissionais admitidos e reavaliados.`);
  console.log(`Relatório: ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
