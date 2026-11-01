/**
 * RG-M12 (01/11): logado, /admissao abria a página antiga de 7 etapas
 * ("Cadastrar nova agente"); as 4 etapas só existiam no demo e não gravavam.
 * Agora a tela logada é a de 4 etapas e o POST /api/agents segue o contrato
 * existente (CreateAgentBody), sem campo novo no banco.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CreateAgentBody } from "../../../../lib/api-zod/src/index";
import { FORM_VAZIO, montarPayloadAgente, telaDeAdmissao } from "./adicionar-agente";

const form = {
  ...FORM_VAZIO,
  nome: " Sofia ",
  funcao: "Resolve tickets de primeira resposta",
  plataforma: "zendesk-ai",
  responsavel: "Patrícia Lima",
  entregaPronta: "Ticket resolvido sem reabertura em 72 h",
  comoConfirma: "Status no Zendesk e nota do cliente",
  orcamento: "R$ 1.200,50",
  naoPode: "Dar reembolso\nPrometer prazo",
  chamaHumano: "Cliente pede cancelamento",
};

test("RG-M12: logado abre as 4 etapas; completa só com conector/?completa=1", () => {
  assert.equal(telaDeAdmissao(false, "", false), "quatro-etapas");
  assert.equal(telaDeAdmissao(true, "", false), "quatro-etapas");
  assert.equal(telaDeAdmissao(false, "?connectorId=c1", false), "completa");
  assert.equal(telaDeAdmissao(false, "?completa=1", false), "completa");
  assert.equal(telaDeAdmissao(false, "", true), "completa");
});

test("RG-M12: payload passa no contrato do POST /api/agents", () => {
  const payload = montarPayloadAgente(form);
  const parsed = CreateAgentBody.parse(payload);
  assert.equal(parsed.name, "Sofia");
  assert.equal(parsed.role, form.funcao);
  assert.equal(parsed.platform, "zendesk-ai");
  assert.equal(parsed.bio, form.funcao);
  assert.equal(parsed.businessOwner, "Patrícia Lima");
  assert.deepEqual(parsed.shouldNotDo, ["Dar reembolso", "Prometer prazo"]);
  assert.deepEqual(parsed.limits, ["Orçamento mensal: R$ 1200,50"]);
  assert.equal(parsed.autonomyLevel, "escalates");
  assert.match(parsed.autonomyNotes ?? "", /cancelamento/);
  assert.match(parsed.businessCaseDescription ?? "", /Entrega pronta: Ticket resolvido/);
});

test("RG-M12: opcionais vazios não viram campo", () => {
  const p = montarPayloadAgente({ ...form, responsavel: "", naoPode: "", chamaHumano: "", comoConfirma: "" });
  CreateAgentBody.parse(p);
  assert.equal("businessOwner" in p, false);
  assert.equal("shouldNotDo" in p, false);
  assert.equal("autonomyNotes" in p, false);
});

test("RG-M12: tela logada usa a escolha e grava via useCreateAgent", () => {
  const lab = readFileSync(new URL("../pages/workforce-os-lab.tsx", import.meta.url), "utf8");
  assert.match(lab, /telaDeAdmissao\(semApi, window\.location\.search, hasPendingAdmissionHandoff\(\)\) === "completa" \? <AdmissionPage embedded \/> : <AdicionarAgenteScreen operacional=\{!semApi\} \/>/);
  const tela = readFileSync(new URL("../pages/adicionar-agente.tsx", import.meta.url), "utf8");
  assert.match(tela, /useCreateAgent\(\)/);
  assert.match(tela, /data: montarPayloadAgente\(form\)/);
  assert.match(tela, /\/agentes\/\$\{res\.agent\.id\}\/conectar/);
});
