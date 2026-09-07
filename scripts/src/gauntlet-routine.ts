import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GauntletProfile, WorkloadSummary } from "./gauntlet-workloads";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "../..");
const TSX = resolve(WORKSPACE, "scripts/node_modules/.bin/tsx");
const OPERATIONAL_SCRIPT = resolve(HERE, "gauntlet-operational.ts");
const NON_DEVELOPMENT_DOMAINS = [
  "customer-support",
  "finance",
  "business",
  "context",
  "governance",
  "journey",
  "reliability",
].join(",");

interface OnlineResult {
  scenarioId: string;
  agentId: string;
  deliveredEvents: number;
  executionEvents: number;
  errorEvents: number;
  reevaluation: { healthScore: number; verdict: string };
  telemetry: { totalExecutions: number; successRate: number | null; totalCostCents: number };
  supervision: { status: string; isStale: boolean };
  admission: { metricCount: number; ownerCount: number; valid: boolean };
  deliveryDurationMs: number;
  deliveryThroughputPerSecond: number;
}

interface OperationalReport {
  runId: string;
  profile: GauntletProfile;
  offline: boolean;
  summaries: WorkloadSummary[];
  onlineResults: OnlineResult[];
}

interface RoutineRound {
  round: number;
  profile: GauntletProfile;
  reportPath: string;
  executions: number;
  successful: number;
  deliveredEvents: number;
  errorEvents: number;
  averageHealth: number | null;
  validAdmissions: number;
  wallDurationMs: number;
  deliveryThroughputPerSecond: number | null;
}

function argument(name: string): string | undefined {
  const prefixed = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (prefixed) return prefixed.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? "true" : undefined;
}

function positiveInteger(value: string | undefined, fallback: number, label: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error(`${label} deve ser um inteiro entre 1 e 20.`);
  }
  return parsed;
}

function profiles(value: string | undefined): GauntletProfile[] {
  const selected = (value ?? "baseline,stress,chaos")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const valid: GauntletProfile[] = ["baseline", "stress", "chaos"];
  const invalid = selected.filter((profile) => !valid.includes(profile as GauntletProfile));
  if (invalid.length > 0) throw new Error(`Perfis inválidos: ${invalid.join(", ")}.`);
  return selected as GauntletProfile[];
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function executeOperational(args: string[]): Promise<number> {
  const startedAt = process.hrtime.bigint();
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(TSX, [OPERATIONAL_SCRIPT, ...args], {
      cwd: WORKSPACE,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("close", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Gauntlet terminou com código ${code ?? 1}.`));
    });
  });
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function summarizeRound(
  round: number,
  reportPath: string,
  report: OperationalReport,
  wallDurationMs: number,
): RoutineRound {
  const executions = report.summaries.reduce((total, summary) => total + summary.total, 0);
  const successful = report.summaries.reduce((total, summary) => total + summary.successful, 0);
  const deliveredEvents = report.onlineResults.reduce((total, result) => total + result.deliveredEvents, 0);
  const errorEvents = report.onlineResults.reduce((total, result) => total + result.errorEvents, 0);
  const averageHealth = report.onlineResults.length > 0
    ? Math.round(report.onlineResults.reduce((total, result) => total + result.reevaluation.healthScore, 0) / report.onlineResults.length)
    : null;
  const deliveryDurationMs = report.onlineResults.reduce(
    (total, result) => total + result.deliveryDurationMs,
    0,
  );
  return {
    round,
    profile: report.profile,
    reportPath,
    executions,
    successful,
    deliveredEvents,
    errorEvents,
    averageHealth,
    validAdmissions: report.onlineResults.filter((result) => result.admission.valid).length,
    wallDurationMs: Math.round(wallDurationMs),
    deliveryThroughputPerSecond: deliveryDurationMs > 0
      ? Number(((deliveredEvents / deliveryDurationMs) * 1_000).toFixed(2))
      : null,
  };
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(2)} s`;
}

function htmlReport(runId: string, rounds: RoutineRound[], offline: boolean): string {
  const totalExecutions = rounds.reduce((total, round) => total + round.executions, 0);
  const totalEvents = rounds.reduce((total, round) => total + round.deliveredEvents, 0);
  const totalWallDurationMs = rounds.reduce((total, round) => total + round.wallDurationMs, 0);
  const cards = rounds.map((round) => {
    const quality = Number(((round.successful / Math.max(1, round.executions)) * 100).toFixed(2));
    return `<article><div class="head"><span>rodada ${round.round} · ${round.profile}</span><strong>${round.averageHealth ?? "—"}</strong></div><h2>${round.executions.toLocaleString("pt-BR")} execuções</h2><div class="bar"><i style="width:${quality}%"></i></div><dl><div><dt>Qualidade</dt><dd>${quality}%</dd></div><div><dt>Tempo real</dt><dd>${formatDuration(round.wallDurationMs)}</dd></div><div><dt>Eventos</dt><dd>${round.deliveredEvents.toLocaleString("pt-BR")}</dd></div><div><dt>Ingestão</dt><dd>${round.deliveryThroughputPerSecond === null ? "—" : `${round.deliveryThroughputPerSecond}/s`}</dd></div><div><dt>Erros</dt><dd>${round.errorEvents}</dd></div><div><dt>Admissões</dt><dd>${round.validAdmissions}</dd></div></dl></article>`;
  }).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Muster · rotina de stress</title><style>
    :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17231e;background:#edf2f0}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 88% 0,#dff4cc 0,transparent 32%),#edf2f0}main{max-width:1240px;margin:auto;padding:58px 28px 88px}.eyebrow{color:#07776f;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:850}h1{max-width:920px;margin:18px 0 16px;font:500 clamp(42px,7vw,78px)/.98 Georgia,serif;letter-spacing:-.05em}.lead{max-width:780px;color:#5e6d66;font-size:19px;line-height:1.5}.stats,.grid{display:grid;gap:16px}.stats{grid-template-columns:repeat(4,1fr);margin:36px 0}.grid{grid-template-columns:repeat(2,1fr)}.stat,article{border:1px solid #cfdbd5;border-radius:22px;background:rgba(255,254,250,.92);box-shadow:0 18px 50px rgba(24,48,40,.07)}.stat{padding:24px}.stat strong{display:block;font-size:36px}.stat span,dt{color:#66766e}article{padding:23px}.head{display:flex;align-items:center;justify-content:space-between}.head span{color:#07776f;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.head strong{display:grid;width:44px;height:44px;place-items:center;border-radius:14px;background:#d9f0eb;color:#075f58}h2{margin:16px 0;font-size:22px}.bar{height:9px;overflow:hidden;border-radius:99px;background:#e6ece8}.bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#07776f,#98d665)}dl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 0}dt{font-size:9px;text-transform:uppercase}dd{margin:5px 0 0;font-weight:750}@media(max-width:780px){.stats,.grid{grid-template-columns:1fr}dl{grid-template-columns:repeat(2,1fr)}}
  </style></head><body><main><div class="eyebrow">Muster · continuous pressure lab</div><h1>Execução repetida, falha visível, decisão confiável.</h1><p class="lead">${offline ? "Validação offline dos workloads." : "Admissão válida, telemetria real, reavaliação e supervisão acumuladas"} em ${rounds.length} ciclos do Gauntlet.</p><section class="stats"><div class="stat"><strong>${totalExecutions.toLocaleString("pt-BR")}</strong><span>execuções exercitadas</span></div><div class="stat"><strong>${formatDuration(totalWallDurationMs)}</strong><span>tempo real de campanha</span></div><div class="stat"><strong>${totalEvents.toLocaleString("pt-BR")}</strong><span>eventos entregues ao Muster</span></div><div class="stat"><strong>8</strong><span>especialidades monitoradas</span></div></section><section class="grid">${cards}</section><p class="lead">Run ID: ${runId}</p></main></body></html>`;
}

async function main(): Promise<void> {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const roundCount = positiveInteger(argument("rounds"), 3, "rounds");
  const pauseMs = Math.max(0, Number(argument("pause-ms") ?? "1500"));
  const selectedProfiles = profiles(argument("profiles"));
  const offline = argument("offline") === "true";
  const tokenFile = argument("token-file")?.trim();
  const baseUrl = (argument("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8081").replace(/\/+$/, "");
  const outputDirectory = resolve(WORKSPACE, argument("output") ?? `output/gauntlet/routine/${runId}`);
  mkdirSync(outputDirectory, { recursive: true });

  const rounds: RoutineRound[] = [];
  for (let round = 1; round <= roundCount; round += 1) {
    for (const profile of selectedProfiles) {
      const roundDirectory = resolve(outputDirectory, `round-${String(round).padStart(2, "0")}-${profile}`);
      const args = [
        `--profile=${profile}`,
        `--base-url=${baseUrl}`,
        `--output=${roundDirectory}`,
      ];
      if (offline) args.push("--offline");
      if (tokenFile) args.push(`--token-file=${tokenFile}`);
      if (round > 1) args.push(`--domains=${NON_DEVELOPMENT_DOMAINS}`);
      console.log(`\n=== Rodada ${round}/${roundCount} · ${profile} ===`);
      const wallDurationMs = await executeOperational(args);
      const reportPath = resolve(roundDirectory, "report.json");
      const report = JSON.parse(readFileSync(reportPath, "utf8")) as OperationalReport;
      const summary = summarizeRound(round, reportPath, report, wallDurationMs);
      rounds.push(summary);
      const ingestion = summary.deliveryThroughputPerSecond === null
        ? "offline"
        : `${summary.deliveryThroughputPerSecond}/s`;
      console.log(`Monitor: execuções=${summary.executions}, tempo=${formatDuration(summary.wallDurationMs)}, eventos=${summary.deliveredEvents}, ingestão=${ingestion}, saúde=${summary.averageHealth ?? "offline"}, admissões=${summary.validAdmissions}.`);
      if (pauseMs > 0) await wait(pauseMs);
    }
  }

  const report = { runId, offline, baseUrl, roundCount, profiles: selectedProfiles, rounds };
  writeFileSync(resolve(outputDirectory, "routine.json"), JSON.stringify(report, null, 2));
  writeFileSync(resolve(outputDirectory, "routine.md"), [
    "# Rotina de stress do Muster",
    "",
    `- Run ID: ${runId}`,
    `- Modo: ${offline ? "offline" : "integrado"}`,
    `- Rodadas: ${roundCount}`,
    `- Perfis: ${selectedProfiles.join(", ")}`,
    "",
    "| Rodada | Perfil | Execuções | Corretas | Tempo real | Eventos | Ingestão/s | Erros | Saúde | Admissões válidas |",
    "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rounds.map((round) => `| ${round.round} | ${round.profile} | ${round.executions} | ${round.successful} | ${formatDuration(round.wallDurationMs)} | ${round.deliveredEvents} | ${round.deliveryThroughputPerSecond ?? "—"} | ${round.errorEvents} | ${round.averageHealth ?? "—"} | ${round.validAdmissions} |`),
    "",
  ].join("\n"));
  writeFileSync(resolve(outputDirectory, "routine.html"), htmlReport(runId, rounds, offline));
  console.log(`\nRotina concluída: ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
