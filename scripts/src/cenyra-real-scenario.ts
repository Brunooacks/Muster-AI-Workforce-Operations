import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CENYRA_PROFESSIONS,
  cenyraEvidenceProfile,
  isCenyraCollectionObserved,
  synthesisRun,
  type CenyraProfession,
  type CenyraReport,
  type CenyraRun,
} from "./cenyra-bridge-model";
import { requireMusterSessionToken } from "./muster-session";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "../..");
const SOURCE_KEYS = ["melhorlance", "outbid", "yc-rfs"] as const;

interface OpportunityEvidence {
  source: string;
  external_key: string;
  title: string;
  url: string | null;
  collected_at: string;
  analysis_method: "heuristic" | "llm";
  evidence_strength: string;
  links: string[];
}

interface AgentSummary {
  id: string;
  name: string;
}

interface AgentDetail {
  agent: { id: string; areaId?: string | null; name: string; role: string };
  identity: { shouldDo: string[]; shouldNotDo: string[]; limits: string[]; autonomyLevel: string };
  owners: { businessOwner: string; technicalOwner: string; governanceSponsor: string };
  latestEvaluation: { layers: Array<{ key: string; metrics: unknown[] }> };
}

interface AreaSummary {
  id: string;
  name: string;
}

interface ConnectorSetup {
  id: string;
  setupApiKey: string;
  setupEndpoint: string;
}

interface AgentApiKey {
  key: { id: string };
  plaintext: string;
}

interface OnlineResult {
  source: string;
  agentId: string;
  eventAccepted: number;
  observationsAccepted: number;
  duplicate: boolean;
  healthScore: number;
  verdict: string;
  admissionValid: boolean;
}

function argument(name: string): string | undefined {
  const prefixed = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (prefixed) return prefixed.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? "true" : undefined;
}

const offline = argument("offline") === "true";
const reuse = argument("reuse") === "true";
const cenyraBaseUrl = (argument("cenyra-url") ?? "http://localhost:8095").replace(/\/+$/, "");
const musterBaseUrl = (argument("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8081").replace(/\/+$/, "");
const sessionToken = offline
  ? null
  : requireMusterSessionToken(process.env, argument("token-file"));
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = resolve(
  WORKSPACE,
  argument("output") ?? `output/real-agents/cenyra/${runId}`,
);
const timeoutMs = Math.max(10_000, Number(argument("timeout-ms") ?? "180000"));

async function json<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const rawBody = await response.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    throw new Error(`${init.method ?? "GET"} ${url} retornou conteúdo inválido.`);
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

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function loadRuns(): Promise<CenyraRun[]> {
  return json<CenyraRun[]>(`${cenyraBaseUrl}/api/runs?limit=200`);
}

async function collectFreshRuns(): Promise<CenyraRun[]> {
  const before = new Set((await loadRuns()).map((run) => run.id));
  await json(`${cenyraBaseUrl}/api/run`, { method: "POST" });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const candidates = (await loadRuns()).filter(
      (run) => !before.has(run.id) && SOURCE_KEYS.includes(run.source as typeof SOURCE_KEYS[number]),
    );
    const latest = new Map<string, CenyraRun>();
    for (const candidate of candidates) {
      const current = latest.get(candidate.source);
      if (!current || candidate.started_at > current.started_at) latest.set(candidate.source, candidate);
    }
    if (
      SOURCE_KEYS.every((source) => {
        const run = latest.get(source);
        return run && run.status !== "running";
      })
    ) {
      return SOURCE_KEYS.map((source) => latest.get(source)!);
    }
    await wait(1_000);
  }
  throw new Error(`Cenyra não concluiu as três fontes em ${timeoutMs}ms.`);
}

function percent(value: number): number {
  return Number((value * 100).toFixed(2));
}

function admissionPayload(profession: CenyraProfession, run: CenyraRun, areaId: string) {
  const evidence = cenyraEvidenceProfile(run);
  const collectionSuccess = isCenyraCollectionObserved(run) || run.source === "synthesis";
  const throughput = Number(
    ((run.metrics.records_discovered / Math.max(1, run.metrics.duration_ms)) * 1_000).toFixed(2),
  );
  return {
    externalId: `local:cenyra:evidence-v2:${profession.source}`,
    areaId,
    name: `[evidência-real] ${profession.name}`,
    role: profession.role,
    platform: evidence.actualRuntime,
    version: "cenyra-evidence-2",
    bio: profession.purpose,
    tagline: `${profession.role} · ${evidence.collectionKind}/${evidence.analysisKind}`,
    shouldDo: [
      ...profession.shouldDo,
      "Preservar URL, hash, horário e classificação da evidência",
      "Distinguir coleta observada, análise heurística e execução de LLM",
    ],
    shouldNotDo: [
      "Declarar framework de IA executado quando llm_used=false",
      "Inventar evidência ausente",
      "Ocultar degradação, falha de fonte ou baixa cobertura",
      "Executar transações nas fontes",
    ],
    autonomyLevel: "escalates" as const,
    autonomyNotes: "Pode coletar páginas públicas e consolidar evidências; decisões de produto e mudanças de fonte exigem revisão humana.",
    limits: ["Somente páginas públicas", "Sem login nas fontes", "Sem compra, lance ou contato externo", "Sem promover análise heurística como decisão final"],
    businessOwner: "Product Discovery",
    technicalOwner: "AI Platform",
    governanceSponsor: "Muster Evidence Review",
    baseline: `${run.metrics.records_discovered} registros, ${run.metrics.links_discovered} links e fonte ${evidence.collectionKind}.`,
    targetPayback: "Produzir ao menos uma tese rastreável por ciclo, sem falsificar a maturidade da análise.",
    businessCaseDescription: `${profession.purpose} Fonte: ${profession.sourceUrl}. Runtime observado: ${evidence.actualRuntime}.`,
    proposedMetrics: [
      { layer: "efficacy", label: "Coleta concluída", unit: "%", target: "100%", value: collectionSuccess ? 100 : 0 },
      { layer: "efficacy", label: "Qualidade da análise", unit: "%", target: "≥ 75%", value: percent(run.metrics.analysis_quality) },
      { layer: "efficiency", label: "Duração da execução", unit: "ms", target: "≤ 900000 ms", value: run.metrics.duration_ms },
      { layer: "efficiency", label: "Vazão de registros", unit: "itens/s", target: "≥ 1", value: throughput },
      { layer: "adoption", label: "Registros observados", unit: "itens", target: "≥ 1", value: run.metrics.records_discovered },
      { layer: "adoption", label: "Links preservados", unit: "links", target: "≥ 1", value: run.metrics.links_discovered },
      { layer: "governance", label: "Hash de origem preservado", unit: "%", target: "100%", value: run.metrics.source_hash ? 100 : 0 },
      { layer: "governance", label: "Proveniência observada", unit: "%", target: "100%", value: evidence.collectionKind === "observed" ? 100 : evidence.collectionKind === "derived" ? 50 : 0 },
      { layer: "governance", label: "Execução de IA comprovada", unit: "%", target: "100%", value: evidence.analysisKind === "llm" || evidence.analysisKind === "deterministic" ? 100 : 0 },
      { layer: "governance", label: "Cobertura de pesquisa externa", unit: "%", target: "≥ 80%", value: percent(run.metrics.market_research_coverage) },
      { layer: "value", label: "Cobertura de tradução", unit: "%", target: "≥ 90%", value: percent(run.metrics.translation_coverage) },
      { layer: "value", label: "Cobertura de dossiê", unit: "%", target: "≥ 90%", value: percent(run.metrics.business_detail_coverage) },
      { layer: "value", label: "Prontidão para decisão", unit: "%", target: "100%", value: evidence.decisionGrade ? 100 : 0 },
    ],
  };
}

function validateAdmission(detail: AgentDetail, expectedAreaId: string): string[] {
  const issues: string[] = [];
  if (detail.agent.areaId !== expectedAreaId) issues.push("área não persistida");
  if (detail.identity.shouldDo.length < 4 || detail.identity.shouldNotDo.length < 3) issues.push("contrato profissional incompleto");
  if (detail.identity.limits.length < 4 || detail.identity.autonomyLevel !== "escalates") issues.push("limites ou autonomia inválidos");
  if (!detail.owners.businessOwner || !detail.owners.technicalOwner || !detail.owners.governanceSponsor) issues.push("owners incompletos");
  const layers = new Set(detail.latestEvaluation.layers.map((layer) => layer.key));
  for (const layer of ["efficacy", "efficiency", "adoption", "governance", "value"]) {
    if (!layers.has(layer)) issues.push(`camada ${layer} ausente`);
  }
  const metricCount = detail.latestEvaluation.layers.reduce((total, layer) => total + layer.metrics.length, 0);
  if (metricCount < 12) issues.push("menos de 12 métricas persistidas");
  return issues;
}

async function ensureArea(): Promise<AreaSummary> {
  const { areas } = await musterApi<{ areas: AreaSummary[] }>("/areas");
  const existing = areas.find((area) => area.name === "Laboratório de Evidência Real");
  if (existing) return existing;
  return musterApi<AreaSummary>("/areas", {
    method: "POST",
    body: JSON.stringify({
      name: "Laboratório de Evidência Real",
      description: "Workloads com fonte externa, proveniência, execução observada e grau de decisão explícito.",
      leader: "Muster Evidence Review",
      costCenter: "LAB-REAL-AGENTS",
    }),
  });
}

async function configureConnector(): Promise<ConnectorSetup> {
  return musterApi<ConnectorSetup>("/connectors", {
    method: "POST",
    body: JSON.stringify({ platform: "webhook", name: "Cenyra Docker Runtime" }),
  });
}

function observations(run: CenyraRun) {
  const evidence = cenyraEvidenceProfile(run);
  const capturedAt = run.completed_at ?? run.started_at;
  const lineage = [
    { stage: "collect", name: run.source, ref: run.metrics.source_hash },
    { stage: "analyze", name: evidence.actualRuntime, ref: run.id },
  ];
  const metric = (metricKey: string, label: string, value: number, unit: string, kind: "observed" | "inferred" = "observed") => ({
    metricKey,
    label,
    value,
    unit,
    kind,
    confidence: kind === "observed" ? 1 : Math.max(0, Math.min(1, run.metrics.analysis_quality)),
    sampleSize: Math.max(1, run.metrics.records_discovered),
    capturedAt,
    lineage,
  });
  return [
    metric("records_discovered", "Registros observados", run.metrics.records_discovered, "itens"),
    metric("links_discovered", "Links preservados", run.metrics.links_discovered, "links"),
    metric("analysis_quality", "Qualidade da análise", percent(run.metrics.analysis_quality), "%", "inferred"),
    metric("enrichment_coverage", "Cobertura de enriquecimento", percent(run.metrics.enrichment_coverage), "%"),
    metric("translation_coverage", "Cobertura de tradução", percent(run.metrics.translation_coverage), "%"),
    metric("business_detail_coverage", "Cobertura de dossiê", percent(run.metrics.business_detail_coverage), "%"),
    metric("market_research_coverage", "Cobertura de pesquisa externa", percent(run.metrics.market_research_coverage), "%"),
    metric("llm_execution_coverage", "Execução de LLM comprovada", run.metrics.llm_used ? 100 : 0, "%"),
    metric("decision_readiness", "Prontidão para decisão", evidence.decisionGrade ? 100 : 0, "%", "inferred"),
  ];
}

async function admitAndIngest(
  profession: CenyraProfession,
  run: CenyraRun,
  area: AreaSummary,
  connector: ConnectorSetup,
  existingAgents: AgentSummary[],
): Promise<OnlineResult> {
  const payload = admissionPayload(profession, run, area.id);
  const existing = existingAgents.find((agent) => agent.name === payload.name);
  const detail = existing
    ? await musterApi<AgentDetail>(`/agents/${encodeURIComponent(existing.id)}`)
    : await musterApi<AgentDetail>("/agents", { method: "POST", body: JSON.stringify(payload) });
  const issues = validateAdmission(detail, area.id);
  if (issues.length > 0) throw new Error(`${payload.name}: ${issues.join("; ")}.`);

  const key = await musterApi<AgentApiKey>(`/agents/${encodeURIComponent(detail.agent.id)}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ label: `evidence-${runId}` }),
  });
  try {
    await json(`${musterBaseUrl}/api/agents/${encodeURIComponent(detail.agent.id)}/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key.plaintext}` },
      body: JSON.stringify({
        runtime: "docker-local",
        version: "cenyra-evidence-2",
        intervalSeconds: 86_400,
        status: isCenyraCollectionObserved(run) || run.source === "synthesis" ? "healthy" : "degraded",
        metadata: { runId: run.id, source: run.source, evidence: cenyraEvidenceProfile(run) },
      }),
    });

    const evidence = cenyraEvidenceProfile(run);
    const ingestion = await json<{
      eventsAccepted: number;
      observationsAccepted: number;
      duplicate?: boolean;
    }>(`${musterBaseUrl}/api/integrations/agent-events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${connector.setupApiKey}` },
      body: JSON.stringify({
        contractVersion: "muster.agent-ingestion.v1",
        eventId: `cenyra:${run.id}`,
        source: {
          platform: "webhook",
          connectorId: connector.id,
          tenant: "local-cenyra",
          environment: "docker-local",
          reference: profession.sourceUrl,
        },
        agent: {
          externalId: payload.externalId,
          name: payload.name,
          version: payload.version,
          runtime: evidence.actualRuntime,
          url: profession.sourceUrl,
          metadata: { declaredFramework: run.framework, evidence },
        },
        execution: {
          id: run.id,
          startedAt: run.started_at,
          completedAt: run.completed_at ?? undefined,
          status: isCenyraCollectionObserved(run) || run.source === "synthesis" ? "success" : "error",
          durationMs: run.metrics.duration_ms,
          tokensIn: run.metrics.input_tokens,
          tokensOut: run.metrics.output_tokens,
          metadata: {
            sourceHash: run.metrics.source_hash,
            degradedReason: run.metrics.degraded_reason,
            analysisKind: evidence.analysisKind,
            collectionKind: evidence.collectionKind,
          },
        },
        observations: observations(run),
        ...(run.metrics.degraded_reason
          ? { feedback: { kind: "escalation", comment: run.metrics.degraded_reason, metadata: { decisionGrade: false } } }
          : {}),
      }),
    });
    const reevaluation = await musterApi<{ healthScore: number; verdict: string }>(
      `/agents/${encodeURIComponent(detail.agent.id)}/reevaluate`,
      { method: "POST", body: "{}" },
    );
    return {
      source: run.source,
      agentId: detail.agent.id,
      eventAccepted: ingestion.eventsAccepted,
      observationsAccepted: ingestion.observationsAccepted,
      duplicate: Boolean(ingestion.duplicate),
      healthScore: reevaluation.healthScore,
      verdict: reevaluation.verdict,
      admissionValid: true,
    };
  } finally {
    await musterApi(`/agents/${encodeURIComponent(detail.agent.id)}/api-keys/${encodeURIComponent(key.key.id)}/revoke`, {
      method: "POST",
      body: "{}",
    });
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function markdown(runs: CenyraRun[], evidence: OpportunityEvidence[], online: OnlineResult[]): string {
  const rows = runs.map((run) => {
    const profile = cenyraEvidenceProfile(run);
    return `| ${run.agent_name} | ${profile.actualRuntime} | ${profile.collectionKind} | ${profile.analysisKind} | ${run.metrics.records_discovered} | ${run.metrics.links_discovered} | ${percent(run.metrics.analysis_quality)}% | ${profile.decisionGrade ? "sim" : "não"} |`;
  }).join("\n");
  const samples = evidence.slice(0, 12).map((item) => `- ${item.source}: [${item.title}](${item.url ?? "#"}) · ${item.analysis_method} · ${item.evidence_strength}`).join("\n");
  const integration = online.length === 0
    ? "Execução offline: a admissão aguarda uma sessão Clerk real."
    : online.map((item) => `- ${item.source}: agente ${item.agentId}, ${item.eventAccepted} evento, ${item.observationsAccepted} observações, saúde ${item.healthScore}, ${item.verdict}.`).join("\n");
  return `# Cenário real — Cenyra → Muster\n\n- Run: ${runId}\n- Coleta: ${reuse ? "histórico mais recente" : "nova execução disparada"}\n- Fontes com evidência: ${new Set(evidence.map((item) => item.source)).size}\n\n| Profissional | Runtime comprovado | Coleta | Análise | Registros | Links | Qualidade | Grau de decisão |\n|---|---|---|---|---:|---:|---:|---|\n${rows}\n\n## Amostra de evidência\n\n${samples || "Nenhuma oportunidade disponível."}\n\n## Integração Muster\n\n${integration}\n`;
}

function html(runs: CenyraRun[], evidence: OpportunityEvidence[], online: OnlineResult[]): string {
  const cards = runs.map((run) => {
    const profile = cenyraEvidenceProfile(run);
    return `<article><span>${escapeHtml(profile.collectionKind)} · ${escapeHtml(profile.analysisKind)}</span><h2>${escapeHtml(run.agent_name)}</h2><p>${escapeHtml(profile.actualRuntime)}</p><dl><div><dt>Registros</dt><dd>${run.metrics.records_discovered}</dd></div><div><dt>Links</dt><dd>${run.metrics.links_discovered}</dd></div><div><dt>Qualidade</dt><dd>${percent(run.metrics.analysis_quality)}%</dd></div><div><dt>Decisão</dt><dd>${profile.decisionGrade ? "pronta" : "não"}</dd></div></dl>${profile.reasons.length ? `<small>${escapeHtml(profile.reasons.join(" · "))}</small>` : ""}</article>`;
  }).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Muster · evidência real</title><style>:root{font-family:Inter,system-ui;color:#e9edf7;background:#080b14}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#24204f,transparent 38%),#080b14}main{max-width:1200px;margin:auto;padding:56px 28px}.eyebrow,article span{color:#8fa8ff;text-transform:uppercase;letter-spacing:.14em;font-size:11px}h1{font-size:clamp(44px,7vw,80px);line-height:.98;letter-spacing:-.055em;max-width:900px;margin:18px 0}.lead,p,small{color:#9ba5bb}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:36px}article{border:1px solid #303957;background:rgba(15,20,36,.88);border-radius:22px;padding:24px}h2{margin:9px 0;font-size:23px}dl{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}dt{color:#7f8ba3;font-size:10px;text-transform:uppercase}dd{margin:5px 0;font-weight:800}small{display:block;border-top:1px solid #29314a;padding-top:16px;line-height:1.45}@media(max-width:760px){.grid{grid-template-columns:1fr}dl{grid-template-columns:repeat(2,1fr)}}</style></head><body><main><div class="eyebrow">Muster · evidence-first workforce</div><h1>Real é aquilo que deixa rastro verificável.</h1><p class="lead">${evidence.length} oportunidades preservadas; ${online.length} profissionais admitidos. Framework declarado não substitui prova de execução.</p><section class="grid">${cards}</section></main></body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(outputDirectory, { recursive: true });
  const sourceRuns = reuse ? await loadRuns() : await collectFreshRuns();
  if (!reuse && sourceRuns.length !== SOURCE_KEYS.length) throw new Error("Execução nova não cobriu todas as fontes.");
  await wait(500);
  const [report, opportunities] = await Promise.all([
    json<CenyraReport>(`${cenyraBaseUrl}/api/report`),
    json<OpportunityEvidence[]>(`${cenyraBaseUrl}/api/opportunities?limit=1000`),
  ]);
  const selectedRuns = reuse
    ? SOURCE_KEYS.map((source) => sourceRuns.find((run) => run.source === source)).filter((run): run is CenyraRun => Boolean(run))
    : sourceRuns;
  const allRuns = [...selectedRuns, synthesisRun(report)];
  const online: OnlineResult[] = [];
  if (!offline) {
    const [area, connector, existingAgents] = await Promise.all([
      ensureArea(),
      configureConnector(),
      musterApi<AgentSummary[]>("/agents"),
    ]);
    for (const run of allRuns) {
      const profession = CENYRA_PROFESSIONS[run.source];
      if (!profession) throw new Error(`Profissão não definida para ${run.source}.`);
      online.push(await admitAndIngest(profession, run, area, connector, existingAgents));
    }
  }

  const payload = { runId, offline, reuse, cenyraBaseUrl, musterBaseUrl, runs: allRuns, evidence: opportunities, online };
  writeFileSync(resolve(outputDirectory, "report.json"), JSON.stringify(payload, null, 2));
  writeFileSync(resolve(outputDirectory, "report.md"), markdown(allRuns, opportunities, online));
  writeFileSync(resolve(outputDirectory, "report.html"), html(allRuns, opportunities, online));
  for (const run of allRuns) {
    const profile = cenyraEvidenceProfile(run);
    console.log(`${run.agent_name}: coleta=${profile.collectionKind}, análise=${profile.analysisKind}, registros=${run.metrics.records_discovered}, decisão=${profile.decisionGrade ? "sim" : "não"}.`);
  }
  console.log(offline ? "Admissão online não executada." : `${online.length} profissionais admitidos com evidência idempotente.`);
  console.log(`Relatório: ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
