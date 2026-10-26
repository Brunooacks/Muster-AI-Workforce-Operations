import { describe, expect, it } from "vitest";
import { contractInputProblems, type ContractInput } from "./agent-contract-input";

const HOJE = "2026-10-25";
const valido: ContractInput = {
  metricKey: "custo_por_tarefa_aceita",
  unit: "BRL",
  direction: "down",
  baseline: 12.5,
  target: 8,
  deadline: "2026-12-31",
  ownerMemberId: "mem_1",
  referenceHumanMinutes: 18,
};

describe("contractInputProblems", () => {
  it("contrato completo é válido", () => {
    expect(contractInputProblems(valido, HOJE)).toEqual([]);
  });

  it("baseline e target precisam ser números (string do business case não passa)", () => {
    const problemas = contractInputProblems(
      { ...valido, baseline: "R$ 12" as unknown as number, target: Number.NaN },
      HOJE,
    );
    expect(problemas).toEqual(["baseline precisa ser numérico.", "target precisa ser numérico."]);
  });

  it("deadline hoje ou no passado é recusada; formato precisa ser YYYY-MM-DD", () => {
    expect(contractInputProblems({ ...valido, deadline: HOJE }, HOJE)).toEqual(["deadline precisa ser futura."]);
    expect(contractInputProblems({ ...valido, deadline: "31/12/2026" }, HOJE)).toEqual([
      "deadline deve ser uma data YYYY-MM-DD.",
    ]);
  });

  it("dono é obrigatório e minutos de referência não podem ser negativos", () => {
    expect(contractInputProblems({ ...valido, ownerMemberId: " ", referenceHumanMinutes: -1 }, HOJE)).toEqual([
      "Dono (ownerMemberId) é obrigatório.",
      "referenceHumanMinutes precisa ser um número ≥ 0.",
    ]);
  });
});
