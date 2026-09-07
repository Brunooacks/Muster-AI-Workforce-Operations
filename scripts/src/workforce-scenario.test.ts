import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type DemoAgent = {
  nome: string;
  plataforma: string;
  vertical: string;
  comportamento: "saudavel" | "degradando" | "erratico";
  metricas: Array<{ camada: string }>;
};

const scenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "scenarios/workforce-completa.json"), "utf8"),
) as { agentes: DemoAgent[] };

describe("workforce completa demo", () => {
  it("cobre uma frota heterogênea de pelo menos seis profissionais", () => {
    expect(scenario.agentes).toHaveLength(6);
    expect(new Set(scenario.agentes.map((agent) => agent.vertical)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(scenario.agentes.map((agent) => agent.plataforma)).size).toBe(6);
  });

  it("produz estados diferentes para decisões de gestão", () => {
    expect(new Set(scenario.agentes.map((agent) => agent.comportamento))).toEqual(
      new Set(["saudavel", "degradando", "erratico"]),
    );
  });

  it("mede propósito sem reduzir valor a dinheiro", () => {
    for (const agent of scenario.agentes) {
      expect(agent.metricas.some((metric) => metric.camada === "efficacy")).toBe(true);
      expect(agent.metricas.some((metric) => metric.camada === "governance" || metric.camada === "value")).toBe(true);
    }
  });
});
