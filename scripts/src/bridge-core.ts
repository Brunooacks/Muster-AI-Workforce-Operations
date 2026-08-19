/**
 * Núcleo comum das pontes de nuvem (coleta *pull*).
 *
 * As três nuvens diferem no como autenticar e no como consultar, mas o resto é
 * idêntico: normalizar a execução, estimar custo pelo modelo, agrupar por agente
 * e entregar ao Muster com a credencial daquele agente. Esse resto vive aqui,
 * para que adicionar um provedor novo seja escrever um adaptador, não um script.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Execução observada, já normalizada — o denominador comum das três nuvens. */
export interface ExecucaoObservada {
  /** Nome do agente na plataforma de origem. */
  agente: string;
  ts: string;
  durationMs: number;
  modelo: string;
  tokensIn: number | null;
  tokensOut: number | null;
  sucesso: boolean;
  /** Identificador do trace na origem — a linhagem que permite auditar depois. */
  traceId: string;
  operacao?: string;
}

export interface EventoMuster {
  kind: "execution" | "error";
  ts: string;
  durationMs: number;
  costCents: number;
  tokensIn?: number;
  tokensOut?: number;
  success: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Preço por mil tokens, em centavos de real. É a única informação que não vem
 * da telemetria — depende do contrato do cliente e deve ser revisada com ele.
 */
export const PRECO_POR_MIL_TOKENS: Record<string, number> = {
  "gpt-4o": 5.0,
  "gpt-4o-mini": 0.6,
  "gpt-4.1": 4.0,
  "gpt-4.1-mini": 0.5,
  "o3-mini": 1.5,
  "phi-4": 0.3,
  "claude-3-5-sonnet": 3.5,
  "claude-3-5-haiku": 0.5,
  "claude-sonnet-4": 3.5,
  "gemini-1.5-pro": 3.5,
  "gemini-1.5-flash": 0.4,
  "gemini-2.0-flash": 0.5,
  "llama-3.1-70b": 0.9,
  "amazon.nova-pro": 2.0,
  "amazon.nova-lite": 0.3,
};
export const PRECO_PADRAO = 1.0;

export function custoEmCentavos(modelo: string, tokensIn: number | null, tokensOut: number | null): number {
  const tokens = (tokensIn ?? 0) + (tokensOut ?? 0);
  if (tokens === 0) return 0;
  // Casamento por prefixo: os provedores versionam o nome do modelo
  // ("gpt-4o-2026-05-13"), e travar no nome exato zeraria o custo em produção.
  const chave = Object.keys(PRECO_POR_MIL_TOKENS).find((k) => modelo.startsWith(k));
  const preco = chave ? PRECO_POR_MIL_TOKENS[chave]! : PRECO_PADRAO;
  return Math.max(1, Math.round((tokens / 1000) * preco));
}

export function traduzir(e: ExecucaoObservada, origem: string): EventoMuster {
  return {
    kind: e.sucesso ? "execution" : "error",
    ts: new Date(e.ts).toISOString(),
    durationMs: Math.round(e.durationMs),
    costCents: custoEmCentavos(e.modelo, e.tokensIn, e.tokensOut),
    ...(e.tokensIn !== null ? { tokensIn: e.tokensIn } : {}),
    ...(e.tokensOut !== null ? { tokensOut: e.tokensOut } : {}),
    success: e.sucesso,
    metadata: {
      origem,
      modelo: e.modelo,
      ...(e.operacao ? { operacao: e.operacao } : {}),
      traceId: e.traceId,
    },
  };
}

export interface DestinoAgente { agentId: string; key?: string }

export function carregarMapa(caminho: string | undefined): Record<string, DestinoAgente> {
  if (!caminho) return {};
  return JSON.parse(readFileSync(resolve(caminho), "utf8")) as Record<string, DestinoAgente>;
}

export function arg(nome: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (hit) return hit.slice(nome.length + 3);
  return process.argv.includes(`--${nome}`) ? "true" : undefined;
}

function brl(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2)}`;
}

/**
 * Agrupa por agente, mostra o resumo e entrega ao Muster. Idêntico nas três
 * nuvens — o adaptador só precisa devolver as execuções observadas.
 */
export async function entregarAoMuster(opcoes: {
  execucoes: ExecucaoObservada[];
  origem: string;
  musterBaseUrl: string;
  mapa: Record<string, DestinoAgente>;
  dryRun: boolean;
}): Promise<void> {
  const { execucoes, origem, musterBaseUrl, mapa, dryRun } = opcoes;

  if (execucoes.length === 0) {
    console.log("Nenhuma execução de agente encontrada na janela.");
    return;
  }

  const porAgente = new Map<string, ExecucaoObservada[]>();
  for (const e of execucoes) {
    const lista = porAgente.get(e.agente) ?? [];
    lista.push(e);
    porAgente.set(e.agente, lista);
  }

  console.log(`${execucoes.length} execuções em ${porAgente.size} agente(s):\n`);

  for (const [agente, itens] of porAgente) {
    const eventos = itens.map((i) => traduzir(i, origem));
    const tokens = eventos.reduce((s, e) => s + (e.tokensIn ?? 0) + (e.tokensOut ?? 0), 0);
    const custo = eventos.reduce((s, e) => s + e.costCents, 0);
    const ok = eventos.filter((e) => e.success).length;
    const modelos = [...new Set(itens.map((i) => i.modelo).filter(Boolean))];

    console.log(`• ${agente}`);
    console.log(`    ${eventos.length} execuções · ${Math.round((ok / eventos.length) * 100)}% sucesso · ${tokens.toLocaleString("pt-BR")} tokens · ${brl(custo)}`);
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

  console.log("Pronto. Reavalie os agentes no Muster para ver o veredito com esses dados.\n");
}
