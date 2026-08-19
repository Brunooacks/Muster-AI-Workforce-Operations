import type { LayerKey } from "@workspace/db";

/**
 * Do catálogo à captura (gauntlet rodada 6).
 *
 * Declarar uma métrica é fácil; capturá-la é onde as plataformas de governança
 * costumam terminar em promessa. Este módulo fecha o elo: dada uma métrica do
 * catálogo, diz **como** aquele número chega ao Muster e entrega o trecho de
 * código pronto — sem ninguém precisar ler o contrato e adivinhar.
 *
 * Três formas de captura, em ordem de esforço:
 *   · automatica — já vem do evento de execução. Nada a fazer.
 *   · metadata   — o agente acrescenta um campo ao evento que já envia.
 *   · evidencia  — o número vive num sistema de registro (CRM, Zendesk,
 *                  warehouse) e é publicado como observação com linhagem.
 */

export type FormaDeCaptura = "automatica" | "metadata" | "evidencia";

export interface MetricaParaInstrumentar {
  key: string;
  label: string;
  unit: string;
  target: string;
  layer: LayerKey;
}

export interface Instrumentacao {
  forma: FormaDeCaptura;
  /** Frase que explica, em uma linha, de onde o número vem. */
  resumo: string;
  /** Campo do evento ou da observação que carrega o valor. */
  campo: string;
  snippets: Array<{ titulo: string; linguagem: "bash" | "typescript" | "json"; codigo: string }>;
  /** O que precisa estar verdadeiro para o número ser aceito na avaliação. */
  requisitos: string[];
}

/**
 * Sinais que o evento de execução já carrega. Uma métrica que se resolve por
 * um destes não precisa de integração nenhuma — e dizer isso evita trabalho
 * inútil, que é metade do valor desta função.
 */
const SINAIS_AUTOMATICOS: Array<{ padrao: RegExp; campo: string; explicacao: string }> = [
  { padrao: /taxa de sucesso|tarefas conclu|sucesso da etapa/i, campo: "success",
    explicacao: "razão entre execuções bem-sucedidas e o total, no evento de execução" },
  { padrao: /taxa de erro|falha/i, campo: "kind: \"error\"",
    explicacao: "contagem de eventos do tipo erro sobre o total de execuções" },
  { padrao: /tempo de resposta|latência|duração/i, campo: "durationMs",
    explicacao: "duração informada em cada execução, agregada em média e p95" },
  { padrao: /custo por execu|custo por atendimento|custo total|cpe/i, campo: "costCents",
    explicacao: "custo informado por execução, somado na janela" },
  { padrao: /token/i, campo: "tokensIn / tokensOut",
    explicacao: "contagem de tokens informada por execução" },
  { padrao: /escalonamento|escalação|escalada/i, campo: "kind: \"escalation\"",
    explicacao: "contagem de eventos de escalonamento sobre o total de execuções" },
  { padrao: /execuç(ões|oes) por dia|chamadas processadas|atendimentos por dia|volume processado/i,
    campo: "contagem de eventos", explicacao: "número de execuções dividido pelos dias da janela" },
  { padrao: /disponibilidade|uptime/i, campo: "heartbeat",
    explicacao: "batimento reportado pelo runtime do agente" },
];

/**
 * Métricas que são um desfecho binário por execução: o agente já sabe a
 * resposta no fim da tarefa, então basta acrescentar um campo ao evento que ele
 * já envia — bem mais barato que integrar um sistema externo.
 */
const SINAIS_METADATA: Array<{ padrao: RegExp; campo: string }> = [
  { padrao: /primeiro contato|fcr/i, campo: "resolvidoNoPrimeiroContato" },
  { padrao: /uso correto de ferramentas/i, campo: "ferramentasCorretas" },
  { padrao: /respostas inventadas|alucinaç/i, campo: "respostaInventada" },
  { padrao: /escalonamento correto/i, campo: "escalonamentoCorreto" },
  { padrao: /classificaç|precisão de classificação/i, campo: "classificacaoCorreta" },
  { padrao: /conformidade|aderência a guardrails|violaç/i, campo: "dentroDaPolitica" },
  { padrao: /retrabalho|corrige a saída/i, campo: "exigiuRetrabalho" },
];

function normalizar(m: MetricaParaInstrumentar): string {
  return `${m.key} ${m.label}`;
}

function snippetEvidencia(m: MetricaParaInstrumentar): Instrumentacao["snippets"] {
  const exemplo = m.unit === "%" ? "78.4" : m.unit.startsWith("R$") ? "1240.50" : "42";
  const corpo = {
    metricKey: m.key,
    label: m.label,
    value: Number(exemplo),
    unit: m.unit,
    kind: "observed",
    confidence: 0.95,
    sampleSize: 412,
    agentId: "<id do agente>",
    lineage: [{ stage: "source", name: "<sistema de registro>", ref: "<consulta ou relatório>" }],
  };
  const json = JSON.stringify(corpo, null, 2);
  return [
    {
      titulo: "Publicar a observação",
      linguagem: "bash",
      codigo: `curl -X POST $MUSTER_URL/api/evidence \\\n  -H 'content-type: application/json' \\\n  -d '${JSON.stringify(corpo)}'`,
    },
    { titulo: "Corpo da observação", linguagem: "json", codigo: json },
  ];
}

function snippetMetadata(m: MetricaParaInstrumentar, campo: string): Instrumentacao["snippets"] {
  return [
    {
      titulo: "Acrescente o campo ao evento que o agente já envia",
      linguagem: "typescript",
      codigo:
        `await muster.trackExecution(() => agente.run(tarefa), {\n` +
        `  metadata: {\n` +
        `    // alimenta "${m.label}"\n` +
        `    ${campo}: resultado.${campo},\n` +
        `  },\n` +
        `});`,
    },
    {
      titulo: "Ou direto no REST",
      linguagem: "bash",
      codigo:
        `curl -X POST $MUSTER_URL/api/agents/$AGENT_ID/events \\\n` +
        `  -H "authorization: Bearer $MUSTER_KEY" \\\n` +
        `  -d '{"kind":"execution","success":true,"durationMs":1180,` +
        `"metadata":{"${campo}":true}}'`,
    },
  ];
}

export function instrumentacaoPara(m: MetricaParaInstrumentar): Instrumentacao {
  const texto = normalizar(m);

  const automatico = SINAIS_AUTOMATICOS.find((s) => s.padrao.test(texto));
  if (automatico) {
    return {
      forma: "automatica",
      resumo: `Já capturada: ${automatico.explicacao}.`,
      campo: automatico.campo,
      snippets: [
        {
          titulo: "Nada a instrumentar — o evento de execução já carrega o sinal",
          linguagem: "typescript",
          codigo: `await muster.trackExecution(() => agente.run(tarefa));`,
        },
      ],
      requisitos: [
        "O agente reporta execuções (SDK, REST ou ponte de nuvem).",
        `A meta declarada é "${m.target}" — a avaliação compara contra ela.`,
      ],
    };
  }

  const metadata = SINAIS_METADATA.find((s) => s.padrao.test(texto));
  if (metadata) {
    return {
      forma: "metadata",
      resumo: `O agente sabe a resposta ao fim de cada tarefa: acrescente "${metadata.campo}" ao evento que ele já envia.`,
      campo: `metadata.${metadata.campo}`,
      snippets: snippetMetadata(m, metadata.campo),
      requisitos: [
        `Cada execução informa "${metadata.campo}" como verdadeiro ou falso.`,
        "Sem o campo, a métrica fica sem evidência e não entra na avaliação — em vez de virar zero.",
      ],
    };
  }

  return {
    forma: "evidencia",
    resumo:
      "O número vive num sistema de registro (CRM, atendimento, warehouse). Publique como observação, com a linhagem de onde veio.",
    campo: "value",
    snippets: snippetEvidencia(m),
    requisitos: [
      `Unidade "${m.unit}", coerente com a meta "${m.target}".`,
      "Declare kind: observed quando o número for medido; inferred quando for estimado.",
      "Informe sampleSize — amostra pequena reduz a confiança do veredito.",
      "Preencha lineage: é o que permite auditar do veredito de volta à origem.",
    ],
  };
}

/** Resumo por forma de captura, para a tela dizer quanto trabalho um catálogo dá. */
export function resumirEsforco(metricas: MetricaParaInstrumentar[]): Record<FormaDeCaptura, number> {
  const acc: Record<FormaDeCaptura, number> = { automatica: 0, metadata: 0, evidencia: 0 };
  for (const m of metricas) acc[instrumentacaoPara(m).forma] += 1;
  return acc;
}
