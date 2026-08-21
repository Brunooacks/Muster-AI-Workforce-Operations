import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { diferenca, lerInstantaneo, parsePrometheus, somar } from "./vllm-metrics";

/**
 * O risco desta ponte não é falhar — é acertar o formato e errar a conta. Um
 * contador lido como instantâneo, um reinício tratado como queda de volume, uma
 * média calculada sobre a soma errada: nada disso lança exceção. Vira número
 * plausível na tela, e alguém decide aposentar um agente com base nele.
 *
 * Por isso os testes aqui checam aritmética, não ausência de erro.
 */

const fixture = (nome: string) =>
  readFileSync(resolve(import.meta.dirname, "..", "fixtures", nome), "utf8");

describe("parser do formato Prometheus", () => {
  const texto = fixture("vllm-metrics-t0.txt");

  it("ignora comentários e lê nome, rótulos e valor", () => {
    const series = parsePrometheus(texto);
    expect(series.some((s) => s.nome.startsWith("#"))).toBe(false);

    const running = series.find((s) => s.nome === "vllm:num_requests_running");
    expect(running?.valor).toBe(2);
    expect(running?.rotulos.model_name).toBe("meta-llama/Llama-3.1-8B-Instruct");
  });

  it("soma as séries de uma métrica separadas por rótulo", () => {
    // request_success_total vem quebrado em stop/length/abort: ler só a primeira
    // subestimaria o volume, que é justamente o número que interessa.
    expect(somar(parsePrometheus(texto), "vllm:request_success_total")).toBe(1180 + 64 + 9);
  });

  it("descarta valores não finitos dos buckets +Inf sem perder as demais séries", () => {
    const series = parsePrometheus('m{le="+Inf"} NaN\nm_count{} 7.0\n');
    expect(series).toHaveLength(1);
    expect(series[0]!.valor).toBe(7);
  });

  it("lê métrica sem rótulo algum", () => {
    const series = parsePrometheus("sem_rotulo 3.5\n");
    expect(series[0]).toMatchObject({ nome: "sem_rotulo", valor: 3.5, rotulos: {} });
  });
});

describe("instantâneo", () => {
  it("extrai os agregados que a ponte usa", () => {
    const i = lerInstantaneo(fixture("vllm-metrics-t0.txt"), 1000);
    expect(i.modelo).toBe("meta-llama/Llama-3.1-8B-Instruct");
    expect(i.totalConcluidas).toBe(1253);
    expect(i.latenciaContagem).toBe(1253);
    expect(i.tokensGeracao).toBe(498_300);
    expect(i.emExecucao).toBe(2);
    expect(i.usoCacheKv).toBeCloseTo(0.41);
  });
});

describe("diferença entre duas amostras", () => {
  const antes = lerInstantaneo(fixture("vllm-metrics-t0.txt"), 0);
  const depois = lerInstantaneo(fixture("vllm-metrics-t1.txt"), 30_000);
  const j = diferenca(antes, depois);

  it("conta apenas as execuções novas, não o acumulado do servidor", () => {
    // 1302 - 1253. Se a ponte enviasse o acumulado, o Muster registraria 1302
    // execuções num intervalo de 30 segundos.
    expect(j.execucoes).toBe(49);
  });

  it("deriva a duração média da janela, não a média histórica", () => {
    // (2853.1 - 2731.4) / (1302 - 1253) = 2.4837s
    expect(j.duracaoMediaMs).toBe(2484);
    // A média histórica seria 2853.1/1302 = 2191ms — otimista, porque dilui a
    // piora recente em toda a vida do servidor. É exatamente o erro que a
    // diferença evita.
    expect(j.duracaoMediaMs).toBeGreaterThan(Math.round((depois.latenciaSomaS / depois.latenciaContagem) * 1000));
  });

  it("conta abortos como falha da janela", () => {
    expect(j.falhas).toBe(2);
  });

  it("usa os gauges como instantâneo, sem subtrair", () => {
    // Fila é estado do momento: 3 na fila agora, e não "3 a mais que antes".
    expect(j.naFila).toBe(3);
    expect(j.emExecucao).toBe(5);
  });

  it("apura os tokens da janela", () => {
    expect(j.tokensPrompt).toBe(1_910_400 - 1_842_000);
    expect(j.tokensGeracao).toBe(517_950 - 498_300);
  });

  it("não sinaliza reinício em operação normal", () => {
    expect(j.reiniciou).toBe(false);
  });
});

describe("reinício do servidor", () => {
  it("é detectado quando os contadores regridem", () => {
    // vLLM reiniciado zera os contadores. Sem esta detecção, a subtração daria
    // negativo e um Math.max ingênuo esconderia o problema numa janela vazia —
    // a frota pareceria ociosa quando na verdade a coleta perdeu a referência.
    const antes = lerInstantaneo(fixture("vllm-metrics-t1.txt"), 0);
    const depois = lerInstantaneo(fixture("vllm-metrics-t0.txt"), 30_000);
    expect(diferenca(antes, depois).reiniciou).toBe(true);
  });
});

describe("servidor ocioso", () => {
  it("produz janela vazia em vez de evento inventado", () => {
    const i = lerInstantaneo(fixture("vllm-metrics-t0.txt"), 0);
    const j = diferenca(i, i);
    expect(j.execucoes).toBe(0);
    expect(j.duracaoMediaMs).toBe(0);
    expect(j.reiniciou).toBe(false);
  });
});
