/**
 * Ponte vLLM — coleta de agentes que rodam localmente (on-premise).
 *
 * O caso que ela resolve: o agente roda na infraestrutura do cliente, atrás do
 * firewall, servido por vLLM. Não há nuvem para consultar e, muitas vezes, não
 * há como mexer no código do agente para instrumentá-lo. Mas o vLLM já publica
 * um `/metrics` no formato Prometheus, e é dele que se extrai o que o Muster
 * precisa. Nenhuma alteração no agente, nenhum sidecar.
 *
 * ── O que esta ponte vê, e o que não vê ────────────────────────────────────
 *
 * VÊ: quantas requisições terminaram, latência ponta a ponta, tempo até o
 * primeiro token, tokens de entrada e saída, fila e uso de cache KV.
 *
 * NÃO VÊ: o conteúdo dos prompts e das respostas — o `/metrics` simplesmente
 * não os expõe. Isso é uma vantagem, não uma limitação: a coleta é
 * estruturalmente incapaz de vazar o que foi conversado, então não depende de
 * ninguém lembrar de desligar um flag.
 *
 * NÃO VÊ TAMBÉM, e isto é uma limitação de verdade: **erro de aplicação**. Se o
 * agente devolveu uma resposta errada, ou tomou a decisão errada, para o vLLM a
 * requisição terminou com sucesso. Esta ponte mede a saúde da *inferência*, não
 * a eficácia do agente. Para eficácia é preciso que o agente reporte o desfecho
 * — SDK ou REST, como qualquer outro. A ponte cobre eficiência e adoção; a
 * camada de eficácia continua dependendo de evidência que só o agente tem.
 *
 * ── Por que amostrar, e não ler uma vez ────────────────────────────────────
 *
 * O `/metrics` é agregado e acumulado: contadores que só crescem. Uma leitura
 * isolada não diz o que aconteceu — diz o que já aconteceu desde que o servidor
 * subiu. Por isso a ponte amostra em intervalo e trabalha por diferença. A
 * primeira leitura nunca vira evento: ela é a linha de base.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run bridge:vllm -- --agent-id=<id> --key=<msk_...>
 *   pnpm --filter @workspace/scripts run bridge:vllm -- --fixture --dry-run
 *
 * Parâmetros:
 *   --endpoint=   URL do /metrics do vLLM (padrão http://localhost:8000/metrics)
 *   --agent-id=   agente no Muster que representa este serviço
 *   --key=        credencial do agente (ou MUSTER_AGENT_KEY)
 *   --intervalo=  segundos entre amostras (padrão 30)
 *   --ciclos=     quantas amostras coletar; 0 = indefinidamente (padrão 0)
 *   --dry-run     mostra o que enviaria, sem enviar
 *   --fixture     lê de scripts/fixtures/vllm-metrics*.txt em vez da rede
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { arg } from "./bridge-core";
import { diferenca, lerInstantaneo, type Instantaneo, type Janela } from "./vllm-metrics";

const endpoint = arg("endpoint") ?? process.env.VLLM_METRICS_URL ?? "http://localhost:8000/metrics";
const musterBaseUrl = (arg("muster-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");
const agentId = arg("agent-id") ?? process.env.MUSTER_AGENT_ID;
const chave = arg("key") ?? process.env.MUSTER_AGENT_KEY;
const intervaloS = Number(arg("intervalo") ?? 30);
const ciclos = Number(arg("ciclos") ?? 0);
const dryRun = arg("dry-run") === "true";
const usarFixture = arg("fixture") === "true";

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Preço por mil tokens em centavos. Local não é grátis: GPU tem custo por hora,
 *  e o cliente precisa informar o rateio dele. O padrão é conservador. */
const PRECO_LOCAL_POR_MIL_TOKENS = Number(arg("preco") ?? process.env.VLLM_PRECO_MIL_TOKENS ?? 0.15);

let passoFixture = 0;

async function lerMetrics(): Promise<string> {
  if (usarFixture) {
    // Duas fixtures em sequência simulam a passagem do tempo: sem a segunda,
    // não haveria diferença alguma para derivar.
    const nome = passoFixture === 0 ? "vllm-metrics-t0.txt" : "vllm-metrics-t1.txt";
    passoFixture += 1;
    return readFileSync(resolve(import.meta.dirname, "..", "fixtures", nome), "utf8");
  }
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}`);
  return res.text();
}

/**
 * Traduz a janela em eventos do Muster.
 *
 * Uma decisão que vale explicar: emite-se **um evento por requisição concluída**,
 * todos com a duração média da janela, e não um único evento agregado. O motivo
 * é que a plataforma conta execuções para calcular volume, taxa de sucesso e
 * custo por execução — um evento agregado distorceria as três. Em compensação,
 * cada evento carrega `derivacao: "media-da-janela"` no metadata, para que
 * ninguém leia a duração como medição individual. O número é honesto sobre o
 * que é.
 */
function eventosDaJanela(j: Janela): Array<Record<string, unknown>> {
  if (j.execucoes === 0) return [];

  const tokensInPorExec = Math.round(j.tokensPrompt / j.execucoes);
  const tokensOutPorExec = Math.round(j.tokensGeracao / j.execucoes);
  const custoPorExec = Math.max(
    0,
    Math.round(((tokensInPorExec + tokensOutPorExec) / 1000) * PRECO_LOCAL_POR_MIL_TOKENS),
  );

  const agora = new Date().toISOString();
  const eventos: Array<Record<string, unknown>> = [];

  for (let i = 0; i < j.execucoes; i += 1) {
    const falhou = i < j.falhas;
    eventos.push({
      kind: falhou ? "error" : "execution",
      ts: agora,
      success: !falhou,
      durationMs: j.duracaoMediaMs,
      costCents: custoPorExec,
      tokensIn: tokensInPorExec,
      tokensOut: tokensOutPorExec,
      metadata: {
        origem: "vllm-local",
        modelo: j.modelo,
        derivacao: "media-da-janela",
        ...(j.ttftMedioMs !== null ? { ttftMedioMs: j.ttftMedioMs } : {}),
        filaNoMomento: j.naFila,
        usoCacheKv: Number(j.usoCacheKv.toFixed(3)),
      },
    });
  }
  return eventos;
}

async function entregar(eventos: Array<Record<string, unknown>>): Promise<number> {
  if (!agentId || !chave) return 0;
  let ok = 0;
  for (const evento of eventos) {
    const res = await fetch(`${musterBaseUrl}/api/agents/${agentId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify(evento),
    }).catch(() => null);
    if (res?.ok) ok += 1;
  }
  return ok;
}

function resumo(j: Janela): string {
  const partes = [
    `${j.execucoes} execuções`,
    `${j.duracaoMediaMs} ms média`,
    j.ttftMedioMs !== null ? `${j.ttftMedioMs} ms até o 1º token` : null,
    `${(j.tokensPrompt + j.tokensGeracao).toLocaleString("pt-BR")} tokens`,
    `fila ${j.naFila}`,
    `cache KV ${Math.round(j.usoCacheKv * 100)}%`,
  ].filter(Boolean);
  return partes.join(" · ");
}

async function main(): Promise<void> {
  console.log(`\n\x1b[1m▸ Ponte vLLM — coleta local\x1b[0m`);
  console.log(`  Origem:  ${usarFixture ? "fixture (offline)" : endpoint}`);
  console.log(`  Destino: ${agentId ? `${musterBaseUrl} · agente ${agentId}` : "\x1b[33m(não informado — apenas leitura)\x1b[0m"}`);
  console.log(`  Amostra a cada ${intervaloS}s${ciclos > 0 ? ` · ${ciclos} ciclos` : " · até interromper (Ctrl+C)"}\n`);

  if (!usarFixture && !dryRun && (!agentId || !chave)) {
    console.log(`\x1b[33m⚠ Sem --agent-id e --key os dados são apenas exibidos, não enviados.`);
    console.log(`  Emita a credencial em POST /api/agents/<id>/api-keys\x1b[0m\n`);
  }

  let anterior: Instantaneo | null = null;
  let ciclo = 0;

  for (;;) {
    let texto: string;
    try {
      texto = await lerMetrics();
    } catch (err) {
      console.log(`  \x1b[31m✖ ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
      if (ciclos > 0 && ++ciclo >= ciclos) break;
      await pausa(intervaloS * 1000);
      continue;
    }

    const atual = lerInstantaneo(texto, Date.now());

    if (anterior === null) {
      // A primeira leitura é linha de base, nunca evento: os contadores trazem
      // tudo o que já aconteceu desde que o servidor subiu, e mandá-los ao
      // Muster criaria um pico falso de milhares de execuções no minuto zero.
      console.log(`  linha de base · modelo ${atual.modelo} · ${atual.totalConcluidas} execuções acumuladas no servidor`);
      console.log(`  \x1b[2mA partir daqui, só o que acontecer de novo vira evento.\x1b[0m\n`);
      anterior = atual;
      if (ciclos > 0 && ++ciclo >= ciclos) break;
      await pausa(intervaloS * 1000);
      continue;
    }

    const j = diferenca(anterior, atual);
    anterior = atual;

    const hora = new Date().toLocaleTimeString("pt-BR");

    if (j.reiniciou) {
      // Contador que regride significa processo reiniciado. Descartar a janela é
      // o único tratamento honesto: qualquer conta feita sobre ela seria ficção.
      console.log(`  ${hora}  \x1b[33mservidor reiniciou — janela descartada\x1b[0m`);
    } else if (j.execucoes === 0) {
      console.log(`  ${hora}  \x1b[2msem execuções nova janela · fila ${j.naFila}\x1b[0m`);
    } else {
      const eventos = eventosDaJanela(j);
      if (dryRun || !agentId || !chave) {
        console.log(`  ${hora}  ${resumo(j)}  \x1b[2m→ ${eventos.length} eventos (não enviados)\x1b[0m`);
      } else {
        const ok = await entregar(eventos);
        console.log(`  ${hora}  ${resumo(j)}  \x1b[32m→ ${ok}/${eventos.length} entregues\x1b[0m`);
      }
    }

    if (ciclos > 0 && ++ciclo >= ciclos) break;
    await pausa(intervaloS * 1000);
  }

  if (agentId && !dryRun) {
    console.log(`\n  Reavalie o agente para ver o veredito com esses dados:`);
    console.log(`  POST ${musterBaseUrl}/api/agents/${agentId}/reevaluate\n`);
  } else {
    console.log("");
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
