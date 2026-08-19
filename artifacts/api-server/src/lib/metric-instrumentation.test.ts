import { describe, expect, it } from "vitest";
import { instrumentacaoPara, resumirEsforco } from "./metric-instrumentation";
import { METRIC_CATALOG } from "./metric-catalog";

const m = (label: string, extra: Partial<Parameters<typeof instrumentacaoPara>[0]> = {}) => ({
  key: label.toLowerCase().replace(/\s+/g, "_"),
  label,
  unit: "%",
  target: "≥ 90%",
  layer: "efficacy" as const,
  ...extra,
});

describe("instrumentacaoPara", () => {
  it("reconhece o que a telemetria já captura, e não pede trabalho à toa", () => {
    for (const label of [
      "Taxa de sucesso", "Tempo de resposta", "Latência p95",
      "Custo por execução", "Taxa de erro", "Escalonamento", "Execuções por dia",
    ]) {
      const r = instrumentacaoPara(m(label));
      expect(r.forma, label).toBe("automatica");
      expect(r.snippets[0]!.codigo).toContain("trackExecution");
    }
  });

  it("propõe campo no evento quando o agente sabe a resposta ao fim da tarefa", () => {
    const r = instrumentacaoPara(m("Resolução no primeiro contato"));
    expect(r.forma).toBe("metadata");
    expect(r.campo).toBe("metadata.resolvidoNoPrimeiroContato");
    // o snippet precisa citar o campo, senão não serve para copiar e colar
    expect(r.snippets.some((s) => s.codigo.includes("resolvidoNoPrimeiroContato"))).toBe(true);
    expect(r.snippets.some((s) => s.linguagem === "typescript")).toBe(true);
  });

  it("cai para evidência quando o número vive fora do agente", () => {
    const r = instrumentacaoPara(m("Receita influenciada", { unit: "R$", target: "≥ 100" }));
    expect(r.forma).toBe("evidencia");
    expect(r.snippets.some((s) => s.codigo.includes("/api/evidence"))).toBe(true);
    // linhagem e amostra não são opcionais no discurso: são o que sustenta auditoria
    expect(r.requisitos.some((x) => /lineage/i.test(x))).toBe(true);
    expect(r.requisitos.some((x) => /sampleSize/i.test(x))).toBe(true);
  });

  it("o corpo da observação carrega a chave e a unidade da métrica", () => {
    const r = instrumentacaoPara(m("Churn evitado", { key: "churn_evitado", unit: "pp", target: "≥ +2pp" }));
    const json = r.snippets.find((s) => s.linguagem === "json")!.codigo;
    expect(json).toContain('"metricKey": "churn_evitado"');
    expect(json).toContain('"unit": "pp"');
    expect(json).toContain('"kind": "observed"');
  });

  it("toda métrica recebe alguma instrução — nenhuma fica órfã", () => {
    const todas = METRIC_CATALOG.flatMap((v) => v.metrics);
    expect(todas.length).toBeGreaterThan(50);
    for (const metrica of todas) {
      const r = instrumentacaoPara(metrica);
      expect(r.snippets.length, metrica.label).toBeGreaterThan(0);
      expect(r.resumo.length, metrica.label).toBeGreaterThan(10);
      expect(r.requisitos.length, metrica.label).toBeGreaterThan(0);
    }
  });
});

describe("resumirEsforco", () => {
  it("mostra quanto trabalho um conjunto de métricas dá", () => {
    const r = resumirEsforco([
      m("Taxa de sucesso"),
      m("Tempo de resposta"),
      m("Resolução no primeiro contato"),
      m("Receita influenciada"),
    ]);
    expect(r).toEqual({ automatica: 2, metadata: 1, evidencia: 1 });
  });

  it("o catálogo real tem métricas das três formas", () => {
    const r = resumirEsforco(METRIC_CATALOG.flatMap((v) => v.metrics));
    expect(r.automatica).toBeGreaterThan(0);
    expect(r.metadata).toBeGreaterThan(0);
    expect(r.evidencia).toBeGreaterThan(0);
  });
});
