import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateMaturity,
  stageLabels,
  type EvidenceStatus,
  type MaturityAssessment,
  type ReadinessCheck,
} from "./maturity-evaluator";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(HERE, "../..");

interface CommandSpec {
  id: string;
  label: string;
  args: string[];
  timeoutMs: number;
  env?: Record<string, string>;
}

interface CommandResult {
  id: string;
  label: string;
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  outputTail: string;
}

function argument(name: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

function hasFile(path: string): boolean {
  return existsSync(resolve(WORKSPACE, path));
}

function fileContains(path: string, pattern: RegExp): boolean {
  const fullPath = resolve(WORKSPACE, path);
  return existsSync(fullPath) && pattern.test(readFileSync(fullPath, "utf8"));
}

function hasReport(directory: string): boolean {
  const root = resolve(WORKSPACE, directory);
  if (!existsSync(root)) return false;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of readdirSync(current)) {
      const path = resolve(current, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) pending.push(path);
      else if (entry === "report.json") return true;
    }
  }
  return false;
}

async function runCommand(spec: CommandSpec): Promise<CommandResult> {
  const startedAt = Date.now();
  return new Promise((complete) => {
    let output = "";
    let timedOut = false;
    let settled = false;
    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      complete(result);
    };
    const child = spawn("pnpm", spec.args, {
      cwd: WORKSPACE,
      env: { ...process.env, ...spec.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 40_000) output = output.slice(-40_000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, spec.timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      finish({
        id: spec.id,
        label: spec.label,
        passed: false,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        outputTail: error.message,
      });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const lines = output.trim().split("\n");
      finish({
        id: spec.id,
        label: spec.label,
        passed: !timedOut && exitCode === 0,
        exitCode,
        durationMs: Date.now() - startedAt,
        outputTail: `${timedOut ? "TIMEOUT\n" : ""}${lines.slice(-12).join("\n")}`,
      });
    });
  });
}

function status(
  proven: boolean,
  partial: boolean,
): EvidenceStatus {
  if (proven) return "proven";
  return partial ? "partial" : "missing";
}

function buildChecks(results: CommandResult[], releaseUrl?: string): ReadinessCheck[] {
  const passed = (id: string) => results.some((result) => result.id === id && result.passed);
  const authE2E = passed("e2e-authenticated");
  const publicE2E = passed("e2e-public");
  const integration = passed("postgres-integration");
  const backendUnit = passed("backend-unit");
  const frontendBuild = passed("frontend-build");
  const releaseSmoke = passed("release-smoke");
  const realAgentEvidence = hasReport("output/real-agents") || hasReport("output/gauntlet/cenyra");
  const operationalEvidence = hasReport("output/gauntlet/operational");
  const backupRestoreEvidence = fileContains(
    "output/release/backup-restore.json",
    /"status"\s*:\s*"passed"/,
  );
  const pilotAcceptance = fileContains(
    "output/pilot/acceptance.json",
    /"status"\s*:\s*"accepted"/,
  );
  const commercialPackage =
    hasFile("docs/COMMERCIAL-PACKAGE.md") &&
    fileContains("docs/COMMERCIAL-PACKAGE.md", /preço|pricing/i) &&
    fileContains("docs/COMMERCIAL-PACKAGE.md", /suporte|support/i);

  return [
    {
      id: "vertical-flow",
      dimension: "Produto",
      title: "Fluxo vertical autenticado",
      weight: 14,
      status: status(authE2E, hasFile("artifacts/cohort/e2e/authenticated.spec.ts")),
      evidence: authE2E
        ? ["Setup Clerk e jornadas autenticadas concluídos sem skip."]
        : ["Suíte autenticada existe, mas não foi aprovada nesta execução."],
      gap: "Provar admissão, métricas, decisão e próxima ação em um tenant limpo.",
      workstream: "Produto e qualidade",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "auth-tenancy",
      dimension: "Segurança",
      title: "Autenticação e isolamento tenant",
      weight: 12,
      status: status(integration && authE2E, backendUnit),
      evidence: [
        integration ? "Integrações PostgreSQL tenant-scoped aprovadas." : "Integrações tenant-scoped não aprovadas nesta execução.",
        authE2E ? "Organização Clerk real ativada no navegador." : "Sessão/organização Clerk não comprovadas nesta execução.",
      ],
      gap: "Provar isolamento com banco real e identidade organizacional ativa.",
      workstream: "Segurança e tenancy",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "decision-persistence",
      dimension: "Governança",
      title: "Decisão e evidência persistidas",
      weight: 8,
      status: status(authE2E && integration, backendUnit),
      evidence: [
        authE2E ? "Aprovar, ajustar e rejeitar foram exercitados na UI." : "Fluxos de decisão não foram exercitados na UI nesta execução.",
        integration ? "Planos e catálogo foram validados no PostgreSQL." : "Persistência não foi validada no PostgreSQL nesta execução.",
      ],
      gap: "Validar decisões isoladas, SLA, ações e evidência até a conclusão.",
      workstream: "Produto e qualidade",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "continuous-telemetry",
      dimension: "Observabilidade",
      title: "Telemetria e governança contínuas",
      weight: 10,
      status: status(false, integration && operationalEvidence),
      evidence: [
        integration ? "Outbox, ingestão e isolamento foram testados no PostgreSQL." : "Integração de telemetria não aprovada.",
        operationalEvidence ? "Existem campanhas operacionais com relatórios." : "Não há relatório operacional encontrado.",
        "Não existe soak test contínuo de 24 horas aprovado.",
      ],
      gap: "Executar 24 horas com freshness, backlog, alertas, regressão e zero perda.",
      workstream: "Confiabilidade e observabilidade",
      effortDays: { min: 3, max: 5 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "connector-proof",
      dimension: "Integrações",
      title: "Conector real e onboarding plug-and-play",
      weight: 10,
      status: status(false, integration && realAgentEvidence),
      evidence: [
        integration ? "Contrato universal e ingestão por credencial foram integrados." : "Contrato de ingestão não aprovado.",
        realAgentEvidence ? "Há execução local de agentes registrada." : "Não há execução de agente encontrada.",
        "Nenhum conector enterprise externo está homologado end-to-end.",
      ],
      gap: "Homologar um provider real da conexão ao KPI e relatório executivo.",
      workstream: "Integrações e dados",
      effortDays: { min: 3, max: 5 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "release-runtime",
      dimension: "Plataforma",
      title: "Runtime de release reproduzível",
      weight: 10,
      status: status(Boolean(releaseUrl) && releaseSmoke, frontendBuild && hasFile("docker-compose.release.yml")),
      evidence: [
        frontendBuild ? "Build frontend de produção aprovado." : "Build frontend não aprovado nesta execução.",
        hasFile("docker-compose.release.yml") ? "Compose de release existe." : "Compose de release ausente.",
        releaseSmoke ? `Release smoke aprovado em ${releaseUrl}.` : "Release smoke em ambiente publicado não executado.",
      ],
      gap: "Publicar imagem imutável e aprovar health, worker, rotas e migrations no host alvo.",
      workstream: "Plataforma e release",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "backup-rollback",
      dimension: "Resiliência",
      title: "Backup, restore e rollback ensaiados",
      weight: 8,
      status: backupRestoreEvidence ? "proven" : "missing",
      evidence: backupRestoreEvidence
        ? ["Artefato de restauração aprovado encontrado."]
        : ["Há documentação, mas nenhum artefato de restore aprovado."],
      gap: "Restaurar banco, validar integridade e voltar à imagem anterior com tempo medido.",
      workstream: "Plataforma e release",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "operational-slo",
      dimension: "Operações",
      title: "SLO, incidentes e capacidade",
      weight: 8,
      status: status(false, backendUnit && operationalEvidence),
      evidence: [
        operationalEvidence ? "Gauntlet baseline/stress/chaos possui relatórios." : "Campanhas de stress não encontradas.",
        "Capacidade multi-tenant, burn rate e plantão ainda não foram aprovados em produção.",
      ],
      gap: "Definir SLOs, alertas, runbook e testar saturação com volume alvo.",
      workstream: "Confiabilidade e observabilidade",
      effortDays: { min: 3, max: 5 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "ux-adoption",
      dimension: "Experiência",
      title: "Usabilidade e onboarding",
      weight: 6,
      status: status(false, publicE2E && authE2E),
      evidence: [
        publicE2E && authE2E ? "Jornadas públicas e autenticadas foram aprovadas." : "Cobertura completa de browser não aprovada.",
        "Acessibilidade e regressão visual pixel a pixel ainda não possuem gate.",
      ],
      gap: "Adicionar a11y, visual regression e teste moderado com gestores externos.",
      workstream: "Produto e qualidade",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: false,
      criticalForGeneralAvailability: true,
    },
    {
      id: "security-privacy",
      dimension: "Risco",
      title: "Segurança, privacidade e auditoria",
      weight: 6,
      status: status(false, integration && fileContains("README.md", /privacy gap/i)),
      evidence: [
        "Criptografia de credenciais e isolamento possuem testes.",
        "Retenção configurável permanece registrada como lacuna de privacidade.",
      ],
      gap: "Fechar retenção, export/delete, threat model e checklist de segurança do piloto.",
      workstream: "Segurança e tenancy",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "commercial-package",
      dimension: "Comercial",
      title: "Oferta, preço e operação de suporte",
      weight: 4,
      status: commercialPackage ? "proven" : "missing",
      evidence: commercialPackage
        ? ["Pacote comercial com preço e suporte encontrado."]
        : ["Não há pacote versionado com ICP, escopo, preço, SLA e suporte."],
      gap: "Definir oferta de piloto, limites, preço, aceite, suporte e responsabilidade do cliente.",
      workstream: "Go-to-market e jurídico",
      effortDays: { min: 2, max: 4 },
      criticalForPaidPilot: true,
      criticalForGeneralAvailability: true,
    },
    {
      id: "customer-pilot",
      dimension: "Mercado",
      title: "Resultado validado por cliente",
      weight: 4,
      status: status(pilotAcceptance, realAgentEvidence),
      evidence: [
        realAgentEvidence ? "Há workloads locais reais ou históricos." : "Não há workload real encontrado.",
        pilotAcceptance ? "Aceite de piloto encontrado." : "Não há aceite externo com outcome e período medidos.",
      ],
      gap: "Executar piloto com um cliente/design partner e registrar aceite, outcome e objeções.",
      workstream: "Go-to-market e jurídico",
      effortDays: { min: 4, max: 8 },
      criticalForPaidPilot: false,
      criticalForGeneralAvailability: true,
    },
  ];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markdown(assessment: MaturityAssessment, results: CommandResult[]): string {
  const checks = assessment.checks.map((check) =>
    `| ${check.dimension} | ${check.title} | ${check.status} | ${check.weight} | ${check.evidence.join(" ")} |`,
  ).join("\n");
  const blockers = assessment.paidPilotBlockers.map((check) =>
    `- **${check.title}:** ${check.gap}`,
  ).join("\n") || "- Nenhum bloqueador crítico.";
  const commands = results.map((result) =>
    `| ${result.label} | ${result.passed ? "PASS" : "FAIL"} | ${(result.durationMs / 1_000).toFixed(1)} s |`,
  ).join("\n") || "| Nenhum comando executado | N/A | 0 s |";
  return `# Mara — avaliação de maturidade do Muster\n\n` +
    `- Score: **${assessment.score}/100**\n` +
    `- Estágio seguro: **${stageLabels[assessment.stage]}**\n` +
    `- Piloto pago: **${assessment.paidPilotReady ? "GO" : "NO-GO"}**\n` +
    `- Disponibilidade geral: **${assessment.generalAvailabilityReady ? "GO" : "NO-GO"}**\n\n` +
    `## Prazo estimado\n\n` +
    `- Piloto pago: ${assessment.paidPilotEstimate.personDays.min}-${assessment.paidPilotEstimate.personDays.max} pessoa-dias; ` +
    `${assessment.paidPilotEstimate.parallelCalendarDays.min}-${assessment.paidPilotEstimate.parallelCalendarDays.max} dias úteis em paralelo.\n` +
    `- Disponibilidade geral: ${assessment.generalAvailabilityEstimate.personDays.min}-${assessment.generalAvailabilityEstimate.personDays.max} pessoa-dias; ` +
    `${assessment.generalAvailabilityEstimate.parallelCalendarDays.min}-${assessment.generalAvailabilityEstimate.parallelCalendarDays.max} dias úteis em paralelo.\n\n` +
    `## Bloqueadores do piloto pago\n\n${blockers}\n\n` +
    `## Matriz\n\n| Dimensão | Gate | Estado | Peso | Evidência |\n|---|---|---|---:|---|\n${checks}\n\n` +
    `## Comandos\n\n| Comando | Resultado | Duração |\n|---|---|---:|\n${commands}\n\n` +
    `## Limites do avaliador\n\n` +
    `Mara não considera documentação como prova operacional, não conta testes ignorados e não aprova produção sem ambiente publicado, restore e workload externo.\n`;
}

function html(assessment: MaturityAssessment): string {
  const checks = assessment.checks.map((check) => `
    <article class="check ${check.status}"><div><span>${escapeHtml(check.dimension)}</span><h2>${escapeHtml(check.title)}</h2></div><strong>${check.status}</strong><p>${escapeHtml(check.evidence.join(" "))}</p><small>${escapeHtml(check.gap)}</small></article>`).join("");
  const blockers = assessment.paidPilotBlockers.map((check) =>
    `<li><strong>${escapeHtml(check.title)}</strong><span>${escapeHtml(check.gap)}</span></li>`,
  ).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mara · Muster maturity</title><style>
  :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#ecf2ff;background:#080b13}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#243169 0,transparent 34%),#080b13}main{max-width:1240px;margin:auto;padding:54px 24px 80px}.eyebrow{color:#8ea6ff;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:800}h1{font-size:clamp(38px,7vw,78px);line-height:.95;letter-spacing:-.05em;margin:16px 0}.lead{max-width:760px;color:#9ca9c3;font-size:18px;line-height:1.55}.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.score,.estimate,.check,.blockers{border:1px solid #293452;background:rgba(15,20,34,.9);border-radius:22px}.score{padding:28px}.score strong{font-size:72px;letter-spacing:-.06em}.score span{color:#8ea6ff}.estimate{padding:24px;display:grid;gap:18px}.estimate strong{font-size:28px}.estimate small,.check p,.check small,.blockers span{color:#96a3bb}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:18px}.check{padding:20px}.check>div{display:flex;justify-content:space-between;gap:14px}.check span{color:#8ea6ff;font-size:10px;text-transform:uppercase;letter-spacing:.12em}.check h2{font-size:17px;margin:7px 0 0}.check>strong{display:inline-block;margin:16px 0 4px;text-transform:uppercase;font-size:10px;padding:5px 8px;border-radius:99px}.check.proven>strong{background:#173f38;color:#7fe0ca}.check.partial>strong{background:#493b19;color:#ffd87d}.check.missing>strong{background:#4b2028;color:#ff9baa}.check small{display:block;border-top:1px solid #293452;padding-top:12px;margin-top:12px}.blockers{margin-top:18px;padding:24px}.blockers li{display:grid;gap:5px;margin:12px 0}@media(max-width:800px){.hero,.grid{grid-template-columns:1fr}}
  </style></head><body><main><div class="eyebrow">Muster · independent readiness gate</div><h1>Mara não confunde software funcionando com negócio pronto.</h1><p class="lead">Score baseado em evidência executada, bloqueadores de comercialização e capacidade operacional comprovada.</p><section class="hero"><div class="score"><span>Maturidade atual</span><strong>${assessment.score}</strong><p>${escapeHtml(stageLabels[assessment.stage])} · piloto pago ${assessment.paidPilotReady ? "GO" : "NO-GO"}</p></div><div class="estimate"><div><small>Piloto pago</small><strong>${assessment.paidPilotEstimate.parallelCalendarDays.min}-${assessment.paidPilotEstimate.parallelCalendarDays.max} dias úteis</strong></div><div><small>Disponibilidade geral</small><strong>${assessment.generalAvailabilityEstimate.parallelCalendarDays.min}-${assessment.generalAvailabilityEstimate.parallelCalendarDays.max} dias úteis</strong></div></div></section><section class="blockers"><div class="eyebrow">Bloqueadores do piloto</div><ul>${blockers || "<li>Nenhum bloqueador crítico.</li>"}</ul></section><section class="grid">${checks}</section></main></body></html>`;
}

async function main(): Promise<void> {
  const mode = argument("mode") ?? "fast";
  if (mode !== "fast" && mode !== "full") throw new Error("Use --mode=fast ou --mode=full.");
  const browserBaseUrl = argument("base-url");
  const releaseUrl = argument("release-url");
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDirectory = resolve(
    WORKSPACE,
    argument("output") ?? `output/maturity/${runId}`,
  );
  const browserEnv: Record<string, string> = browserBaseUrl
    ? { PLAYWRIGHT_BASE_URL: browserBaseUrl, PLAYWRIGHT_SKIP_WEBSERVER: "true" }
    : { PLAYWRIGHT_SKIP_WEBSERVER: "false" };
  const commands: CommandSpec[] = mode === "full" ? [
    { id: "frontend-typecheck", label: "Frontend typecheck", args: ["--filter", "@workspace/muster", "run", "typecheck"], timeoutMs: 120_000 },
    { id: "frontend-unit", label: "Frontend unit", args: ["--filter", "@workspace/muster", "run", "test"], timeoutMs: 120_000 },
    { id: "backend-unit", label: "Backend unit", args: ["--filter", "@workspace/api-server", "run", "test"], timeoutMs: 180_000 },
    { id: "postgres-integration", label: "PostgreSQL integration", args: ["run", "test:integration"], timeoutMs: 180_000 },
    { id: "frontend-build", label: "Frontend production build", args: ["--filter", "@workspace/muster", "run", "build"], timeoutMs: 180_000 },
    { id: "e2e-authenticated", label: "Authenticated E2E", args: ["--filter", "@workspace/muster", "run", "test:e2e:authenticated"], timeoutMs: 600_000, env: browserEnv },
    { id: "e2e-public", label: "Public desktop/mobile E2E", args: ["--filter", "@workspace/muster", "run", "test:e2e:public"], timeoutMs: 420_000, env: browserEnv },
    ...(releaseUrl ? [{ id: "release-smoke", label: "Published release smoke", args: ["run", "release:smoke", "--", releaseUrl], timeoutMs: 120_000 }] : []),
  ] : [];
  const results: CommandResult[] = [];
  for (const command of commands) {
    process.stdout.write(`Mara · ${command.label}... `);
    const result = await runCommand(command);
    results.push(result);
    console.log(result.passed ? "PASS" : "FAIL");
  }
  const assessment = evaluateMaturity(buildChecks(results, releaseUrl));
  mkdirSync(outputDirectory, { recursive: true });
  const report = {
    agent: {
      name: "Mara Commercial Readiness Auditor",
      version: "1.0.0",
      autonomy: "L1-audit-only",
      purpose: "Avaliar maturidade operacional e comercial sem alterar o produto.",
    },
    evaluatedAt: new Date().toISOString(),
    mode,
    assessment,
    commands: results,
  };
  writeFileSync(resolve(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(resolve(outputDirectory, "report.md"), markdown(assessment, results));
  writeFileSync(resolve(outputDirectory, "report.html"), html(assessment));
  console.log(`Maturidade: ${assessment.score}/100 · ${stageLabels[assessment.stage]}`);
  console.log(`Piloto pago: ${assessment.paidPilotReady ? "GO" : "NO-GO"}`);
  console.log(`Prazo paralelo: ${assessment.paidPilotEstimate.parallelCalendarDays.min}-${assessment.paidPilotEstimate.parallelCalendarDays.max} dias úteis.`);
  console.log(`Relatório: ${outputDirectory}`);
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
