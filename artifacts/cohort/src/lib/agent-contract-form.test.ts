import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_CONTRACT_FORM,
  contractBodyFromForm,
  contractFormErrors,
  formFromContract,
  parseDecimal,
} from "./agent-contract-form";

const HOJE = "2026-10-25";
const preenchido = {
  ...EMPTY_CONTRACT_FORM,
  metricKey: "custo_por_tarefa_aceita",
  unit: "BRL",
  baseline: "12,50",
  target: "8",
  deadline: "2026-12-31",
  ownerMemberId: "mem_1",
  referenceHumanMinutes: "18",
};

test("decimal aceita vírgula e milhar; texto vira NaN; vazio vira null", () => {
  assert.equal(parseDecimal("12,5"), 12.5);
  assert.equal(parseDecimal("1.234,5"), 1234.5);
  assert.equal(parseDecimal("8"), 8);
  assert.equal(parseDecimal(""), null);
  assert.ok(Number.isNaN(parseDecimal("R$ 12") as number));
});

test("formulário completo não tem erro e gera corpo numérico", () => {
  assert.deepEqual(contractFormErrors(preenchido, HOJE), {});
  assert.deepEqual(contractBodyFromForm(preenchido), {
    metricKey: "custo_por_tarefa_aceita",
    unit: "BRL",
    direction: "down",
    baseline: 12.5,
    target: 8,
    limit: null,
    deadline: "2026-12-31",
    ownerMemberId: "mem_1",
    referenceHumanMinutes: 18,
    requireHumanAccept: false,
    referenceModel: null,
  });
});

test("string do business case, deadline passada e sem dono são erros", () => {
  const erros = contractFormErrors({ ...preenchido, baseline: "3 meses", deadline: HOJE, ownerMemberId: "" }, HOJE);
  assert.deepEqual(erros, { baseline: "número", deadline: "futura", ownerMemberId: "obrigatório" });
});

test("nova versão parte da vigente, mas pede deadline de novo", () => {
  const form = formFromContract({ ...contractBodyFromForm(preenchido), limit: 20 });
  assert.equal(form.baseline, "12.5");
  assert.equal(form.limit, "20");
  assert.equal(form.deadline, "");
});
