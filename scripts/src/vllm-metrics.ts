/**
 * Leitura do `/metrics` do vLLM — formato Prometheus.
 *
 * A diferença de fundo em relação às nuvens: a Azure, a AWS e a Google entregam
 * *registros de execução*, uma linha por chamada. O vLLM entrega **agregados** —
 * contadores que só crescem e histogramas acumulados. Não existe "a execução
 * número 41" para ler; existe "já houve 41 execuções desde que o servidor
 * subiu".
 *
 * Isso muda o desenho da coleta e é a razão de este arquivo existir separado do
 * `bridge-core`: em vez de traduzir registros, é preciso guardar a leitura
 * anterior e derivar o que aconteceu na janela por diferença. Um agregado lido
 * uma vez só não diz nada; lido duas, diz tudo o que interessa.
 */

/** Uma série do formato de exposição Prometheus. */
export interface Serie {
  nome: string;
  rotulos: Record<string, string>;
  valor: number;
}

/**
 * Parser do formato de exposição de texto do Prometheus.
 *
 * Deliberadamente pequeno: só o que o vLLM emite. Comentários (`#`) são
 * descartados, os rótulos vêm entre chaves e o valor é o último campo. Vale a
 * pena não depender de biblioteca aqui — o formato é estável e a alternativa
 * seria carregar um cliente Prometheus inteiro para ler oito métricas.
 */
export function parsePrometheus(texto: string): Serie[] {
  const series: Serie[] = [];

  for (const linha of texto.split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;

    const abre = l.indexOf("{");
    let nome: string;
    let rotulos: Record<string, string> = {};
    let resto: string;

    if (abre === -1) {
      const espaco = l.indexOf(" ");
      if (espaco === -1) continue;
      nome = l.slice(0, espaco);
      resto = l.slice(espaco + 1);
    } else {
      const fecha = l.lastIndexOf("}");
      if (fecha === -1) continue;
      nome = l.slice(0, abre);
      rotulos = parseRotulos(l.slice(abre + 1, fecha));
      resto = l.slice(fecha + 1);
    }

    const valor = Number(resto.trim().split(/\s+/)[0]);
    // NaN aparece em `+Inf` de bucket e em séries de info; descartar é correto.
    if (Number.isFinite(valor)) series.push({ nome, rotulos, valor });
  }

  return series;
}

function parseRotulos(trecho: string): Record<string, string> {
  const fora: Record<string, string> = {};
  // Divide por vírgula que não esteja dentro de aspas: nome de modelo com
  // vírgula é raro, mas quebra o parser ingênuo quando acontece.
  const partes = trecho.match(/(\w+)="((?:[^"\\]|\\.)*)"/g) ?? [];
  for (const p of partes) {
    const eq = p.indexOf("=");
    fora[p.slice(0, eq)] = p.slice(eq + 2, -1).replace(/\\"/g, '"');
  }
  return fora;
}

/** Soma uma métrica em todas as suas séries (ignorando a divisão por rótulo). */
export function somar(series: Serie[], nome: string): number {
  return series.filter((s) => s.nome === nome).reduce((t, s) => t + s.valor, 0);
}

/** Primeiro valor de rótulo encontrado para uma métrica — usado para o modelo. */
export function rotulo(series: Serie[], nome: string, chave: string): string | null {
  return series.find((s) => s.nome === nome && s.rotulos[chave])?.rotulos[chave] ?? null;
}

/** Instantâneo dos agregados que interessam. */
export interface Instantaneo {
  ts: number;
  modelo: string;
  /** Requisições concluídas, por motivo de término. */
  concluidas: Record<string, number>;
  totalConcluidas: number;
  latenciaSomaS: number;
  latenciaContagem: number;
  ttftSomaS: number;
  ttftContagem: number;
  tokensPrompt: number;
  tokensGeracao: number;
  /** Instantâneos (gauges): valem por si, não por diferença. */
  emExecucao: number;
  naFila: number;
  usoCacheKv: number;
}

export function lerInstantaneo(texto: string, agora: number): Instantaneo {
  const s = parsePrometheus(texto);

  const concluidas: Record<string, number> = {};
  for (const serie of s.filter((x) => x.nome === "vllm:request_success_total")) {
    const motivo = serie.rotulos.finished_reason ?? "desconhecido";
    concluidas[motivo] = (concluidas[motivo] ?? 0) + serie.valor;
  }

  return {
    ts: agora,
    modelo: rotulo(s, "vllm:request_success_total", "model_name")
      ?? rotulo(s, "vllm:num_requests_running", "model_name")
      ?? "vllm",
    concluidas,
    totalConcluidas: Object.values(concluidas).reduce((t, v) => t + v, 0),
    latenciaSomaS: somar(s, "vllm:e2e_request_latency_seconds_sum"),
    latenciaContagem: somar(s, "vllm:e2e_request_latency_seconds_count"),
    ttftSomaS: somar(s, "vllm:time_to_first_token_seconds_sum"),
    ttftContagem: somar(s, "vllm:time_to_first_token_seconds_count"),
    tokensPrompt: somar(s, "vllm:prompt_tokens_total"),
    tokensGeracao: somar(s, "vllm:generation_tokens_total"),
    emExecucao: somar(s, "vllm:num_requests_running"),
    naFila: somar(s, "vllm:num_requests_waiting"),
    // O nome mudou entre versões do vLLM; aceitar os dois evita ler zero em
    // silêncio num servidor mais antigo, que é o pior resultado possível.
    usoCacheKv: somar(s, "vllm:kv_cache_usage_perc") || somar(s, "vllm:gpu_cache_usage_perc"),
  };
}

/** O que aconteceu entre dois instantâneos. */
export interface Janela {
  execucoes: number;
  falhas: number;
  duracaoMediaMs: number;
  ttftMedioMs: number | null;
  tokensPrompt: number;
  tokensGeracao: number;
  modelo: string;
  emExecucao: number;
  naFila: number;
  usoCacheKv: number;
  /** Verdadeiro quando os contadores regrediram: o servidor reiniciou. */
  reiniciou: boolean;
}

/**
 * Diferença entre dois instantâneos.
 *
 * Dois cuidados que a aritmética ingênua erraria:
 *
 * 1. **Reinício do servidor.** Contador Prometheus zera quando o processo cai.
 *    Uma subtração crua daria número negativo — ou, pior, seria "corrigida" com
 *    Math.max e inventaria uma janela vazia. Aqui o reinício é detectado e
 *    reportado, e a janela é descartada em vez de virar dado falso.
 * 2. **Duração por execução.** O histograma dá soma e contagem, não cada
 *    amostra. A média da janela (Δsoma/Δcontagem) é o melhor estimador honesto —
 *    e é rotulada como derivada nos eventos, para ninguém confundir com medição
 *    individual.
 */
export function diferenca(antes: Instantaneo, depois: Instantaneo): Janela {
  const reiniciou =
    depois.totalConcluidas < antes.totalConcluidas ||
    depois.tokensGeracao < antes.tokensGeracao ||
    depois.latenciaContagem < antes.latenciaContagem;

  const dContagem = depois.latenciaContagem - antes.latenciaContagem;
  const dSoma = depois.latenciaSomaS - antes.latenciaSomaS;
  const dTtftContagem = depois.ttftContagem - antes.ttftContagem;
  const dTtftSoma = depois.ttftSomaS - antes.ttftSomaS;

  // "abort" é a falha observável do lado do servidor; "stop"/"length" são
  // términos normais. Um erro da aplicação que devolveu 200 não aparece aqui —
  // e essa limitação está documentada no cabeçalho da ponte, não escondida.
  const falhas = Math.max(0, (depois.concluidas.abort ?? 0) - (antes.concluidas.abort ?? 0));
  const execucoes = Math.max(0, depois.totalConcluidas - antes.totalConcluidas);

  return {
    execucoes,
    falhas,
    duracaoMediaMs: dContagem > 0 ? Math.round((dSoma / dContagem) * 1000) : 0,
    ttftMedioMs: dTtftContagem > 0 ? Math.round((dTtftSoma / dTtftContagem) * 1000) : null,
    tokensPrompt: Math.max(0, depois.tokensPrompt - antes.tokensPrompt),
    tokensGeracao: Math.max(0, depois.tokensGeracao - antes.tokensGeracao),
    modelo: depois.modelo,
    emExecucao: depois.emExecucao,
    naFila: depois.naFila,
    usoCacheKv: depois.usoCacheKv,
    reiniciou,
  };
}
