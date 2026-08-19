/**
 * Ponte Google Cloud → Muster (coleta *pull*).
 *
 * Origem: agentes no Vertex AI Agent Engine. A telemetria de execução vai para
 * o Cloud Logging; a consulta usa a API `entries.list` com um filtro sobre o
 * recurso do Agent Engine.
 *
 * Autenticação: service account **somente leitura** (`logging.viewer`). Em
 * produção, o caminho preferível é Workload Identity Federation — o Muster
 * troca a própria identidade por um token do cliente, sem que ninguém precise
 * exportar e guardar um arquivo de chave.
 *
 * Modos:
 *   --fixture   valida a tradução sem tocar no GCP
 *   --dry-run   mostra o que seria enviado
 *   --horas=24  janela
 *   --mapa=arq  { "nome-do-agente-no-gcp": { "agentId": "<id no Muster>" } }
 *
 * Variáveis: GCP_PROJECT_ID e GOOGLE_APPLICATION_CREDENTIALS (ou WIF no ambiente).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  arg, carregarMapa, entregarAoMuster, type ExecucaoObservada,
} from "./bridge-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const usarFixture = arg("fixture") !== undefined;
const dryRun = arg("dry-run") !== undefined;
const horas = Number(arg("horas") ?? 24);
const musterBaseUrl = (arg("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");

/** Filtro do Cloud Logging para execuções do Agent Engine na janela. */
export function montarFiltro(horasJanela: number, projeto: string): string {
  const desde = new Date(Date.now() - horasJanela * 3_600_000).toISOString();
  return [
    `resource.type="aiplatform.googleapis.com/ReasoningEngine"`,
    `timestamp>="${desde}"`,
    `logName="projects/${projeto}/logs/aiplatform.googleapis.com%2Freasoning_engine"`,
  ].join(" AND ");
}

interface RespostaLogging {
  entries: Array<{
    timestamp: string;
    resource?: { labels?: Record<string, string> };
    jsonPayload?: Record<string, unknown>;
    severity?: string;
  }>;
}

/** Cloud Logging devolve entradas com jsonPayload; normalizamos ao comum. */
export function normalizarLogging(res: RespostaLogging): ExecucaoObservada[] {
  return (res.entries ?? []).map((e) => {
    const p = (e.jsonPayload ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (v === undefined || v === null ? null : Number(v));
    // A severidade é o sinal mais confiável de falha quando o payload não traz
    // um campo explícito de sucesso.
    const sucessoDeclarado = p.success;
    const sucesso =
      typeof sucessoDeclarado === "boolean"
        ? sucessoDeclarado
        : !["ERROR", "CRITICAL", "ALERT", "EMERGENCY"].includes(String(e.severity ?? "INFO"));
    return {
      agente: String(
        p.agentName ?? e.resource?.labels?.reasoning_engine_id ?? "desconhecido",
      ),
      ts: e.timestamp,
      durationMs: Number(p.latencyMs ?? p.durationMs ?? 0),
      modelo: String(p.model ?? p.modelName ?? ""),
      tokensIn: num(p.inputTokenCount ?? p.promptTokenCount),
      tokensOut: num(p.outputTokenCount ?? p.candidatesTokenCount),
      sucesso,
      traceId: String(p.traceId ?? ""),
      ...(p.operation ? { operacao: String(p.operation) } : {}),
    };
  });
}

async function consultar(): Promise<ExecucaoObservada[]> {
  if (usarFixture) {
    const caminho = resolve(HERE, "..", "fixtures", "gcp-cloud-logging.json");
    if (!existsSync(caminho)) throw new Error(`Fixture não encontrada: ${caminho}`);
    return normalizarLogging(JSON.parse(readFileSync(caminho, "utf8")) as RespostaLogging);
  }
  const projeto = process.env.GCP_PROJECT_ID;
  throw new Error(
    "Consulta ao vivo do Cloud Logging exige credencial de leitura.\n" +
      "Passos para habilitar:\n" +
      "  1. service account com papel roles/logging.viewer (ou Workload Identity Federation)\n" +
      "  2. exportar GCP_PROJECT_ID e GOOGLE_APPLICATION_CREDENTIALS\n" +
      "  3. POST https://logging.googleapis.com/v2/entries:list com o filtro:\n\n" +
      `${montarFiltro(horas, projeto ?? "<projeto>")}\n\n` +
      "Enquanto isso, --fixture valida a tradução ponta a ponta sem tocar no GCP.",
  );
}

async function main(): Promise<void> {
  console.log(`\n▸ Ponte Google Cloud → Muster${usarFixture ? "  (modo fixture, sem tocar no GCP)" : ""}`);
  console.log(`  janela: ${horas}h · destino: ${musterBaseUrl}${dryRun ? " · DRY-RUN" : ""}\n`);
  await entregarAoMuster({
    execucoes: await consultar(),
    origem: "gcp-cloud-logging",
    musterBaseUrl,
    mapa: carregarMapa(arg("mapa")),
    dryRun,
  });
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
