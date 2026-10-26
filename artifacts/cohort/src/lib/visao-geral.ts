import { formatBRL, formatNumero } from "./calculadora";

/**
 * Visão geral (T6 · referencias §1 "A narrativa: uma pergunta por bloco").
 * Um único modelo de leitura alimenta a tela: número grande + frase de
 * resposta na abertura, blocos 1 a 5 na ordem e os gráficos de custo,
 * tarefa × resultado e matriz custo × resultado.
 *
 * Com dados reais (operational) o número vem da API; sem dado, a tela diz
 * isso em vez de mostrar 0. Com dados de demonstração a tela carrega o
 * selo "Dados ilustrativos".
 */

export const PERIODOS = ["Este mês", "Mês passado", "Últimos 90 dias"] as const;
export type Periodo = (typeof PERIODOS)[number];

export type StatusEntrega = "Aceita" | "Rejeitada" | "Aguardando";

export type EntregaResumo = {
  id: string;
  descricao: string;
  agente: string;
  data: string;
  status: StatusEntrega;
  prova: string | null;
};

export type AcaoRecomendada = {
  id: string;
  agente: string;
  motivo: string;
  acao: string;
  responsavel: string;
  prazo: string;
  bloco: string;
};

export type ComentarioPercepcao = {
  autor: string;
  nota: number;
  texto: string;
};

export type Quadrante = "Ampliar" | "Corrigir" | "Observar" | "Desligar";

export type PontoMatriz = {
  nome: string;
  custo: number;
  resultado: number;
};

export type LeituraVisaoGeral = {
  periodo: Periodo;
  rotuloPeriodo: string;
  numero: { valor: string; rotulo: string };
  frase: string;
  entregas: {
    total: number | null;
    aceitas: number | null;
    ultimas: EntregaResumo[];
    vazio?: string;
  };
  prova: {
    comProva: number | null;
    aceitas: number | null;
    percentual: number | null;
    nota: string;
    vazio?: string;
  };
  custo: {
    gasto: number | null;
    orcamento: number | null;
    percentual: number | null;
    porEntrega: number | null;
    meta: number | null;
    custoHumano: number | null;
    serie: Array<{ periodo: string; valor: number }>;
    aviso?: string;
  };
  percepcao: {
    nota: number | null;
    respostas: number | null;
    desgostos: number | null;
    comentarios: ComentarioPercepcao[];
    vazio?: string;
  };
  acoes: AcaoRecomendada[];
  tarefaResultado: {
    noPrazo: number | null;
    metaPrazo: number;
    resultado: number | null;
    metaResultado: number;
    vazio?: string;
  };
  matriz: PontoMatriz[];
  eixoCusto: string;
  eixoResultado: string;
  matrizVazia?: string;
};

export const ROTULOS_PERIODO: Record<Periodo, string> = {
  "Este mês": "out/26",
  "Mês passado": "set/26",
  "Últimos 90 dias": "últimos 90 dias",
};

/** Custo por entrega aceita: gasto do período ÷ entregas aceitas (glossário §4). */
export function custoPorEntrega(gasto: number | null | undefined, aceitas: number | null | undefined): number | null {
  if (gasto == null || aceitas == null || !Number.isFinite(gasto) || !Number.isFinite(aceitas) || aceitas <= 0) return null;
  return gasto / aceitas;
}

/**
 * Quadrante da matriz custo × resultado.
 * Ampliar: custo baixo e resultado alto · Corrigir: os dois altos ·
 * Observar: os dois baixos · Desligar: custo alto e resultado baixo.
 */
export function classificarQuadrante(
  custo: number,
  resultado: number,
  linhaCusto: number,
  linhaResultado: number,
): Quadrante {
  const caro = custo > linhaCusto;
  const fraco = resultado < linhaResultado;
  if (!caro && !fraco) return "Ampliar";
  if (caro && !fraco) return "Corrigir";
  if (!caro && fraco) return "Observar";
  return "Desligar";
}

/**
 * Posição de um valor no gráfico, com a linha de corte em 50%.
 * Abaixo da linha o valor cresce até o centro; acima, até a borda.
 */
export function posicaoRelativa(valor: number, linha: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(linha) || linha <= 0) return 50;
  if (valor <= linha) return Math.max(4, Math.min(48, (valor / linha) * 50));
  return Math.min(96, 50 + ((valor - linha) / linha) * 50);
}

export type AgenteVisao = {
  id: string;
  name: string;
  role: string;
  monthlyVolume?: number;
  monthlyCost?: number;
  evidenceConfidence?: number;
  contractFulfillment?: number;
};

export type AlertaVisao = {
  id: string;
  agentName: string;
  pattern: string;
  recommendation: string;
  assignedTo?: string | null;
  dueAt?: string | null;
};

function soma(lista: number[]): number {
  return lista.reduce((total, valor) => total + valor, 0);
}

function media(lista: number[]): number | null {
  const validos = lista.filter((valor) => Number.isFinite(valor));
  if (validos.length === 0) return null;
  return soma(validos) / validos.length;
}

function prazoDe(dueAt?: string | null): string {
  if (!dueAt) return "sem prazo";
  const data = new Date(dueAt);
  if (Number.isNaN(data.getTime())) return "sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(data);
}

/** Linha de corte da matriz: mediana do custo e do resultado observados. */
export function linhaDaMatriz(pontos: PontoMatriz[]): { custo: number; resultado: number } {
  if (pontos.length === 0) return { custo: 1, resultado: 50 };
  const custos = pontos.map((ponto) => ponto.custo).sort((a, b) => a - b);
  const resultados = pontos.map((ponto) => ponto.resultado).sort((a, b) => a - b);
  const meio = Math.floor(pontos.length / 2);
  const mediana = (valores: number[]) =>
    pontos.length % 2 === 0 ? (valores[meio - 1]! + valores[meio]!) / 2 : valores[meio]!;
  return { custo: mediana(custos) || 1, resultado: mediana(resultados) || 50 };
}

/** Leitura com dados reais da API: o que existe vira número, o resto diz que não tem dado. */
export function leituraOperacional(opcoes: {
  periodo: Periodo;
  agents?: AgenteVisao[];
  alertas?: AlertaVisao[];
  totalAgents?: number;
  saudeMedia?: number;
  alertasAtivos?: number;
}): LeituraVisaoGeral {
  const { periodo } = opcoes;
  const agents = opcoes.agents ?? [];
  const alertas = opcoes.alertas ?? [];
  const volume = soma(agents.map((agente) => agente.monthlyVolume ?? 0));
  const gasto = soma(agents.map((agente) => agente.monthlyCost ?? 0));
  const temVolume = volume > 0;
  const confianca = media(agents.map((agente) => agente.evidenceConfidence ?? Number.NaN));
  const pontos: PontoMatriz[] = agents
    .filter((agente) => (agente.monthlyVolume ?? 0) > 0 && agente.contractFulfillment != null)
    .map((agente) => ({
      nome: agente.name,
      custo: (agente.monthlyCost ?? 0) / (agente.monthlyVolume ?? 1),
      resultado: agente.contractFulfillment ?? 0,
    }));
  const acoes: AcaoRecomendada[] = alertas.slice(0, 3).map((alerta) => ({
    id: alerta.id,
    agente: alerta.agentName,
    motivo: alerta.pattern,
    acao: alerta.recommendation,
    responsavel: alerta.assignedTo ?? "sem responsável",
    prazo: prazoDe(alerta.dueAt),
    bloco: "pendência aberta",
  }));
  const numero = temVolume
    ? { valor: formatNumero(volume), rotulo: `entregas registradas · ${ROTULOS_PERIODO[periodo]}` }
    : { valor: "—", rotulo: `entregas registradas · ${ROTULOS_PERIODO[periodo]}` };
  const frase = temVolume
    ? `${agents.length} profissionais registraram ${formatNumero(volume)} entregas e gastaram ${formatBRL(gasto)} no período. A prova e a aceitação por entrega ainda não estão consolidadas por período.`
    : `Ainda não há entregas registradas por período. ${opcoes.totalAgents ?? 0} profissionais monitorados${opcoes.saudeMedia != null ? `, saúde média de ${Math.round(opcoes.saudeMedia)}%` : ""}.`;

  return {
    periodo,
    rotuloPeriodo: ROTULOS_PERIODO[periodo],
    numero,
    frase,
    entregas: {
      total: temVolume ? volume : null,
      aceitas: null,
      ultimas: [],
      vazio: "As últimas entregas aparecem aqui quando o agente registrar a tarefa com task_id e a origem do pedido.",
    },
    prova: {
      comProva: null,
      aceitas: null,
      percentual: null,
      nota: confianca != null
        ? `Média de ${Math.round(confianca)}% de confiança da prova nos ${agents.length} profissionais`
        : "Sem prova consolidada no período",
      vazio: "A contagem de entregas com prova verificável por período chega quando a aceitação for registrada em cada entrega.",
    },
    custo: {
      gasto: gasto > 0 ? gasto : null,
      orcamento: null,
      percentual: null,
      porEntrega: custoPorEntrega(gasto > 0 ? gasto : null, temVolume ? volume : null),
      meta: null,
      custoHumano: null,
      serie: [],
      aviso: "Orçamento não definido. Defina o orçamento mensal na etapa 3 de Adicionar agente.",
    },
    percepcao: {
      nota: null,
      respostas: null,
      desgostos: null,
      comentarios: [],
      vazio: "Sem respostas ainda. Peça o 👍👎 de quem recebe a entrega para medir a percepção no período.",
    },
    acoes,
    tarefaResultado: {
      noPrazo: null,
      metaPrazo: 95,
      resultado: null,
      metaResultado: 75,
      vazio: "A comparação entre tarefa no prazo e resultado aceito exige tarefas com prazo e task_id registrados.",
    },
    matriz: pontos,
    eixoCusto: "custo por entrega",
    eixoResultado: "resultado combinado",
    matrizVazia: pontos.length > 0 ? undefined : "Sem dados suficientes para posicionar os agentes na matriz.",
  };
}

const ENTREGAS_DEMO: EntregaResumo[] = [
  { id: "e-2418", descricao: "Ticket #48217 reclassificado e respondido", agente: "Sofia · Atendimento N1", data: "out 24", status: "Aceita", prova: "zendesk · 14:32" },
  { id: "e-2417", descricao: "Reembolso de R$ 320 aprovado dentro do limite", agente: "Sofia · Atendimento N1", data: "out 24", status: "Aceita", prova: "zendesk · 11:08" },
  { id: "e-2416", descricao: "Conciliação de 320 transações fechada", agente: "Dora · Conciliação", data: "out 23", status: "Aceita", prova: "hubspot · 17:45" },
  { id: "e-2413", descricao: "Cobrança duplicada gerada por erro de dados", agente: "Sofia · Atendimento N1", data: "out 22", status: "Rejeitada", prova: "zendesk · 10:11" },
  { id: "e-2412", descricao: "Relatório semanal consolidado", agente: "Téo · Revisão", data: "out 22", status: "Aguardando", prova: null },
];

const COMENTARIOS_DEMO: ComentarioPercepcao[] = [
  { autor: "Patrícia · Cobrança", nota: 5, texto: "Entrou certo na primeira, poupou a revisão de sempre." },
  { autor: "Marcos · Operações", nota: 3, texto: "Resolveu rápido, mas devolveu a exceção sem o motivo." },
  { autor: "Ana · Suporte", nota: 4, texto: "Bom no volume. Precisa melhorar o resumo do que mudou." },
];

const DEMO_POR_PERIODO: Record<Periodo, {
  total: number;
  aceitas: number;
  comProva: number;
  gasto: number;
  orcamento: number;
  porEntrega: number;
  nota: number;
  respostas: number;
  desgostos: number;
  noPrazo: number;
  resultado: number;
  serie: Array<{ periodo: string; valor: number }>;
  acoes: AcaoRecomendada[];
}> = {
  "Este mês": {
    total: 312,
    aceitas: 287,
    comProva: 276,
    gasto: 68.9,
    orcamento: 96,
    porEntrega: 0.24,
    nota: 4.1,
    respostas: 38,
    desgostos: 6,
    noPrazo: 98,
    resultado: 61,
    serie: [
      { periodo: "mai", valor: 0.31 },
      { periodo: "jun", valor: 0.3 },
      { periodo: "jul", valor: 0.28 },
      { periodo: "ago", valor: 0.27 },
      { periodo: "set", valor: 0.25 },
      { periodo: "out", valor: 0.24 },
    ],
    acoes: [
      { id: "a-1", agente: "Sofia · Atendimento N1", motivo: "24% das entregas do período foram reabertas", acao: "Revisar a base de cobrança da Sofia", responsavel: "Patrícia", prazo: "sex 30", bloco: "bloco 1 · Entregas" },
      { id: "a-2", agente: "Dora · Conciliação", motivo: "custo por entrega em R$ 0,41, acima da meta de R$ 0,30", acao: "Reduzir o escopo das exceções", responsavel: "Marcos", prazo: "04/11", bloco: "bloco 3 · Custo" },
      { id: "a-3", agente: "Téo · Revisão", motivo: "6 👎 no período, todos por resumo incompleto", acao: "Pedir o exemplo do que faltou", responsavel: "Ana", prazo: "amanhã", bloco: "bloco 4 · Percepção" },
    ],
  },
  "Mês passado": {
    total: 274,
    aceitas: 249,
    comProva: 231,
    gasto: 64.2,
    orcamento: 96,
    porEntrega: 0.26,
    nota: 4,
    respostas: 31,
    desgostos: 5,
    noPrazo: 96,
    resultado: 58,
    serie: [
      { periodo: "abr", valor: 0.34 },
      { periodo: "mai", valor: 0.33 },
      { periodo: "jun", valor: 0.31 },
      { periodo: "jul", valor: 0.3 },
      { periodo: "ago", valor: 0.28 },
      { periodo: "set", valor: 0.26 },
    ],
    acoes: [
      { id: "a-1", agente: "Dora · Conciliação", motivo: "custo por entrega em R$ 0,44, acima da meta de R$ 0,30", acao: "Reduzir o escopo das exceções", responsavel: "Marcos", prazo: "encerrado", bloco: "bloco 3 · Custo" },
      { id: "a-2", agente: "Sofia · Atendimento N1", motivo: "18% das entregas foram reabertas em 72 h", acao: "Revisar a base de conhecimento", responsavel: "Patrícia", prazo: "encerrado", bloco: "bloco 1 · Entregas" },
    ],
  },
  "Últimos 90 dias": {
    total: 861,
    aceitas: 793,
    comProva: 752,
    gasto: 196.4,
    orcamento: 288,
    porEntrega: 0.25,
    nota: 4.1,
    respostas: 104,
    desgostos: 17,
    noPrazo: 97,
    resultado: 60,
    serie: [
      { periodo: "mai", valor: 0.31 },
      { periodo: "jun", valor: 0.3 },
      { periodo: "jul", valor: 0.28 },
      { periodo: "ago", valor: 0.27 },
      { periodo: "set", valor: 0.25 },
      { periodo: "out", valor: 0.24 },
    ],
    acoes: [
      { id: "a-1", agente: "Sofia · Atendimento N1", motivo: "24% das entregas do período foram reabertas", acao: "Revisar a base de cobrança da Sofia", responsavel: "Patrícia", prazo: "sex 30", bloco: "bloco 1 · Entregas" },
      { id: "a-2", agente: "Dora · Conciliação", motivo: "custo por entrega em R$ 0,41, acima da meta de R$ 0,30", acao: "Reduzir o escopo das exceções", responsavel: "Marcos", prazo: "04/11", bloco: "bloco 3 · Custo" },
      { id: "a-3", agente: "Téo · Revisão", motivo: "17 👍 e 17 👎 no período, nota média 4,1", acao: "Padronizar o resumo do que mudou", responsavel: "Ana", prazo: "06/11", bloco: "bloco 4 · Percepção" },
    ],
  },
};

const MATRIZ_DEMO: PontoMatriz[] = [
  { nome: "Sofia", custo: 0.21, resultado: 86 },
  { nome: "Dora", custo: 0.41, resultado: 82 },
  { nome: "Téo", custo: 0.26, resultado: 58 },
  { nome: "Vega", custo: 0.44, resultado: 54 },
];

/** Leitura de demonstração: sempre com selo "Dados ilustrativos" na tela. */
export function leituraIlustrativa(periodo: Periodo): LeituraVisaoGeral {
  const dados = DEMO_POR_PERIODO[periodo];
  const percentual = Math.round((dados.comProva / dados.aceitas) * 100);
  const usado = Math.round((dados.gasto / dados.orcamento) * 100);

  return {
    periodo,
    rotuloPeriodo: ROTULOS_PERIODO[periodo],
    numero: {
      valor: formatNumero(dados.aceitas),
      rotulo: `entregas aceitas · ${ROTULOS_PERIODO[periodo]}`,
    },
    frase: `${dados.aceitas} das ${dados.total} entregas do período foram aceitas e ${dados.comProva} delas têm prova verificável. Cada entrega aceita custou ${formatBRL(dados.porEntrega)}, dentro da meta de ${formatBRL(0.3)}.`,
    entregas: {
      total: dados.total,
      aceitas: dados.aceitas,
      ultimas: ENTREGAS_DEMO.slice(0, 5),
    },
    prova: {
      comProva: dados.comProva,
      aceitas: dados.aceitas,
      percentual,
      nota: `${percentual}% das entregas aceitas têm origem, fonte e horário conferíveis`,
    },
    custo: {
      gasto: dados.gasto,
      orcamento: dados.orcamento,
      percentual: usado,
      porEntrega: dados.porEntrega,
      meta: 0.3,
      custoHumano: 1.8,
      serie: dados.serie,
    },
    percepcao: {
      nota: dados.nota,
      respostas: dados.respostas,
      desgostos: dados.desgostos,
      comentarios: COMENTARIOS_DEMO.slice(0, 3),
    },
    acoes: dados.acoes,
    tarefaResultado: {
      noPrazo: dados.noPrazo,
      metaPrazo: 95,
      resultado: dados.resultado,
      metaResultado: 75,
    },
    matriz: MATRIZ_DEMO,
    eixoCusto: "custo por entrega",
    eixoResultado: "resultado combinado",
  };
}
