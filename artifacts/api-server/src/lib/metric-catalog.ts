import type { LayerKey } from "@workspace/db";
import { KPI_DOMAIN_CATALOG, KPI_DOMAIN_VERTICALS } from "./kpi-domain-catalog";
import type { KpiContract } from "./kpi-contract";

/**
 * Pre-populated metric catalog for R2 of the roadmap. Deep, realistic metric
 * definitions organized by business vertical so a reviewer can assemble an
 * agent's KPI panel from curated building blocks instead of a blank page.
 *
 * Every `target` string here MUST be parseable by `metricTargetStatus` in
 * `@workspace/metrics` (operators like `≥ 85%`, `< 3 s`, bare `0`, ranges like
 * `R$ 0,10–0,40`) or be explicitly non-comparable (`—`, `baseline ±20%`).
 * Units align with `valueForUnit` in discovery.ts wherever possible so seeded
 * evaluations produce plausible values for catalog picks.
 */

export interface CatalogMetric {
  key: string;
  layer: LayerKey;
  label: string;
  unit: string;
  target: string;
  description: string;
  rationale: string;
}

export interface MetricVertical {
  key: string;
  label: string;
  description: string;
  // lucide-react icon name, resolved by the web client at render time.
  icon: string;
  metrics: CatalogMetric[];
}

export interface MetricStarterKit {
  key: string;
  label: string;
  scenario: string;
  adoptionStage: "baseline" | "pilot" | "scale";
  objective: string;
  guidance: string;
  vertical: string;
  metricKeys: string[];
  requiredSignals: string[];
}

const BASE_METRIC_CATALOG: MetricVertical[] = [
  {
    key: "negocios",
    label: "Negócios",
    description:
      "Impacto comercial direto do agente: receita, conversão, retenção e experiência do cliente.",
    icon: "Briefcase",
    metrics: [
      {
        key: "receita-influenciada",
        layer: "value",
        label: "Receita influenciada",
        unit: "R$ mil",
        target: "≥ 100",
        description:
          "Mede a receita de negócios em que o agente participou de alguma etapa da jornada de venda.",
        rationale:
          "Receita influenciada consistente é o argumento mais forte para promover o agente a mais contas e territórios.",
      },
      {
        key: "conversao-assistida",
        layer: "efficacy",
        label: "Conversão assistida",
        unit: "%",
        target: "≥ 25%",
        description:
          "Mede a taxa de conversão dos leads ou oportunidades trabalhados com apoio do agente.",
        rationale:
          "Conversão abaixo do funil humano indica que o agente precisa de mentoria antes de assumir mais volume.",
      },
      {
        key: "ganho-win-rate",
        layer: "efficacy",
        label: "Ganho de win rate",
        unit: "%",
        target: "≥ +5pp",
        description:
          "Mede o uplift de win rate dos vendedores que usam o agente frente ao grupo de controle.",
        rationale:
          "Sem uplift mensurável sobre o baseline humano, não há caso de promoção — apenas custo adicional.",
      },
      {
        key: "churn-evitado",
        layer: "value",
        label: "Churn evitado",
        unit: "%",
        target: "≥ +2pp",
        description:
          "Mede a redução de churn em pontos percentuais nas contas monitoradas proativamente pelo agente.",
        rationale:
          "Retenção é receita recorrente protegida; ganho sustentado aqui pesa direto no veredito de promoção.",
      },
      {
        key: "nps-interno-time",
        layer: "adoption",
        label: "NPS interno do time",
        unit: "pts",
        target: "≥ 40",
        description:
          "Mede o Net Promoter Score do time comercial que trabalha lado a lado com o agente.",
        rationale:
          "Time que não recomendaria o agente para de usá-lo — NPS baixo antecipa colapso de adoção e aposentadoria.",
      },
      {
        key: "ticket-medio-assistido",
        layer: "value",
        label: "Ticket médio assistido",
        unit: "R$ mil",
        target: "—",
        description:
          "Mede o valor médio dos negócios fechados com participação do agente na negociação.",
        rationale:
          "Ticket médio em queda sugere que o agente está atraindo negócios pequenos e merece observação, não expansão.",
      },
      {
        key: "cac-assistido",
        layer: "efficiency",
        label: "Custo de aquisição assistido",
        unit: "R$ mil",
        target: "≤ 12",
        description:
          "Mede o custo de aquisição por cliente nas jornadas em que o agente executa etapas do funil.",
        rationale:
          "Se o agente não reduz o CAC frente ao processo manual, sua eficiência não justifica manter o investimento.",
      },
      {
        key: "tempo-ciclo-venda",
        layer: "efficiency",
        label: "Tempo de ciclo de venda",
        unit: "d",
        target: "≤ 30 d",
        description:
          "Mede o número de dias entre a criação da oportunidade e o fechamento nos negócios assistidos.",
        rationale:
          "Encurtar o ciclo é o efeito de eficiência mais visível ao negócio e sustenta a promoção do agente.",
      },
      {
        key: "propostas-geradas-dia",
        layer: "adoption",
        label: "Propostas geradas por dia",
        unit: "/dia",
        target: "≥ 15",
        description:
          "Mede quantas propostas comerciais o time solicita ao agente por dia útil.",
        rationale:
          "Uso diário crescente mostra que o time confia no agente; estagnação sinaliza necessidade de mentoria.",
      },
      {
        key: "aderencia-politica-desconto",
        layer: "governance",
        label: "Aderência à política de descontos",
        unit: "%",
        target: "≥ 98%",
        description:
          "Mede o percentual de propostas do agente dentro das alçadas de desconto aprovadas.",
        rationale:
          "Descontos fora de alçada corroem margem em silêncio — violação recorrente é motivo direto de aposentadoria.",
      },
    ],
  },
  {
    key: "tecnologia",
    label: "Tecnologia",
    description:
      "Saúde técnica do agente: qualidade das decisões, uso de ferramentas, latência, custo e estabilidade.",
    icon: "Cpu",
    metrics: [
      {
        key: "acuracia-decisoes",
        layer: "efficacy",
        label: "Acurácia das decisões",
        unit: "%",
        target: "≥ 85%",
        description:
          "Mede o percentual de decisões do agente validadas como corretas em auditoria amostral.",
        rationale:
          "É o sinal-mestre de eficácia técnica: abaixo da meta, o agente vai para mentoria antes de qualquer expansão.",
      },
      {
        key: "tarefas-concluidas",
        layer: "efficacy",
        label: "Tarefas concluídas",
        unit: "%",
        target: "≥ 90%",
        description:
          "Mede o percentual de tarefas finalizadas pelo agente sem abandono ou intervenção adicional.",
        rationale:
          "Conclusão consistente mostra que o agente entrega o trabalho completo, não apenas uma resposta plausível.",
      },
      {
        key: "uso-correto-ferramentas",
        layer: "efficacy",
        label: "Uso correto de ferramentas",
        unit: "%",
        target: "≥ 95%",
        description:
          "Mede o percentual de chamadas de ferramenta feitas com a ferramenta e os parâmetros certos.",
        rationale:
          "Erros de ferramenta se propagam para sistemas reais; taxa baixa bloqueia promoção a fluxos de maior risco.",
      },
      {
        key: "respostas-inventadas",
        layer: "governance",
        label: "Respostas inventadas",
        unit: "%",
        target: "≤ 2%",
        description:
          "Mede a fração de respostas com fatos, valores ou referências fabricados pelo agente.",
        rationale:
          "Alucinação acima do limite destrói a confiança do usuário e é o gatilho mais comum de aposentadoria.",
      },
      {
        key: "tempo-resposta",
        layer: "efficiency",
        label: "Tempo de resposta",
        unit: "s",
        target: "< 3 s",
        description:
          "Mede o tempo médio entre a solicitação do usuário e a primeira resposta útil do agente.",
        rationale:
          "Resposta lenta faz o humano voltar ao processo manual, minando adoção antes mesmo da avaliação de valor.",
      },
      {
        key: "latencia-p95",
        layer: "efficiency",
        label: "Latência p95",
        unit: "s",
        target: "< 5 s",
        description:
          "Mede a latência do percentil 95 das execuções, capturando os piores casos percebidos.",
        rationale:
          "A cauda de latência define a experiência real; p95 degradado exige mentoria técnica antes de escalar volume.",
      },
      {
        key: "custo-por-mil-tokens",
        layer: "efficiency",
        label: "Custo por 1k tokens",
        unit: "R$",
        target: "R$ 0,02–0,08",
        description:
          "Mede o custo médio de inferência por mil tokens consumidos pelo agente.",
        rationale:
          "Custo unitário fora da faixa indica prompts inchados ou modelo superdimensionado — eficiência a corrigir.",
      },
      {
        key: "consumo-tokens-tarefa",
        layer: "efficiency",
        label: "Tokens por tarefa",
        unit: "tok",
        target: "baseline ±20%",
        description:
          "Mede o consumo médio de tokens por tarefa concluída, comparado ao baseline de homologação.",
        rationale:
          "Desvio grande do baseline denuncia loops ou contexto desnecessário e antecipa estouro de custo.",
      },
      {
        key: "drift-comportamento",
        layer: "governance",
        label: "Drift de comportamento",
        unit: "%",
        target: "≤ 3%",
        description:
          "Mede o desvio das respostas atuais frente ao comportamento aprovado na última homologação.",
        rationale:
          "Drift silencioso significa que o agente em produção já não é o agente aprovado — risco direto de governança.",
      },
      {
        key: "taxa-retry",
        layer: "efficiency",
        label: "Taxa de retry",
        unit: "%",
        target: "≤ 5%",
        description:
          "Mede a fração de execuções que precisaram de nova tentativa por falha ou timeout.",
        rationale:
          "Retries encarecem cada resultado e mascaram instabilidade que aparecerá no pico de volume pós-promoção.",
      },
      {
        key: "disponibilidade",
        layer: "efficacy",
        label: "Disponibilidade",
        unit: "%",
        target: "≥ 99,5%",
        description:
          "Mede o percentual do tempo em que o agente respondeu dentro do SLO de saúde.",
        rationale:
          "Um agente indisponível não pode ser avaliado nem confiado — disponibilidade é pré-requisito de qualquer promoção.",
      },
      {
        key: "chamadas-por-dia",
        layer: "adoption",
        label: "Chamadas processadas por dia",
        unit: "/dia",
        target: "≥ 500",
        description:
          "Mede o volume diário de invocações do agente por usuários e sistemas integrados.",
        rationale:
          "Volume real de uso valida a demanda; sem tração, o custo fixo do agente não se sustenta.",
      },
      {
        key: "economia-infra",
        layer: "value",
        label: "Economia de infraestrutura",
        unit: "R$ mil",
        target: "≥ 20",
        description:
          "Mede a economia mensal em infraestrutura e licenças atribuível à automação do agente.",
        rationale:
          "Traduz eficiência técnica em valor financeiro tangível — o número que sustenta o agente no comitê.",
      },
    ],
  },
  {
    key: "operacoes",
    label: "Operações",
    description:
      "Execução operacional: volume, SLA, retrabalho, escalonamento e capacidade liberada pelo agente.",
    icon: "Workflow",
    metrics: [
      {
        key: "volume-processado",
        layer: "adoption",
        label: "Volume processado",
        unit: "/dia",
        target: "—",
        description:
          "Mede a quantidade de casos, documentos ou transações processados pelo agente por dia.",
        rationale:
          "Volume estável ou crescente mostra que a operação de fato roteia trabalho para o agente.",
      },
      {
        key: "volume-processamento",
        layer: "efficiency",
        label: "Volume de processamento",
        unit: "execuções",
        target: "—",
        description:
          "Mede a capacidade de processamento do agente na janela operacional avaliada.",
        rationale:
          "Volume contextualiza as demais métricas e evita conclusões baseadas em uma amostra pequena.",
      },
      {
        key: "captura-demanda-elegivel",
        layer: "adoption",
        label: "Captura de demanda elegível",
        unit: "%",
        target: "≥ 70%",
        description:
          "Mede quanto da demanda elegível é efetivamente direcionada para o agente.",
        rationale:
          "Baixa captura indica que a organização ainda não incorporou o agente ao fluxo real de trabalho.",
      },
      {
        key: "sla-cumprido",
        layer: "efficacy",
        label: "SLA cumprido",
        unit: "%",
        target: "≥ 97%",
        description:
          "Mede o percentual de casos concluídos dentro do prazo acordado com as áreas de negócio.",
        rationale:
          "SLA furado pelo agente vira SLA furado da operação — descumprimento recorrente barra a promoção.",
      },
      {
        key: "casos-retrabalho-interno",
        layer: "efficiency",
        label: "Casos com retrabalho interno",
        unit: "%",
        target: "≤ 5%",
        description:
          "Mede a fração de casos que precisaram ser refeitos ou complementados por um humano.",
        rationale:
          "Retrabalho consome a economia prometida; acima do limite, o agente custa mais do que entrega.",
      },
      {
        key: "escalonamento-correto",
        layer: "governance",
        label: "Escalonamento correto",
        unit: "%",
        target: "≥ 80%",
        description:
          "Mede o percentual de casos escalados ao humano no momento e para a fila certos.",
        rationale:
          "Saber quando não decidir é maturidade de governança — escalonamento ruim é risco tanto por excesso quanto por falta.",
      },
      {
        key: "time-corrige-saida",
        layer: "adoption",
        label: "Time corrige a saída",
        unit: "%",
        target: "≤ 8%",
        description:
          "Mede a fração de entregas do agente que o time edita antes de usar ou enviar adiante.",
        rationale:
          "Correção frequente revela desconfiança operacional — o antídoto é mentoria, não mais volume.",
      },
      {
        key: "tempo-ciclo-processo",
        layer: "efficiency",
        label: "Tempo de ciclo do processo",
        unit: "min",
        target: "≤ 15 min",
        description:
          "Mede o tempo médio de ponta a ponta de um caso desde a entrada até a conclusão.",
        rationale:
          "Reduzir o ciclo é a promessa central da automação; ciclo estagnado enfraquece o caso de promoção.",
      },
      {
        key: "backlog-pendente",
        layer: "efficiency",
        label: "Backlog pendente",
        unit: "neg.",
        target: "≤ 50",
        description:
          "Mede a quantidade de casos aguardando processamento na fila do agente ao fim do dia.",
        rationale:
          "Backlog crescente indica que o agente não absorve a demanda — sinal de subdimensionamento ou ineficiência.",
      },
      {
        key: "capacidade-liberada",
        layer: "value",
        label: "Capacidade liberada",
        unit: "h",
        target: "≥ 80",
        description:
          "Mede as horas mensais de trabalho operacional que o time deixou de executar graças ao agente.",
        rationale:
          "Capacidade liberada e realocada é o valor operacional concreto que justifica promover o agente.",
      },
      {
        key: "precisao-classificacao",
        layer: "efficacy",
        label: "Precisão de classificação",
        unit: "%",
        target: "≥ 92%",
        description:
          "Mede o percentual de casos classificados e roteados corretamente pelo agente na entrada.",
        rationale:
          "Classificação errada contamina todo o fluxo a jusante — é o primeiro elo de eficácia a auditar.",
      },
      {
        key: "conformidade-procedimento",
        layer: "governance",
        label: "Conformidade com procedimento",
        unit: "%",
        target: "≥ 99%",
        description:
          "Mede a aderência das execuções do agente ao procedimento operacional padrão documentado.",
        rationale:
          "Desvio de procedimento em escala automatizada multiplica não conformidades — tolerância mínima antes de aposentar.",
      },
    ],
  },
  {
    key: "suporte-ti",
    label: "Suporte de TI",
    description:
      "Atendimento e resolução: primeiro contato, reincidência, deflexão, satisfação e custo por atendimento.",
    icon: "Headset",
    metrics: [
      {
        key: "fcr-primeiro-contato",
        layer: "efficacy",
        label: "Resolução no primeiro contato (FCR)",
        unit: "%",
        target: "≥ 75%",
        description:
          "Mede o percentual de chamados resolvidos pelo agente sem necessidade de novo contato.",
        rationale:
          "FCR alto é a prova de que o agente resolve de verdade em vez de apenas responder — pilar do veredito de promoção.",
      },
      {
        key: "cliente-volta-72h",
        layer: "efficacy",
        label: "Cliente volta em 72h",
        unit: "%",
        target: "≤ 15%",
        description:
          "Mede a fração de clientes que reabrem contato sobre o mesmo problema em até 72 horas.",
        rationale:
          "Reincidência rápida desmascara resoluções aparentes — acima do limite, a eficácia declarada é ilusória.",
      },
      {
        key: "mttr-resolucao",
        layer: "efficiency",
        label: "Tempo médio de resolução (MTTR)",
        unit: "h",
        target: "≤ 4 h",
        description:
          "Mede o tempo médio entre a abertura do chamado e a resolução confirmada pelo agente.",
        rationale:
          "MTTR é o indicador de eficiência que o negócio sente na pele; piora sustentada exige intervenção de mentoria.",
      },
      {
        key: "taxa-deflexao",
        layer: "adoption",
        label: "Taxa de deflexão",
        unit: "%",
        target: "≥ 60%",
        description:
          "Mede o percentual de chamados absorvidos pelo agente sem chegar à fila humana.",
        rationale:
          "Deflexão é a alavanca que reduz o custo da central — quanto maior, mais forte o caso de expansão do agente.",
      },
      {
        key: "csat-atendimento",
        layer: "value",
        label: "CSAT",
        unit: "/5",
        target: "≥ 4,2/5",
        description:
          "Mede a satisfação média declarada pelos usuários ao final dos atendimentos do agente.",
        rationale:
          "Automação que resolve mas irrita gera passivo de marca — CSAT baixo veta promoção mesmo com boa eficácia.",
      },
      {
        key: "custo-por-atendimento",
        layer: "efficiency",
        label: "Custo por atendimento",
        unit: "R$",
        target: "R$ 0,10–0,40",
        description:
          "Mede o custo médio de cada atendimento executado pelo agente, incluindo inferência e integrações.",
        rationale:
          "Comparado aos R$ 15–40 de um atendimento humano, é a base aritmética do ROI que sustenta o agente.",
      },
      {
        key: "tickets-reabertos",
        layer: "efficacy",
        label: "Tickets reabertos",
        unit: "%",
        target: "≤ 10%",
        description:
          "Mede a fração de tickets fechados pelo agente que foram reabertos em qualquer janela.",
        rationale:
          "Reabertura sistemática infla o FCR aparente e o custo real — sinal clássico de que a mentoria é necessária.",
      },
      {
        key: "cobertura-base-conhecimento",
        layer: "adoption",
        label: "Cobertura da base de conhecimento",
        unit: "%",
        target: "≥ 85%",
        description:
          "Mede o percentual dos temas de chamados cobertos pela base de conhecimento que alimenta o agente.",
        rationale:
          "Cobertura baixa condena o agente a escalar ou inventar — investir aqui destrava eficácia sem trocar o modelo.",
      },
      {
        key: "atendimentos-por-dia",
        layer: "adoption",
        label: "Atendimentos por dia",
        unit: "/dia",
        target: "≥ 200",
        description:
          "Mede o volume diário de atendimentos iniciados com o agente como primeiro nível.",
        rationale:
          "Sem volume, nenhuma outra métrica tem significância estatística para basear um veredito.",
      },
      {
        key: "escalonamento-indevido",
        layer: "governance",
        label: "Escalonamento indevido",
        unit: "%",
        target: "≤ 10%",
        description:
          "Mede a fração de chamados escalados ao humano que o agente tinha condições de resolver.",
        rationale:
          "Escalonamento indevido devolve à fila humana o custo que o agente deveria absorver — desperdício governável.",
      },
    ],
  },
  {
    key: "risco-compliance",
    label: "Risco & Compliance",
    description:
      "Segurança e conformidade: escopo, dados sensíveis, auditabilidade, guardrails e mudanças aprovadas.",
    icon: "ShieldCheck",
    metrics: [
      {
        key: "tentativas-fora-escopo",
        layer: "governance",
        label: "Tentativas fora do escopo",
        unit: "neg.",
        target: "0",
        description:
          "Mede o número de tentativas do agente de executar ações fora do escopo autorizado.",
        rationale:
          "Qualquer tentativa fora do escopo é violação de contrato de operação — tolerância zero antes de aposentar.",
      },
      {
        key: "exposicao-dado-sensivel",
        layer: "governance",
        label: "Exposição de dado sensível",
        unit: "neg.",
        target: "0",
        description:
          "Mede o número de incidentes em que o agente expôs dado pessoal ou confidencial indevidamente.",
        rationale:
          "Um único vazamento pode custar multa e reputação — é o veto absoluto que sobrepõe qualquer métrica de valor.",
      },
      {
        key: "trilha-auditoria",
        layer: "governance",
        label: "Trilha de auditoria",
        unit: "%",
        target: "≥ 99%",
        description:
          "Mede o percentual de decisões do agente com registro completo e reconstituível de contexto e ação.",
        rationale:
          "Sem trilha, nenhum veredito é defensável perante auditoria interna ou regulador — pré-condição de operação.",
      },
      {
        key: "violacoes-politica",
        layer: "governance",
        label: "Violações de política",
        unit: "%",
        target: "0",
        description:
          "Mede a fração de execuções que infringiram políticas corporativas ou regulatórias vigentes.",
        rationale:
          "Violações em escala automatizada se multiplicam mais rápido do que qualquer comitê consegue reagir.",
      },
      {
        key: "mudanca-comportamento-nao-aprovada",
        layer: "governance",
        label: "Mudança de comportamento não aprovada",
        unit: "neg.",
        target: "0",
        description:
          "Mede o número de alterações de prompt, modelo ou ferramenta em produção sem aprovação formal.",
        rationale:
          "Mudança não aprovada invalida a homologação anterior — o agente em produção deixa de ser o agente avaliado.",
      },
      {
        key: "mudanca-comportamento",
        layer: "governance",
        label: "Mudança de comportamento",
        unit: "sinal",
        target: "—",
        description:
          "Sinaliza alteração relevante no padrão de respostas antes de uma degradação agregada aparecer.",
        rationale:
          "Mudança silenciosa é um indicador antecedente: permite investigar antes que a qualidade e o valor caiam.",
      },
      {
        key: "aderencia-guardrails",
        layer: "governance",
        label: "Aderência a guardrails",
        unit: "%",
        target: "≥ 99%",
        description:
          "Mede o percentual de execuções em que todos os guardrails configurados foram respeitados.",
        rationale:
          "Guardrails ignorados transformam risco teórico em incidente real — aderência é condição de permanência.",
      },
      {
        key: "tempo-resposta-incidente",
        layer: "efficiency",
        label: "Tempo de resposta a incidente",
        unit: "min",
        target: "≤ 30 min",
        description:
          "Mede o tempo entre a detecção de um incidente do agente e a contenção pelo time responsável.",
        rationale:
          "Resposta lenta amplia o raio de dano de qualquer falha — a capacidade de conter define o risco aceitável.",
      },
      {
        key: "precisao-deteccao-risco",
        layer: "efficacy",
        label: "Precisão na detecção de risco",
        unit: "%",
        target: "≥ 90%",
        description:
          "Mede o percentual de situações de risco corretamente sinalizadas pelo agente em auditoria amostral.",
        rationale:
          "Falsos negativos em risco custam caro e falsos positivos corroem confiança — precisão sustenta o veredito.",
      },
      {
        key: "revisoes-humanas-realizadas",
        layer: "adoption",
        label: "Revisões humanas realizadas",
        unit: "%",
        target: "≥ 95%",
        description:
          "Mede o percentual de revisões humanas obrigatórias efetivamente executadas dentro do prazo.",
        rationale:
          "Supervisão humana que existe só no papel é o modo de falha mais comum de governança de agentes.",
      },
      {
        key: "exposicao-regulatoria-evitada",
        layer: "value",
        label: "Exposição regulatória evitada",
        unit: "R$ mil",
        target: "—",
        description:
          "Mede a estimativa de multas e sanções evitadas pelas detecções e bloqueios do agente.",
        rationale:
          "Valor defensivo raramente aparece no ROI tradicional — registrá-lo equilibra o caso de negócio do agente.",
      },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description:
      "Economia do agente: ROI, custo por execução, payback, horas liberadas e tempo até o primeiro valor.",
    icon: "Wallet",
    metrics: [
      {
        key: "retorno-sobre-investimento",
        layer: "value",
        label: "Retorno sobre investimento",
        unit: "x",
        target: "≥ 3x",
        description:
          "Mede a razão entre o valor gerado pelo agente e seu custo total no período.",
        rationale:
          "ROI abaixo de 1x por dois ciclos seguidos é o critério financeiro objetivo de aposentadoria.",
      },
      {
        key: "custo-por-execucao",
        layer: "efficiency",
        label: "Custo por execução (CPE)",
        unit: "R$",
        target: "R$ 0,10–0,40",
        description:
          "Mede o custo médio de cada execução completa do agente, incluindo modelo, ferramentas e retries.",
        rationale:
          "CPE é a unidade de conta da economia de agentes — fora da faixa, o volume amplifica prejuízo, não valor.",
      },
      {
        key: "custo-total-mensal",
        layer: "efficiency",
        label: "Custo total mensal",
        unit: "R$ mil",
        target: "—",
        description:
          "Mede o custo mensal consolidado do agente: inferência, integrações, monitoramento e suporte.",
        rationale:
          "É o denominador de todos os cálculos de ROI — sem ele rastreado, qualquer veredito financeiro é chute.",
      },
      {
        key: "payback",
        layer: "value",
        label: "Payback",
        unit: "d",
        target: "≤ 180 d",
        description:
          "Mede o número de dias necessários para o valor acumulado do agente cobrir o investimento inicial.",
        rationale:
          "Payback curto libera orçamento para o próximo agente do portfólio — payback longo trava a esteira.",
      },
      {
        key: "horas-humanas-liberadas",
        layer: "value",
        label: "Horas humanas liberadas",
        unit: "h",
        target: "≥ 160",
        description:
          "Mede as horas mensais de trabalho humano substituídas ou evitadas pela atuação do agente.",
        rationale:
          "É a ponte entre a operação e o financeiro: horas liberadas precificadas viram o numerador do ROI.",
      },
      {
        key: "tempo-ate-primeiro-valor",
        layer: "value",
        label: "Tempo até primeiro valor",
        unit: "d",
        target: "≤ 45 d",
        description:
          "Mede os dias entre a admissão do agente e a primeira entrega de valor mensurável em produção.",
        rationale:
          "Agente que demora a entregar valor consome paciência executiva — velocidade de valor protege o programa inteiro.",
      },
      {
        key: "custo-correcao",
        layer: "efficiency",
        label: "Custo de correção",
        unit: "R$ mil",
        target: "≤ 5",
        description:
          "Mede o custo mensal do esforço humano gasto corrigindo saídas incorretas do agente.",
        rationale:
          "É o custo oculto que transforma ROI aparente em prejuízo real — deve ser abatido de todo cálculo de valor.",
      },
      {
        key: "aderencia-orcamento",
        layer: "governance",
        label: "Aderência ao orçamento",
        unit: "%",
        target: "≥ 95%",
        description:
          "Mede o percentual de meses em que o custo do agente ficou dentro do orçamento aprovado.",
        rationale:
          "Estouros recorrentes indicam consumo descontrolado — disciplina orçamentária é governança financeira do agente.",
      },
      {
        key: "uso-capacidade-contratada",
        layer: "adoption",
        label: "Uso da capacidade contratada",
        unit: "%",
        target: "≥ 70%",
        description:
          "Mede o percentual da capacidade contratada (licenças, créditos, cotas) efetivamente consumida pelo agente.",
        rationale:
          "Capacidade ociosa é custo fixo sem retorno — subutilização crônica pede redimensionamento ou aposentadoria.",
      },
      {
        key: "precisao-previsao-custo",
        layer: "efficacy",
        label: "Precisão da previsão de custo",
        unit: "%",
        target: "≥ 90%",
        description:
          "Mede o quão próximo o custo real do agente ficou da previsão feita no início do período.",
        rationale:
          "Previsibilidade de custo é o que permite ao comitê aprovar expansões com confiança — imprevisível é impromovível.",
      },
    ],
  },
];

const DOMAIN_METRIC_VERTICALS: MetricVertical[] = KPI_DOMAIN_VERTICALS.map((vertical) => ({
  key: vertical.key,
  label: vertical.label,
  description: vertical.description,
  icon: vertical.icon,
  metrics: vertical.metrics.map((metric) => ({
    key: metric.key,
    layer: metric.layer,
    label: metric.label,
    unit: metric.unit,
    target: metric.target ?? "—",
    description: metric.purpose,
    rationale: metric.rationale,
  })),
}));

export const METRIC_CATALOG: MetricVertical[] = [
  ...BASE_METRIC_CATALOG,
  ...DOMAIN_METRIC_VERTICALS,
];

export const METRIC_STARTER_KITS: MetricStarterKit[] = [
  { key: "baseline-operacional", label: "Baseline operacional", scenario: "Instrumentação inicial", adoptionStage: "baseline", objective: "Validar se o agente está observável, produz evidência confiável e continua disponível.", guidance: "Ative primeiro heartbeat, completude de trace e avaliação fundamentada; performance sem esses sinais ainda não é decisória.", vertical: "operacoes-backoffice", metricKeys: ["runtime-cobertura-heartbeat", "dados-completude-trace", "eval-saida-fundamentada", "discovery-prontidao-instrumentacao"], requiredSignals: ["heartbeat_coverage", "trace_completeness", "grounded_output_rate", "instrumentation_readiness"] },
  { key: "atendimento-resolutivo", label: "Atendimento resolutivo", scenario: "Suporte", adoptionStage: "pilot", objective: "Provar resolução real sem trocar qualidade por velocidade.", guidance: "Combine resolução, reabertura, satisfação, escalonamento e tempo ponta a ponta; não use deflexão isolada.", vertical: "atendimento", metricKeys: ["atendimento-fcr", "atendimento-reabertura-72h", "atendimento-csat", "atendimento-escalonamento-apropriado", "atendimento-mttr"], requiredSignals: ["resolution_rate", "cliente_volta_72h", "csat", "escalonamento_correto", "mttr_hours"] },
  { key: "vendas-com-guardrail", label: "Vendas com guardrail", scenario: "Vendas", adoptionStage: "pilot", objective: "Medir conversão incremental sem gerar pipeline falso ou erosão de margem.", guidance: "Compare com grupo de controle e mantenha falsos positivos como guardrail de promoção.", vertical: "vendas-crm", metricKeys: ["vendas-speed-to-lead", "vendas-conversao-qualificada", "vendas-win-rate-uplift", "vendas-falso-positivo-lead", "vendas-adocao-representante"], requiredSignals: ["speed_to_lead", "lead_conversion", "win_rate_uplift", "false_positive_rate", "rep_adoption"] },
  { key: "engenharia-segura", label: "Engenharia segura", scenario: "Engenharia", adoptionStage: "pilot", objective: "Aumentar throughput sem aceitar regressão, rollback ou defeito escapado.", guidance: "Produtividade só entra no painel junto com qualidade de mudança, revisão e recuperação.", vertical: "engenharia-it", metricKeys: ["engenharia-sucesso-primeira-passada", "engenharia-defeito-escapado", "engenharia-cobertura-revisao", "engenharia-falha-de-mudanca", "engenharia-mttr"], requiredSignals: ["task_success", "escaped_defect_rate", "review_coverage", "change_failure_rate", "mttr_hours"] },
  { key: "risco-e-supervisao", label: "Risco e supervisão", scenario: "Risco", adoptionStage: "pilot", objective: "Demonstrar que o agente opera dentro do contrato e deixa trilha defensável.", guidance: "Exposição sensível tem tolerância zero; cobertura e exceções devem ser verificadas antes de ampliar autonomia.", vertical: "risco-financas-rh", metricKeys: ["risco-cobertura-auditoria", "risco-exposicao-dado-sensivel", "risco-excecao-politica", "financas-variacao-custo", "rh-impacto-experiencia"], requiredSignals: ["audit_coverage", "exposicao_dado_sensivel", "exception_rate", "cost_variance", "employee_experience"] },
  { key: "backoffice-controlado", label: "Backoffice controlado", scenario: "Operações e backoffice", adoptionStage: "scale", objective: "Aumentar processamento sem esconder fila, exceções ou dependência do runtime primário.", guidance: "Promova somente quando fluxo sem toque, cauda da fila, exceções, fallback e qualidade do trace estiverem controlados.", vertical: "operacoes-backoffice", metricKeys: ["operacoes-processamento-sem-toque", "operacoes-taxa-excecao", "operacoes-idade-fila-p95", "runtime-sucesso-fallback", "dados-completude-trace"], requiredSignals: ["straight_through_processing", "operational_exception_rate", "queue_age_p95", "fallback_success_rate", "trace_completeness"] },
  { key: "workforce-hibrida-controlada", label: "Workforce híbrida controlada", scenario: "Workforce híbrida", adoptionStage: "scale", objective: "Medir o resultado conjunto de humanos e agentes, incluindo handoffs, supervisão e retrabalho.", guidance: "A autonomia cresce apenas quando aceite, override, integridade de contexto e cobertura de supervisão contam a mesma história.", vertical: "workforce-hibrida", metricKeys: ["hibrida-aceite-humano", "hibrida-taxa-override", "hibrida-retrabalho", "a2a-integridade-contexto", "hibrida-cobertura-supervisao"], requiredSignals: ["human_acceptance_rate", "human_override_rate", "human_rework_rate", "a2a_context_integrity", "supervision_coverage"] },
];

const KPI_CONTRACT_INDEX = new Map<string, KpiContract>(
  KPI_DOMAIN_CATALOG.map((contract) => [contract.key, contract]),
);

export function kpiContractByMetricKey(key: string): KpiContract | undefined {
  return KPI_CONTRACT_INDEX.get(key);
}

// Flat index for O(1) lookup by metric key. Built once at module load.
const CATALOG_INDEX: Map<string, CatalogMetric> = new Map(
  METRIC_CATALOG.flatMap((v) => v.metrics.map((m) => [m.key, m] as const)),
);

export function catalogMetricByKey(key: string): CatalogMetric | undefined {
  return CATALOG_INDEX.get(key);
}

// Distinct units used across the catalog, in first-appearance order. Aligned
// with valueForUnit in discovery.ts where possible ("%", "s", "min", "tok",
// "R$", "R$ mil", "/5", "/dia", "neg.") plus catalog-specific ones
// ("pts", "d", "h", "x").
export const CATALOG_UNITS: string[] = [
  ...new Set(METRIC_CATALOG.flatMap((v) => v.metrics.map((m) => m.unit))),
];
