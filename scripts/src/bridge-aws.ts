/**
 * Ponte AWS → Muster (coleta *pull*).
 *
 * Origem: agentes no Bedrock / AgentCore. A telemetria de invocação vai para o
 * CloudWatch Logs; a consulta usa **CloudWatch Logs Insights**, que aceita uma
 * query declarativa sobre o log group do agente.
 *
 * Autenticação: credencial **somente leitura**. O padrão enterprise é um role
 * cross-account com external ID, assumido pelo Muster — nunca chave estática de
 * usuário. Esta ponte aceita as duas formas para viabilizar POC rápida, mas o
 * role é o caminho a exigir em produção.
 *
 * Modos:
 *   --fixture   valida a tradução sem tocar na AWS
 *   --dry-run   mostra o que seria enviado
 *   --horas=24  janela
 *   --mapa=arq  { "nome-do-agente-na-aws": { "agentId": "<id no Muster>" } }
 *
 * Variáveis: AWS_REGION, AWS_LOG_GROUP, e a credencial padrão do SDK
 * (AWS_ACCESS_KEY_ID/SECRET, ou role assumido no ambiente).
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

/**
 * Query de CloudWatch Logs Insights sobre as invocações do Bedrock.
 * Os campos seguem o registro de invocação do modelo; ajuste os nomes conforme
 * o formato de log configurado na conta do cliente — é o ponto que mais varia.
 */
export function montarQueryInsights(): string {
  return `
fields @timestamp, agentName, modelId, inputTokens, outputTokens, latencyMs, success, traceId
| filter ispresent(modelId)
| sort @timestamp asc
| limit 5000`.trim();
}

interface ResultadoInsights {
  results: Array<Array<{ field: string; value: string }>>;
}

/** CloudWatch devolve pares campo/valor; normalizamos para o denominador comum. */
export function normalizarInsights(res: ResultadoInsights): ExecucaoObservada[] {
  return res.results.map((linha) => {
    const c = Object.fromEntries(linha.map((f) => [f.field, f.value]));
    const num = (v: string | undefined) => (v === undefined || v === "" ? null : Number(v));
    return {
      agente: c.agentName ?? c["@logStream"] ?? "desconhecido",
      ts: c["@timestamp"] ?? new Date().toISOString(),
      durationMs: Number(c.latencyMs ?? 0),
      modelo: c.modelId ?? "",
      tokensIn: num(c.inputTokens),
      tokensOut: num(c.outputTokens),
      sucesso: String(c.success ?? "true").toLowerCase() === "true",
      traceId: c.traceId ?? "",
    };
  });
}

async function consultar(): Promise<ExecucaoObservada[]> {
  if (usarFixture) {
    const caminho = resolve(HERE, "..", "fixtures", "aws-cloudwatch.json");
    if (!existsSync(caminho)) throw new Error(`Fixture não encontrada: ${caminho}`);
    return normalizarInsights(JSON.parse(readFileSync(caminho, "utf8")) as ResultadoInsights);
  }
  throw new Error(
    "Consulta ao vivo do CloudWatch exige o SDK da AWS instalado e credencial de leitura.\n" +
      "Passos para habilitar:\n" +
      "  1. pnpm add -D @aws-sdk/client-cloudwatch-logs --filter @workspace/scripts\n" +
      "  2. exportar AWS_REGION e AWS_LOG_GROUP\n" +
      "  3. usar role cross-account com external ID (produção) ou credencial de leitura (POC)\n" +
      `  4. a query já está pronta:\n\n${montarQueryInsights()}\n\n` +
      "Enquanto isso, --fixture valida a tradução ponta a ponta sem tocar na AWS.",
  );
}

async function main(): Promise<void> {
  console.log(`\n▸ Ponte AWS → Muster${usarFixture ? "  (modo fixture, sem tocar na AWS)" : ""}`);
  console.log(`  janela: ${horas}h · destino: ${musterBaseUrl}${dryRun ? " · DRY-RUN" : ""}\n`);
  await entregarAoMuster({
    execucoes: await consultar(),
    origem: "aws-cloudwatch",
    musterBaseUrl,
    mapa: carregarMapa(arg("mapa")),
    dryRun,
  });
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
