/**
 * Ponte Azure → Muster (coleta *pull*, sem instrumentar o agente do cliente).
 *
 * Por que isto é possível sem tocar no código do cliente: o Foundry Agent
 * Service exporta traces para o Application Insights automaticamente, em
 * OpenTelemetry, usando as convenções semânticas de GenAI. Quem roda agente na
 * Azure com App Insights conectado **já tem** a telemetria — o que falta é
 * alguém ler, normalizar e transformar em avaliação.
 *
 * O que a ponte faz:
 *   1. autentica no Entra ID por client credentials (permissão de LEITURA);
 *   2. consulta o Application Insights em KQL, numa janela de tempo;
 *   3. traduz cada span gen_ai em evento do Muster (duração, sucesso, tokens,
 *      custo estimado pelo modelo, timestamp real);
 *   4. entrega ao Muster com a credencial daquele agente.
 *
 * Modos:
 *   --fixture     usa uma resposta de exemplo, sem tocar na Azure (teste offline)
 *   --dry-run     mostra o que seria enviado, sem enviar
 *   --horas=24    janela de coleta (padrão 24)
 *   --mapa=arq    JSON { "nome-do-agente-na-azure": "<agentId no Muster>" }
 *
 * Variáveis (credencial de leitura, nunca de escrita):
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *   AZURE_APPINSIGHTS_APP_ID
 *   MUSTER_BASE_URL, MUSTER_AGENT_KEY_<AGENTID>  (ou --mapa com as chaves)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(nome: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (hit) return hit.slice(nome.length + 3);
  return process.argv.includes(`--${nome}`) ? "true" : undefined;
}

const usarFixture = arg("fixture") !== undefined;
const dryRun = arg("dry-run") !== undefined;
const horas = Number(arg("horas") ?? 24);
const musterBaseUrl = (arg("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");

/* ── Preço por mil tokens, em centavos de real. Ajuste conforme o contrato do
 *    cliente: é a única parte que não vem da telemetria. ─────────────────── */
const PRECO_POR_MIL_TOKENS: Record<string, number> = {
  "gpt-4o": 5.0,
  "gpt-4o-mini": 0.6,
  "gpt-4.1": 4.0,
  "gpt-4.1-mini": 0.5,
  "o3-mini": 1.5,
  "phi-4": 0.3,
  "claude-3-5-sonnet": 3.5,
  "llama-3.1-70b": 0.9,
};
const PRECO_PADRAO = 1.0;

/* ── 1. Entra ID: token de leitura ───────────────────────────────────────── */
async function obterToken(): Promise<string> {
  const tenant = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const secret = process.env.AZURE_CLIENT_SECRET;
  if (!tenant || !clientId || !secret) {
    throw new Error(
      "Faltam AZURE_TENANT_ID, AZURE_CLIENT_ID ou AZURE_CLIENT_SECRET.\n" +
        "Use --fixture para validar a ponte sem credencial da Azure.",
    );
  }
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      grant_type: "client_credentials",
      scope: "https://api.applicationinsights.io/.default",
    }),
  });
  if (!res.ok) throw new Error(`Entra ID recusou a autenticação (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

/* ── 2. Consulta KQL no Application Insights ─────────────────────────────── */
/** Spans de GenAI da janela, com os atributos das convenções semânticas OTel. */
function montarKql(horasJanela: number): string {
  return `
dependencies
| where timestamp > ago(${horasJanela}h)
| where isnotempty(customDimensions["gen_ai.operation.name"])
    or isnotempty(customDimensions["gen_ai.system"])
| extend
    agente   = tostring(coalesce(customDimensions["gen_ai.agent.name"], cloud_RoleName)),
    modelo   = tostring(customDimensions["gen_ai.request.model"]),
    entrada  = toint(customDimensions["gen_ai.usage.input_tokens"]),
    saida    = toint(customDimensions["gen_ai.usage.output_tokens"]),
    operacao = tostring(customDimensions["gen_ai.operation.name"])
| project timestamp, agente, modelo, entrada, saida, operacao, duration, success, operation_Id
| order by timestamp asc
| limit 5000`.trim();
}

interface LinhaTelemetria {
  timestamp: string;
  agente: string;
  modelo: string;
  entrada: number | null;
  saida: number | null;
  operacao: string;
  duration: number; // ms
  success: boolean | string;
  operation_Id: string;
}

interface RespostaKql {
  tables: Array<{ name: string; columns: Array<{ name: string }>; rows: unknown[][] }>;
}

function linhasDaResposta(resposta: RespostaKql): LinhaTelemetria[] {
  const tabela = resposta.tables?.[0];
  if (!tabela) return [];
  const idx = Object.fromEntries(tabela.columns.map((c, i) => [c.name, i]));
  return tabela.rows.map((r) => ({
    timestamp: String(r[idx.timestamp!]),
    agente: String(r[idx.agente!] ?? "desconhecido"),
    modelo: String(r[idx.modelo!] ?? ""),
    entrada: r[idx.entrada!] === null ? null : Number(r[idx.entrada!]),
    saida: r[idx.saida!] === null ? null : Number(r[idx.saida!]),
    operacao: String(r[idx.operacao!] ?? ""),
    duration: Number(r[idx.duration!] ?? 0),
    success: r[idx.success!] as boolean | string,
    operation_Id: String(r[idx.operation_Id!] ?? ""),
  }));
}

async function consultar(): Promise<LinhaTelemetria[]> {
  if (usarFixture) {
    const caminho = resolve(HERE, "..", "fixtures", "azure-appinsights.json");
    if (!existsSync(caminho)) throw new Error(`Fixture não encontrada: ${caminho}`);
    return linhasDaResposta(JSON.parse(readFileSync(caminho, "utf8")) as RespostaKql);
  }
  const appId = process.env.AZURE_APPINSIGHTS_APP_ID;
  if (!appId) throw new Error("Falta AZURE_APPINSIGHTS_APP_ID.");
  const token = await obterToken();
  const url = `https://api.applicationinsights.io/v1/apps/${appId}/query?query=${encodeURIComponent(montarKql(horas))}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Application Insights recusou a consulta (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return linhasDaResposta((await res.json()) as RespostaKql);
}

/* ── 3. Tradução para o envelope do Muster ───────────────────────────────── */
interface EventoMuster {
  kind: "execution" | "error";
  ts: string;
  durationMs: number;
  costCents: number;
  tokensIn?: number;
  tokensOut?: number;
  success: boolean;
  metadata: Record<string, unknown>;
}

function custoEmCentavos(modelo: string, entrada: number | null, saida: number | null): number {
  const tokens = (entrada ?? 0) + (saida ?? 0);
  if (tokens === 0) return 0;
  const preco = PRECO_POR_MIL_TOKENS[modelo] ?? PRECO_PADRAO;
  return Math.max(1, Math.round((tokens / 1000) * preco));
}

export function traduzir(linha: LinhaTelemetria): EventoMuster {
  // App Insights grava success como booleano ou como a string "True"/"False".
  const sucesso = typeof linha.success === "boolean"
    ? linha.success
    : String(linha.success).toLowerCase() === "true";
  return {
    kind: sucesso ? "execution" : "error",
    ts: new Date(linha.timestamp).toISOString(),
    durationMs: Math.round(linha.duration),
    costCents: custoEmCentavos(linha.modelo, linha.entrada, linha.saida),
    ...(linha.entrada !== null ? { tokensIn: linha.entrada } : {}),
    ...(linha.saida !== null ? { tokensOut: linha.saida } : {}),
    success: sucesso,
    metadata: {
      origem: "azure-appinsights",
      modelo: linha.modelo,
      operacao: linha.operacao,
      // Identificador do trace na Azure: permite voltar do veredito ao span
      // exato que o originou — a linhagem que uma auditoria pede.
      operationId: linha.operation_Id,
    },
  };
}

/* ── 4. Entrega ao Muster, com a credencial do agente ────────────────────── */
function carregarMapa(): Record<string, { agentId: string; key?: string }> {
  const caminho = arg("mapa");
  if (!caminho) return {};
  return JSON.parse(readFileSync(resolve(caminho), "utf8")) as Record<string, { agentId: string; key?: string }>;
}

async function main(): Promise<void> {
  console.log(`\n▸ Ponte Azure → Muster${usarFixture ? "  (modo fixture, sem tocar na Azure)" : ""}`);
  console.log(`  janela: ${horas}h · destino: ${musterBaseUrl}${dryRun ? " · DRY-RUN" : ""}\n`);

  const linhas = await consultar();
  if (linhas.length === 0) {
    console.log("Nenhum span de GenAI encontrado na janela. Confira se o App Insights está conectado ao projeto do Foundry.");
    return;
  }

  const porAgente = new Map<string, LinhaTelemetria[]>();
  for (const l of linhas) {
    const lista = porAgente.get(l.agente) ?? [];
    lista.push(l);
    porAgente.set(l.agente, lista);
  }

  const mapa = carregarMapa();
  console.log(`${linhas.length} spans em ${porAgente.size} agente(s):\n`);

  for (const [agente, spans] of porAgente) {
    const eventos = spans.map(traduzir);
    const tokens = eventos.reduce((s, e) => s + (e.tokensIn ?? 0) + (e.tokensOut ?? 0), 0);
    const custo = eventos.reduce((s, e) => s + e.costCents, 0);
    const sucesso = eventos.filter((e) => e.success).length;
    const modelos = [...new Set(spans.map((s) => s.modelo).filter(Boolean))];

    console.log(`• ${agente}`);
    console.log(`    ${eventos.length} execuções · ${Math.round((sucesso / eventos.length) * 100)}% sucesso · ${tokens.toLocaleString("pt-BR")} tokens · R$ ${(custo / 100).toFixed(2)}`);
    console.log(`    modelos: ${modelos.join(", ") || "(não declarado)"}`);

    const destino = mapa[agente];
    if (!destino) {
      console.log(`    ⚠ sem mapeamento para o Muster — acrescente "${agente}" ao arquivo de mapa\n`);
      continue;
    }
    if (dryRun) {
      console.log(`    → enviaria ${eventos.length} eventos para o agente ${destino.agentId}\n`);
      continue;
    }

    const chave = destino.key ?? process.env[`MUSTER_AGENT_KEY_${destino.agentId.replace(/-/g, "_").toUpperCase()}`];
    if (!chave) {
      console.log(`    ⚠ sem credencial do agente ${destino.agentId} — emita em /agents/:id/api-keys\n`);
      continue;
    }

    let entregues = 0;
    for (const evento of eventos) {
      const res = await fetch(`${musterBaseUrl}/api/agents/${destino.agentId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
        body: JSON.stringify(evento),
      });
      if (res.ok) entregues += 1;
    }
    console.log(`    → ${entregues}/${eventos.length} eventos entregues ao Muster\n`);
  }

  console.log("Pronto. Reavalie o agente no Muster para ver o veredito com esses dados.\n");
}

// Só executa quando chamado direto — permite importar `traduzir` nos testes.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().catch((err) => {
    console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
