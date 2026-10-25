import type { WorkforceContractMetric, WorkforceProfessionalAgent } from "./workforce-agent-adapter";

/**
 * Agentes e Entregas (T7): status em linguagem comum, selo de cobertura
 * (aberta/parcial/fechada), metas com bullet chart contra a linha de base,
 * fricção empilhada por tipo e ordenação "precisa de ação primeiro".
 * Tudo puro: a tela só formata o que sai daqui.
 */

export type StatusAgente = "fora" | "atencao" | "sem-dados" | "dentro";

export const ROTULO_STATUS: Record<StatusAgente, string> = {
  fora: "Fora do combinado",
  atencao: "Precisa de atenção",
  "sem-dados": "Sem dados suficientes",
  dentro: "Dentro do combinado",
};

/** Quem precisa de ação vem primeiro na lista de agentes. */
export const ORDEM_ACAO: StatusAgente[] = ["fora", "atencao", "sem-dados", "dentro"];

export type Cobertura = "aberta" | "parcial" | "fechada";

export const ROTULO_COBERTURA: Record<Cobertura, string> = {
  aberta: "Cobertura aberta",
  parcial: "Cobertura parcial",
  fechada: "Cobertura fechada",
};

export const TEXTO_COBERTURA: Record<Cobertura, string> = {
  aberta: "nenhuma meta com prova registrada no período",
  parcial: "parte das metas tem prova registrada no período",
  fechada: "todas as metas têm prova registrada no período",
};

export type Faltando = "fora" | "atencao" | "dentro";

/** Extrai um número de texto de meta ("≥ 75%", "4,5/5", "7 min", "R$ 0,24"). */
export function numeroDe(valor: string | null | undefined): { valor: number; unidade: string | null } | null {
  if (!valor) return null;
  const texto = valor.trim();
  const razao = texto.match(/^([0-9]+(?:[.,][0-9]+)?)\s*\/\s*([0-9]+)/);
  if (razao) {
    const atual = Number(razao[1]!.replace(",", "."));
    const total = Number(razao[2]!.replace(",", "."));
    if (!Number.isFinite(atual) || !Number.isFinite(total) || total === 0) return null;
    return { valor: (atual / total) * 100, unidade: "%" };
  }
  const limpo = texto.replace(/^(?:≥|≤|>|<|>=|<=)\s*/, "");
  const percentual = limpo.match(/^([0-9]+(?:[.,][0-9]+)?)\s*%/);
  if (percentual) return { valor: Number(percentual[1]!.replace(",", ".")), unidade: "%" };
  const tempo = limpo.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(min|s|h|hora|horas|dia|dias)$/i);
  if (tempo) return { valor: Number(tempo[1]!.replace(",", ".")), unidade: tempo[2]!.toLowerCase() };
  const moeda = limpo.match(/^R\$\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (moeda) return { valor: Number(moeda[1]!.replace(".", "").replace(",", ".")), unidade: "R$" };
  if (/^\d{1,3}(?:\.\d{3})+$/.test(limpo)) {
    return { valor: Number(limpo.replace(/\./g, "")), unidade: null };
  }
  const puro = limpo.match(/^([0-9]+(?:[.,][0-9]+)?)$/);
  if (puro) return { valor: Number(puro[1]!.replace(",", ".")), unidade: null };
  return null;
}

/** Métrica sem meta combinada é estimado: não entra no denominador de metas. */
export function temMetaDefinida(metric: Pick<WorkforceContractMetric, "target">): boolean {
  return Boolean(metric.target) && metric.target !== "Meta não definida";
}

function metasContadas(agent: Pick<WorkforceProfessionalAgent, "metrics">) {
  const alvo = agent.metrics.filter(temMetaDefinida);
  return { total: alvo.length, atingidas: alvo.filter((metric) => metric.status === "on").length };
}

export function statusDoAgente(
  agent: Pick<WorkforceProfessionalAgent, "contractFulfillment" | "metrics" | "monthlyVolume">,
): StatusAgente {
  const { total } = metasContadas(agent);
  const semVolume = agent.monthlyVolume !== undefined && agent.monthlyVolume <= 0;
  if (agent.metrics.length === 0 || semVolume) return "sem-dados";
  if (total === 0) return "atencao";
  if (agent.contractFulfillment < 70) return "fora";
  if (agent.contractFulfillment < 85) return "atencao";
  return "dentro";
}

/** Frase de uma linha que explica o status, como pede a referência da tela. */
export function motivoDoStatus(agent: WorkforceProfessionalAgent): string {
  const status = statusDoAgente(agent);
  const { total, atingidas } = metasContadas(agent);
  if (status === "sem-dados") {
    return "Sem dados suficientes: ainda não há entregas registradas nos últimos 30 dias.";
  }
  if (total === 0) {
    return "Nenhuma meta definida nos últimos 30 dias. Defina metas para medir o combinado.";
  }
  if (status === "dentro") {
    return `Dentro do combinado: ${atingidas} de ${total} metas cumpridas nos últimos 30 dias.`;
  }
  if (status === "atencao") {
    return `Precisa de atenção: ${total - atingidas} de ${total} metas abaixo do combinado nos últimos 30 dias.`;
  }
  return `Fora do combinado: ${atingidas} de ${total} metas cumpridas nos últimos 30 dias.`;
}

export function coberturaDoAgente(
  agent: Pick<WorkforceProfessionalAgent, "metrics" | "observedMetricCount">,
): Cobertura {
  const total = agent.metrics.length;
  if (total === 0) return "aberta";
  if (typeof agent.observedMetricCount === "number") {
    if (agent.observedMetricCount >= total) return "fechada";
    return agent.observedMetricCount > 0 ? "parcial" : "aberta";
  }
  const marcadas = agent.metrics.filter((metric) => metric.observed !== undefined);
  if (marcadas.length === 0) return "fechada";
  const observadas = marcadas.filter((metric) => metric.observed).length;
  if (observadas >= total) return "fechada";
  return observadas > 0 ? "parcial" : "aberta";
}

export function metasDoAgente(agent: Pick<WorkforceProfessionalAgent, "metrics">) {
  const { total, atingidas } = metasContadas(agent);
  return { total, atingidas, rotulo: `${atingidas} de ${total} ${total === 1 ? "meta" : "metas"}` };
}

export type BulletMeta = {
  rotulo: string;
  fonte: string;
  antes: number | null;
  combinado: number | null;
  atual: number | null;
  combinadoTexto: string;
  atualTexto: string;
  unidade: string | null;
  ok: boolean | null;
  casos: number | null;
  semMeta: boolean;
};

/** Bullet chart de uma meta: qualidade hoje contra a linha de base e o combinado. */
export function bulletDaMeta(metric: WorkforceContractMetric): BulletMeta {
  const antes = numeroDe(metric.baseline);
  const combinado = numeroDe(metric.target);
  const atual = numeroDe(metric.current);
  const semMeta = !metric.target || metric.target === "Meta não definida";
  const unidade = atual?.unidade ?? combinado?.unidade ?? antes?.unidade ?? null;
  const metaNumerica = combinado?.valor ?? null;
  const ok = metaNumerica == null || atual?.valor == null
    ? null
    : /≤|</.test(metric.target)
      ? atual.valor <= metaNumerica
      : atual.valor >= metaNumerica;

  return {
    rotulo: metric.label,
    fonte: metric.source,
    antes: antes?.valor ?? null,
    combinado: metaNumerica,
    atual: atual?.valor ?? null,
    combinadoTexto: semMeta ? "sem meta definida" : metric.target,
    atualTexto: metric.current,
    unidade,
    ok,
    casos: metric.casos ?? null,
    semMeta,
  };
}

export type SegmentoFriccao = {
  tipo: string;
  quantidade: number;
  percentual: number;
};

/** Fricção empilhada por tipo: normaliza, remove tipos zerados e soma 100%. */
export function friccaoEmpilhada(
  segmentos: Array<{ tipo: string; quantidade: number }>,
): SegmentoFriccao[] {
  const validos = segmentos.filter((segmento) => segmento.quantidade > 0);
  const total = validos.reduce((soma, segmento) => soma + segmento.quantidade, 0);
  if (total === 0) return [];
  let resto = 100;
  return validos.map((segmento, index) => {
    const ultimo = index === validos.length - 1;
    const percentual = ultimo ? resto : Math.round((segmento.quantidade / total) * 100);
    resto -= percentual;
    return { tipo: segmento.tipo, quantidade: segmento.quantidade, percentual };
  });
}

/** Dados ilustrativos da fricção no período (312 entregas do mês, 50 com atrito). */
export const FRICCAO_ILUSTRATIVA: Array<{ tipo: string; quantidade: number }> = [
  { tipo: "Reaberta em até 72 h", quantidade: 24 },
  { tipo: "Refeita por uma pessoa", quantidade: 14 },
  { tipo: "Entregue fora do prazo", quantidade: 9 },
  { tipo: "Aceita sem prova anexada", quantidade: 3 },
];

export function ordenarAgentes<T extends { status: StatusAgente }>(linhas: T[]): T[] {
  return [...linhas].sort((a, b) => ORDEM_ACAO.indexOf(a.status) - ORDEM_ACAO.indexOf(b.status));
}
