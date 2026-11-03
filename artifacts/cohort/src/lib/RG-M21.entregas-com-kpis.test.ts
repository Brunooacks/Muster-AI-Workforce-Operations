import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resumirEntregas } from "./entregas-resumo";

// RG-M21: a tela Entregas da área logada mostrava só "N entregas registradas"
// e um botão. Agora ela consolida o resultado de cada agente (aceite, custo
// por entrega aceita, custo humano equivalente) a partir do outcome real.
const ok = <T>(value: T) => ({ status: "ok" as const, value });
function outcome(tasks: number, accepted: number, totalCents: number, humanCents: number, acc: number, auto: number) {
  return {
    layer1: { cost: ok({ tasks, acceptedTasks: accepted, attempts: tasks, totalCost: { cents: totalCents }, costPerValidatedTask: { cents: Math.round(totalCents / accepted) }, humanCostPerTask: { cents: humanCents }, breakEven: { savingsPerTask: { cents: 0 }, savingsPercent: 90 }, breakdown: {} }) },
    layer2: { tasks, acceptanceRate: ok(acc), autoAcceptShare: ok(auto) },
  } as never;
}

describe("RG-M21 Entregas com KPIs", () => {
  it("consolida entregas, aceite, custo por aceita e economia vs humano", () => {
    const r = resumirEntregas([
      { id: "a", nome: "A", papel: "x", outcome: outcome(100, 90, 9000, 2000, 90, 60) },
      { id: "b", nome: "B", papel: "y", outcome: outcome(50, 40, 4000, 1000, 80, 50) },
    ]);
    assert.equal(r.entregas, 150);
    assert.equal(r.aceitas, 130);
    assert.equal(r.custoPorAceitaCents, 100);
    assert.equal(r.custoHumanoEquivalenteCents, 90 * 2000 + 40 * 1000);
    assert.equal(r.economiaCents, 220000 - 13000);
    assert.ok(Math.abs((r.agentes[0]!.taxaAceite as number) - (0.9)) < 1e-9);
    assert.ok(Math.abs((r.aceiteAuto as number) - ((0.6 * 90 + 0.5 * 40) / 130)) < 1e-9);
  });

  it("sem custo-hora não inventa economia", () => {
    const o = outcome(10, 8, 800, 0, 80, 50) as { layer1: { cost: { value: { humanCostPerTask: unknown } } } };
    o.layer1.cost.value.humanCostPerTask = null;
    const r = resumirEntregas([{ id: "a", nome: "A", papel: "x", outcome: o as never }]);
    assert.equal(r.economiaCents, null);
    assert.equal(r.custoHumanoEquivalenteCents, null);
  });

  it("a tela logada usa o resumo e não mostra só a contagem", () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../pages/entregas.tsx"), "utf8");
    assert.ok(src.includes("resumirEntregas"));
    assert.ok(!src.includes("O detalhe de cada entrega, com prova, fica no prontuário de cada agente."));
  });
});
