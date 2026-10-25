import assert from "node:assert/strict";
import test from "node:test";
import {
  FRICCAO_ILUSTRATIVA,
  ORDEM_ACAO,
  ROTULO_COBERTURA,
  ROTULO_STATUS,
  bulletDaMeta,
  coberturaDoAgente,
  friccaoEmpilhada,
  metasDoAgente,
  motivoDoStatus,
  numeroDe,
  ordenarAgentes,
  statusDoAgente,
} from "./agentes";
import type { WorkforceContractMetric, WorkforceProfessionalAgent } from "./workforce-agent-adapter";

function agente(parcial: Partial<WorkforceProfessionalAgent> = {}): WorkforceProfessionalAgent {
  return {
    id: "sofia",
    initials: "SO",
    name: "Sofia",
    role: "Especialista de Suporte N1",
    team: "Atendimento híbrido",
    purpose: "Resolver solicitações com qualidade.",
    owner: "Patrícia Lima",
    platforms: ["zendesk-ai"],
    status: "critical",
    statusLabel: "Review necessário",
    contractFulfillment: 61,
    operationalHealth: 68,
    responsibilityCoverage: 83,
    evidenceConfidence: 91,
    reviewDue: "Hoje, 14:30",
    reviewUrgency: "42 min",
    volume: "22,1 mil",
    monthlyVolume: 259,
    autonomy: "Supervisionada",
    duties: [],
    responsibilities: [],
    boundaries: [],
    metrics: [
      { label: "Resolução no primeiro contato", baseline: "68%", target: "≥ 75%", current: "61%", status: "off", source: "Zendesk · tickets" },
      { label: "Escalonamento apropriado", baseline: "82%", target: "≥ 80%", current: "86%", status: "on", source: "Auditoria amostral" },
    ],
    diagnosis: "",
    recommendation: "",
    ...parcial,
  };
}

function metra(parcial: Partial<WorkforceContractMetric> = {}): WorkforceContractMetric {
  return {
    label: "Resolução no primeiro contato",
    baseline: "68%",
    target: "≥ 75%",
    current: "61%",
    status: "off",
    source: "Zendesk · tickets",
    ...parcial,
  };
}

test("numeroDe entende porcentagem, razão, tempo e moeda", () => {
  assert.deepEqual(numeroDe("≥ 75%"), { valor: 75, unidade: "%" });
  assert.deepEqual(numeroDe("4,5/5"), { valor: 90, unidade: "%" });
  assert.deepEqual(numeroDe("7 min"), { valor: 7, unidade: "min" });
  assert.deepEqual(numeroDe("R$ 0,24"), { valor: 0.24, unidade: "R$" });
  assert.deepEqual(numeroDe("1.240"), { valor: 1240, unidade: null });
  assert.equal(numeroDe("Meta não definida"), null);
  assert.equal(numeroDe(undefined), null);
});

test("statusDoAgente usa quatro rótulos em linguagem comum", () => {
  assert.equal(statusDoAgente(agente({ contractFulfillment: 61 })), "fora");
  assert.equal(statusDoAgente(agente({ contractFulfillment: 72 })), "atencao");
  assert.equal(statusDoAgente(agente({ contractFulfillment: 91 })), "dentro");
  assert.equal(statusDoAgente(agente({ monthlyVolume: 0 })), "sem-dados");
  assert.equal(statusDoAgente(agente({ monthlyVolume: undefined, contractFulfillment: 72 })), "atencao");
  assert.equal(statusDoAgente(agente({ metrics: [] })), "sem-dados");
  assert.deepEqual(Object.values(ROTULO_STATUS), [
    "Fora do combinado",
    "Precisa de atenção",
    "Sem dados suficientes",
    "Dentro do combinado",
  ]);
});

test("motivoDoStatus explica o status em uma frase com período", () => {
  const metas = [
    metra({ status: "off" }),
    metra({ label: "Reabertura", status: "off" }),
    metra({ label: "Escalonamento", status: "on" }),
    metra({ label: "Evidência", status: "watch" }),
  ];
  assert.equal(
    motivoDoStatus(agente({ contractFulfillment: 61, metrics: metas })),
    "Fora do combinado: 1 de 4 metas cumpridas nos últimos 30 dias.",
  );
  assert.equal(
    motivoDoStatus(agente({ contractFulfillment: 72, metrics: metas.slice(0, 3) })),
    "Precisa de atenção: 2 de 3 metas abaixo do combinado nos últimos 30 dias.",
  );
  assert.equal(
    motivoDoStatus(agente({ contractFulfillment: 91, metrics: metas.map((m) => ({ ...m, status: "on" as const })) })),
    "Dentro do combinado: 4 de 4 metas cumpridas nos últimos 30 dias.",
  );
  assert.equal(
    motivoDoStatus(agente({ monthlyVolume: 0, metrics: [] })),
    "Sem dados suficientes: ainda não há entregas registradas nos últimos 30 dias.",
  );
});

test("coberturaDoAgente classifica aberta, parcial e fechada", () => {
  const metas = [metra(), metra({ label: "Segunda" })];
  assert.equal(coberturaDoAgente(agente({ metrics: metas, observedMetricCount: 2 })), "fechada");
  assert.equal(coberturaDoAgente(agente({ metrics: metas, observedMetricCount: 1 })), "parcial");
  assert.equal(coberturaDoAgente(agente({ metrics: metas, observedMetricCount: 0 })), "aberta");
  assert.equal(coberturaDoAgente(agente({ metrics: [] })), "aberta");
  assert.deepEqual(Object.values(ROTULO_COBERTURA), ["Cobertura aberta", "Cobertura parcial", "Cobertura fechada"]);
});

test("metasDoAgente conta o que foi cumprido", () => {
  const metas = [metra({ status: "on" }), metra({ label: "B", status: "off" }), metra({ label: "C", status: "on" })];
  assert.deepEqual(metasDoAgente(agente({ metrics: metas })), {
    total: 3,
    atingidas: 2,
    rotulo: "2 de 3 metas",
  });
  assert.equal(metasDoAgente(agente({ metrics: [] })).rotulo, "0 de 0 metas");
});

test("bulletDaMeta compara atual, combinado e linha de base", () => {
  const abaixo = bulletDaMeta(metra());
  assert.equal(abaixo.antes, 68);
  assert.equal(abaixo.combinado, 75);
  assert.equal(abaixo.atual, 61);
  assert.equal(abaixo.ok, false);
  assert.equal(abaixo.unidade, "%");

  const inversa = bulletDaMeta(metra({ label: "Reabertura", target: "≤ 15%", current: "24%", status: "off" }));
  assert.equal(inversa.ok, false);
  const dentro = bulletDaMeta(metra({ label: "Escalonamento", target: "≥ 80%", current: "86%", status: "on" }));
  assert.equal(dentro.ok, true);

  const semMeta = bulletDaMeta(metra({ target: "Meta não definida" }));
  assert.equal(semMeta.semMeta, true);
  assert.equal(semMeta.ok, null);
  assert.equal(semMeta.combinadoTexto, "sem meta definida");

  const casos = bulletDaMeta(metra({ casos: 24 }));
  assert.equal(casos.casos, 24);
});

test("friccaoEmpilhada normaliza e soma 100%", () => {
  const segmentos = friccaoEmpilhada([
    { tipo: "Reaberta", quantidade: 24 },
    { tipo: "Refeita", quantidade: 14 },
    { tipo: "Fora do prazo", quantidade: 9 },
    { tipo: "Sem prova", quantidade: 3 },
    { tipo: "Zerado", quantidade: 0 },
  ]);
  assert.equal(segmentos.length, 4);
  assert.equal(segmentos.reduce((soma, item) => soma + item.quantidade, 0), 50);
  assert.equal(segmentos.reduce((soma, item) => soma + item.percentual, 0), 100);
  assert.deepEqual(friccaoEmpilhada([{ tipo: "X", quantidade: 0 }]), []);
});

test("fricção ilustrativa cabe nas entregas do período", () => {
  const total = FRICCAO_ILUSTRATIVA.reduce((soma, item) => soma + item.quantidade, 0);
  assert.equal(total, 50);
  assert.ok(total <= 312);
});

test("ordenarAgentes põe quem precisa de ação primeiro", () => {
  const lista = [
    { status: "dentro" as const, nome: "Vega" },
    { status: "fora" as const, nome: "Dora" },
    { status: "sem-dados" as const, nome: "Novo" },
    { status: "atencao" as const, nome: "Júlia" },
  ];
  assert.deepEqual(
    ordenarAgentes(lista).map((item) => item.nome),
    ["Dora", "Júlia", "Novo", "Vega"],
  );
  assert.deepEqual(ORDEM_ACAO, ["fora", "atencao", "sem-dados", "dentro"]);
});

test("métrica sem meta combinada vira estimado e não conta como meta", () => {
  const semMeta = agente({
    contractFulfillment: 61,
    metrics: [
      { label: "Tempo até a primeira exceção do dia", baseline: "6 h", target: "", current: "4 h", status: "off", source: "ERP · amostra auditada" },
    ],
  });
  assert.deepEqual(metasDoAgente(semMeta), { total: 0, atingidas: 0, rotulo: "0 de 0 metas" });
  assert.equal(statusDoAgente(semMeta), "atencao");
  assert.equal(
    motivoDoStatus(semMeta),
    "Nenhuma meta definida nos últimos 30 dias. Defina metas para medir o combinado.",
  );
  assert.equal(bulletDaMeta(semMeta.metrics[0]!).semMeta, true);

  const misto = agente({
    metrics: [
      ...agente().metrics,
      { label: "Tempo até a primeira exceção do dia", baseline: "6 h", target: "", current: "4 h", status: "off", source: "ERP" },
    ],
  });
  assert.deepEqual(metasDoAgente(misto), { total: 2, atingidas: 1, rotulo: "1 de 2 metas" });
});
