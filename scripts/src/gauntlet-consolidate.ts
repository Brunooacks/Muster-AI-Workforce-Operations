import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GauntletProfile, WorkloadSummary } from "./gauntlet-workloads";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "../..");
const OUTPUT = resolve(WORKSPACE, "output/gauntlet/operational");
const PROFILES: GauntletProfile[] = ["baseline", "stress", "chaos"];

interface ReportFile {
  profile: GauntletProfile;
  summaries: WorkloadSummary[];
}

const reports = PROFILES.map((profile) => JSON.parse(
  readFileSync(resolve(OUTPUT, profile, "report.json"), "utf8"),
) as ReportFile);

const scenarioIds = reports[0]!.summaries.map((summary) => summary.scenarioId);
const rows = scenarioIds.map((scenarioId) => {
  const byProfile = Object.fromEntries(reports.map((report) => [
    report.profile,
    report.summaries.find((summary) => summary.scenarioId === scenarioId),
  ])) as Record<GauntletProfile, WorkloadSummary | undefined>;
  return { scenarioId, byProfile };
});

const reportJson = { generatedAt: new Date().toISOString(), profiles: PROFILES, rows };
writeFileSync(resolve(OUTPUT, "comparison.json"), JSON.stringify(reportJson, null, 2));

const cards = rows.map(({ scenarioId, byProfile }) => {
  const title = byProfile.baseline?.agentName ?? scenarioId;
  const bars = PROFILES.map((profile) => {
    const summary = byProfile[profile];
    const quality = summary?.qualityRate ?? 0;
    return `<div class="metric"><span>${profile}</span><div><i style="width:${quality}%"></i></div><strong>${quality}%</strong><small>${summary?.total ?? 0} exec · p95 ${summary?.p95DurationMs ?? 0} ms</small></div>`;
  }).join("");
  return `<article><h2>${title}</h2>${bars}</article>`;
}).join("");

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Muster · comparação do Gauntlet</title><style>
  :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#080b13;color:#edf2ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 5% 0,#18345a 0,transparent 30%),#080b13}main{max-width:1180px;margin:auto;padding:60px 28px 90px}.eyebrow{color:#72a7ff;letter-spacing:.16em;text-transform:uppercase;font-size:12px;font-weight:800}h1{font-size:clamp(42px,7vw,80px);line-height:.95;letter-spacing:-.055em;margin:18px 0}.lead{color:#9aa8bf;font-size:19px;line-height:1.5;max-width:760px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:38px}article{padding:25px;border:1px solid #263653;border-radius:22px;background:rgba(12,18,31,.9)}h2{font-size:21px;margin:0 0 24px}.metric{display:grid;grid-template-columns:70px 1fr 64px;gap:12px;align-items:center;margin:14px 0}.metric>span{text-transform:uppercase;font-size:11px;letter-spacing:.1em;color:#97a5bb}.metric>div{height:9px;border-radius:99px;background:#1e2940;overflow:hidden}.metric i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#36d7bc,#77a6ff)}.metric strong{text-align:right}.metric small{grid-column:2/4;color:#7f8ca2}@media(max-width:760px){.grid{grid-template-columns:1fr}}
</style></head><body><main><div class="eyebrow">Muster · evidence comparison</div><h1>Baseline, stress e caos na mesma leitura.</h1><p class="lead">A comparação distingue qualidade funcional da resiliência operacional. Quedas no perfil chaos são falhas deliberadamente injetadas e devem aparecer na telemetria, não ser mascaradas.</p><section class="grid">${cards}</section></main></body></html>`;

writeFileSync(resolve(OUTPUT, "comparison.html"), html);
console.log(resolve(OUTPUT, "comparison.html"));
