/**
 * Simulador de cenário — admite a frota descrita num arquivo JSON, emite uma
 * credencial para cada agente, reporta telemetria COM essa credencial e mostra
 * o veredito resultante.
 *
 * Serve para enquadrar o Muster no cenário de quem está avaliando: em vez de
 * olhar a frota de demonstração, a pessoa descreve os próprios agentes em
 * `scripts/scenarios/*.json` e vê a plataforma avaliá-los.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run demo -- --cenario=suporte-tecnico
 *   pnpm --filter @workspace/scripts run demo -- --arquivo=/caminho/meu.json --dias=30
 *   pnpm --filter @workspace/scripts run demo -- --limpar
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createMusterReporter, type AgentEvent } from "@workspace/telemetry-reporter";
import { requireMusterSessionToken } from "./muster-session";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENARIO_DIR = resolve(HERE, "..", "scenarios");
const PREFIXO = "[cenário]";

type Comportamento = "saudavel" | "degradando" | "erratico";

interface MetricaCenario {
  camada: string;
  label: string;
  unidade: string;
  meta: string;
}

interface AgenteCenario {
  nome: string;
  papel: string;
  plataforma: string;
  vertical?: string;
  comportamento: Comportamento;
  execucoesPorDia?: number;
  custoPorExecucaoCentavos?: number;
  deveFazer?: string[];
  naoDeveFazer?: string[];
  metricas?: MetricaCenario[];
}

interface Cenario {
  cenario: string;
  descricao?: string;
  agentes: AgenteCenario[];
}

/** Curvas de comportamento: o que separa um agente que merece promoção de um
 *  que precisa ser aposentado. Determinístico por agente, para a demo ser
 *  reproduzível diante do cliente. */
const CURVAS: Record<Comportamento, {
  sucessoInicio: number; sucessoFim: number;
  latenciaMs: [number, number]; erroPorDia: [number, number]; escalacaoPorDia: [number, number];
  rotulo: string;
}> = {
  saudavel:   { sucessoInicio: 0.97, sucessoFim: 0.98, latenciaMs: [500, 1200],   erroPorDia: [0, 1],  escalacaoPorDia: [0, 1], rotulo: "estável" },
  degradando: { sucessoInicio: 0.94, sucessoFim: 0.58, latenciaMs: [900, 4500],   erroPorDia: [1, 5],  escalacaoPorDia: [2, 6], rotulo: "em degradação" },
  erratico:   { sucessoInicio: 0.48, sucessoFim: 0.34, latenciaMs: [2500, 14000], erroPorDia: [6, 14], escalacaoPorDia: [5, 12], rotulo: "instável" },
};

function arg(nome: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (hit) return hit.slice(nome.length + 3);
  return process.argv.includes(`--${nome}`) ? "true" : undefined;
}

const baseUrl = (arg("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");
const dias = Number(arg("dias") ?? 30);
const sessionToken = requireMusterSessionToken();

// RNG determinístico: a mesma demo produz os mesmos números.
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${sessionToken}`,
      ...init?.headers,
    },
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${texto.slice(0, 300)}`);
  }
  return (texto ? JSON.parse(texto) : undefined) as T;
}

function carregarCenario(): Cenario {
  const arquivo = arg("arquivo");
  const nome = arg("cenario") ?? "suporte-tecnico";
  const caminho = arquivo ? resolve(arquivo) : resolve(SCENARIO_DIR, `${nome}.json`);
  if (!existsSync(caminho)) {
    throw new Error(
      `Cenário não encontrado: ${caminho}\n` +
        `Crie um arquivo em ${SCENARIO_DIR} ou aponte com --arquivo=/caminho/meu.json`,
    );
  }
  return JSON.parse(readFileSync(caminho, "utf8")) as Cenario;
}

function payloadAdmissao(a: AgenteCenario) {
  const valorInicial = a.comportamento === "saudavel" ? 97 : a.comportamento === "degradando" ? 72 : 38;
  return {
    name: `${PREFIXO} ${a.nome}`,
    role: a.papel,
    platform: a.plataforma,
    version: "1.0.0",
    bio: `${a.papel}. Agente do cenário "${a.vertical ?? "geral"}" simulado para avaliação.`,
    tagline: a.papel,
    shouldDo: a.deveFazer ?? ["Executar as tarefas do papel declarado"],
    shouldNotDo: a.naoDeveFazer ?? ["Executar ação irreversível sem aprovação humana"],
    autonomyLevel: "escalates",
    autonomyNotes: "Decisão final permanece humana durante a avaliação.",
    limits: ["Dados do cenário de demonstração"],
    businessOwner: "Dono de negócio (a definir)",
    technicalOwner: "Dono técnico (a definir)",
    governanceSponsor: "Comitê de governança",
    baseline: `${dias} dias de execuções observadas antes da decisão.`,
    targetPayback: "A definir com o time de negócio",
    businessCaseDescription: `Avaliar ${a.nome} sob produtividade e propósito.`,
    proposedMetrics: (a.metricas ?? []).map((m) => ({
      layer: m.camada,
      label: m.label,
      unit: m.unidade,
      target: m.meta,
      value: valorInicial,
    })),
  };
}

function gerarEventos(a: AgenteCenario, semente: number): AgentEvent[] {
  const curva = CURVAS[a.comportamento];
  const rng = mulberry32(semente);
  const faixa = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const eventos: AgentEvent[] = [];
  const agora = Date.now();
  const porDia = a.execucoesPorDia ?? 40;
  const custo = (a.custoPorExecucaoCentavos ?? 5) * (a.comportamento === "erratico" ? 2.2 : 1);

  for (let dia = dias - 1; dia >= 0; dia -= 1) {
    const progresso = dias <= 1 ? 1 : (dias - 1 - dia) / (dias - 1);
    const inicioDia = agora - dia * 86_400_000;
    const pSucesso = curva.sucessoInicio + (curva.sucessoFim - curva.sucessoInicio) * progresso;
    // Amostra o volume diário para não gerar milhares de eventos numa demo.
    const execucoes = Math.max(3, Math.round(Math.min(porDia, 25) * faixa(0.8, 1.2)));

    for (let i = 0; i < execucoes; i += 1) {
      const alongamento = 1 + progresso * (a.comportamento === "degradando" ? 1.4 : 0);
      eventos.push({
        kind: "execution",
        ts: new Date(inicioDia - faixa(0, 20) * 3_600_000),
        success: rng() < pSucesso,
        durationMs: Math.round(faixa(...curva.latenciaMs) * alongamento),
        costCents: Math.max(1, Math.round(custo * faixa(0.7, 1.4))),
        tokensIn: Math.round(faixa(600, 3000)),
        tokensOut: Math.round(faixa(200, 1200)),
        metadata: { cenario: true, comportamento: a.comportamento },
      });
    }
    for (let i = 0; i < Math.round(faixa(...curva.erroPorDia) * (0.5 + progresso)); i += 1) {
      eventos.push({
        kind: "error",
        ts: new Date(inicioDia - faixa(0, 20) * 3_600_000),
        durationMs: Math.round(faixa(500, 4000)),
        costCents: Math.max(1, Math.round(custo * 0.6)),
        metadata: { cenario: true, motivo: "falha de execução" },
      });
    }
    for (let i = 0; i < Math.round(faixa(...curva.escalacaoPorDia) * (0.5 + progresso)); i += 1) {
      eventos.push({
        kind: "escalation",
        ts: new Date(inicioDia - faixa(0, 20) * 3_600_000),
        metadata: { cenario: true, motivo: "fora da alçada" },
      });
    }
  }
  return eventos;
}

interface AgentSummary { id: string; name: string }

async function limparFrotaDoCenario(): Promise<number> {
  const agentes = await api<AgentSummary[]>("/agents");
  const alvo = agentes.filter((a) => a.name.startsWith(PREFIXO));
  let removidos = 0;
  for (const a of alvo) {
    try {
      await api(`/agents/${encodeURIComponent(a.id)}`, { method: "DELETE" });
      removidos += 1;
    } catch {
      // Sem rota de exclusão: seguimos, a frota do cenário é reconhecível pelo prefixo.
    }
  }
  return removidos;
}

function tabela(linhas: Array<Record<string, string>>): string {
  if (linhas.length === 0) return "(vazio)";
  const colunas = Object.keys(linhas[0]!);
  const largura = colunas.map((c) => Math.max(c.length, ...linhas.map((l) => String(l[c] ?? "").length)));
  const linha = (vals: string[]) => vals.map((v, i) => v.padEnd(largura[i]!)).join("  ");
  return [linha(colunas), linha(largura.map((w) => "─".repeat(w))), ...linhas.map((l) => linha(colunas.map((c) => String(l[c] ?? ""))))].join("\n");
}

async function main(): Promise<void> {
  if (arg("limpar")) {
    const n = await limparFrotaDoCenario();
    console.log(`Frota do cenário removida: ${n} agente(s).`);
    return;
  }

  const cenario = carregarCenario();
  console.log(`\n▸ Cenário: ${cenario.cenario}`);
  if (cenario.descricao) console.log(`  ${cenario.descricao}`);
  console.log(`  API: ${baseUrl} · janela: ${dias} dias · agentes: ${cenario.agentes.length}\n`);

  const resultados: Array<Record<string, string>> = [];
  const frotaAtual = await api<AgentSummary[]>("/agents");

  for (const [indice, agente] of cenario.agentes.entries()) {
    process.stdout.write(`• ${agente.nome} (${CURVAS[agente.comportamento].rotulo})… `);

    // 1. Admitir — a carteira de trabalho nasce aqui. Reaproveita o agente com
    //    o mesmo nome, para que ensaiar a demo duas vezes não encha a frota de
    //    duplicatas.
    const nomeCompleto = `${PREFIXO} ${agente.nome}`;
    const existente = frotaAtual.find((a) => a.name === nomeCompleto);
    const agentId = existente
      ? existente.id
      : (await api<{ agent: { id: string } }>("/agents", {
          method: "POST",
          body: JSON.stringify(payloadAdmissao(agente)),
        })).agent.id;

    // 2. Emitir credencial própria: o agente reporta com a chave dele, não com
    //    a sessão do humano. Este é o caminho real de produção.
    const credencial = await api<{ plaintext: string }>(
      `/agents/${encodeURIComponent(agentId)}/api-keys`,
      { method: "POST", body: JSON.stringify({ label: "demo-cenario" }) },
    );

    // 3. Reportar telemetria autenticada como o agente.
    const reporter = createMusterReporter({
      baseUrl,
      agentId,
      token: credencial.plaintext,
      onError: (e) => console.error(`\n  ! falha ao reportar: ${String(e).slice(0, 120)}`),
    });
    const eventos = gerarEventos(agente, 7000 + indice * 13);
    const entregues = await reporter.reportMany(eventos);

    // 4. Reavaliar a partir do que foi de fato executado.
    const veredito = await api<{
      verdict: string; healthScore: number; dataSource: string; rationale: string;
    }>(`/agents/${encodeURIComponent(agentId)}/reevaluate`, { method: "POST", body: "{}" });

    console.log(`${entregues} eventos → ${veredito.verdict.toUpperCase()} (saúde ${veredito.healthScore})`);
    resultados.push({
      Agente: agente.nome,
      Comportamento: CURVAS[agente.comportamento].rotulo,
      Eventos: String(entregues),
      Saúde: String(veredito.healthScore),
      Veredito: veredito.verdict,
      Fonte: veredito.dataSource,
    });
  }

  console.log(`\n${tabela(resultados)}\n`);
  console.log("Abra a frota no Muster para ver carteira, camadas e o plano de ação de cada agente.");
  console.log("Para limpar depois:  pnpm --filter @workspace/scripts run demo -- --limpar\n");
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
