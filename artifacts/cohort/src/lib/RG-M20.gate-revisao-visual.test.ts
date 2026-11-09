/**
 * RG-M20 (01/11): achados da revisão visual do gate logado (org nova).
 * Cada teste cobre um valor sem sentido, dado de demo ou sobra em inglês
 * que aparecia na área logada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agentesNoMapa, metasDoAgente, posicaoNoMapa } from "./agentes";
import { orcamentoNormalizado } from "./adicionar-agente";
import { leituraOperacional } from "./visao-geral";

const src = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
const lab = src("../pages/workforce-os-lab.tsx");

test("RG-M20: sem metas não vira '0 de 0 metas'", () => {
  assert.equal(metasDoAgente({ metrics: [] } as never).rotulo, "sem metas definidas");
  assert.doesNotMatch(lab, />Cumpre \{metas\.rotulo\}</);
});

test("RG-M20: orçamento com milhar pt-BR (R$ 1.200,50)", () => {
  assert.equal(orcamentoNormalizado("1.200,50"), "1.200,50");
  assert.equal(orcamentoNormalizado("R$ 35000"), "35.000,00");
});

test("RG-M20: mapa sem bolha cortada em 0,0", () => {
  assert.deepEqual(agentesNoMapa([{ monthlyVolume: 0 }, { monthlyVolume: undefined }]), []);
  assert.equal(posicaoNoMapa(0), 8);
  assert.equal(posicaoNoMapa(100), 92);
  assert.match(lab, /O mapa aparece depois das primeiras entregas registradas\./);
});

test("RG-M20: prova sem entregas não mostra '0% … nos 1 profissionais'", () => {
  const l = leituraOperacional({ periodo: "Este mês", agents: [{ id: "a", name: "A", role: "r", evidenceConfidence: 0 }], alertas: [], totalAgents: 1 });
  assert.doesNotMatch(l.prova.nota, /0%|nos 1 profissionais/);
  assert.doesNotMatch(l.custo.aviso ?? "", /Orçamento não definido/);
});

test("RG-M20: Entregas e Pendências logadas não usam dados ilustrativos", () => {
  assert.match(lab, /semApi \? <EntregasScreen \/> : <EntregasOperacional/);
  assert.match(lab, /\(semApi \? <PendenciasScreen \/> : <AlertsPage embedded \/>\)/);
  assert.doesNotMatch(lab, /location === "\/pendencias"/);
  const alerts = src("../pages/alerts.tsx");
  assert.match(alerts, /title: "Pendências"/);
});

test("RG-M20: rótulos pt-BR (sem 'live', 'Org-wide', 'Próxima revisão' trocada, plural)", () => {
  const onb = src("../pages/onboarding.tsx");
  assert.doesNotMatch(onb, /text-primary">live</);
  assert.match(onb, /liveBadge: "ao vivo"/);
  const cfg = src("../pages/configuracoes.tsx");
  assert.match(cfg, /orgWide: "Toda a organização"/);
  assert.match(cfg, /\{nomeOrg \?\? t\.wsNameFallback\}/);
  assert.doesNotMatch(cfg, /text-foreground">Muster<\/span>/);
  assert.match(lab, />Última avaliação</);
  assert.match(lab, /agents\.length === 1 \? "agente" : "agentes"/);
  assert.match(src("../pages/workforce-os-modules.tsx"), /totalEvaluations === 1 \? "avaliação" : "avaliações"/);
});
