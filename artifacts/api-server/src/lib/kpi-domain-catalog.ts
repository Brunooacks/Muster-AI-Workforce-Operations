import type { KpiContract, KpiDomain } from "./kpi-contract";

export interface KpiDomainVertical {
  key: KpiDomain;
  label: string;
  description: string;
  icon: string;
  metrics: KpiContract[];
}

type KpiDefinition = Omit<KpiContract, "minSampleSize" | "evidence"> & {
  minSampleSize?: number;
  evidence?: KpiContract["evidence"];
};

function defineKpi(definition: KpiDefinition): KpiContract {
  return {
    minSampleSize: 30,
    evidence: { allowed: ["observed", "inferred"], minConfidence: 80, auditSampleRate: 10 },
    ...definition,
  };
}

export const KPI_DOMAIN_VERTICALS: KpiDomainVertical[] = [
  {
    key: "atendimento",
    label: "Atendimento",
    description: "Qualidade, velocidade, custo e confiança na resolução de clientes e usuários.",
    icon: "Headset",
    metrics: [
      defineKpi({ key: "atendimento-fcr", domain: "atendimento", area: "Suporte ao cliente", layer: "efficacy", label: "Resolução no primeiro contato", purpose: "Confirmar que o caso foi resolvido sem novo contato.", unit: "%", direction: "higher-is-better", formula: "casos resolvidos sem reabertura / casos elegíveis × 100", sourceSignals: ["resolution_rate"], cadence: "weekly", baseline: "required", target: "≥ 75%", owner: "Líder de Atendimento", decisionImpact: "promote", guardrail: false, rationale: "FCR alto diferencia resolução real de resposta apenas plausível." }),
      defineKpi({ key: "atendimento-reabertura-72h", domain: "atendimento", area: "Suporte ao cliente", layer: "efficacy", label: "Reabertura em 72 horas", purpose: "Detectar resoluções aparentes que falham logo após o encerramento.", unit: "%", direction: "lower-is-better", formula: "casos reabertos em 72h / casos encerrados × 100", sourceSignals: ["cliente_volta_72h"], cadence: "weekly", baseline: "required", target: "≤ 15%", owner: "Líder de Atendimento", decisionImpact: "mentor", guardrail: true, rationale: "Reabertura recorrente bloqueia expansão mesmo com boa velocidade." }),
      defineKpi({ key: "atendimento-csat", domain: "atendimento", area: "Experiência do cliente", layer: "value", label: "CSAT assistido", purpose: "Medir a satisfação declarada no atendimento com agente.", unit: "/5", direction: "higher-is-better", formula: "média das avaliações válidas pós-atendimento", sourceSignals: ["csat"], cadence: "weekly", baseline: "required", target: "≥ 4,2/5", owner: "Customer Experience", decisionImpact: "promote", guardrail: false, rationale: "Automação que resolve mas irrita não deve ser promovida." }),
      defineKpi({ key: "atendimento-escalonamento-apropriado", domain: "atendimento", area: "Supervisão", layer: "governance", label: "Escalonamento apropriado", purpose: "Verificar se o agente sabe quando e para quem transferir o caso.", unit: "%", direction: "higher-is-better", formula: "escalonamentos corretos / escalonamentos auditados × 100", sourceSignals: ["escalonamento_correto"], cadence: "weekly", baseline: "required", target: "≥ 80%", owner: "Supervisor da Operação", decisionImpact: "mentor", guardrail: true, rationale: "Saber não decidir é requisito de segurança operacional." }),
      defineKpi({ key: "atendimento-mttr", domain: "atendimento", area: "Operação de suporte", layer: "efficiency", label: "Tempo médio de resolução", purpose: "Reduzir o tempo de ponta a ponta sem degradar qualidade.", unit: "h", direction: "lower-is-better", formula: "soma do tempo até resolução / casos resolvidos", sourceSignals: ["mttr_hours"], cadence: "weekly", baseline: "required", target: "≤ 4 h", owner: "Líder de Atendimento", decisionImpact: "mentor", guardrail: false, rationale: "Velocidade só vale quando não aumenta reabertura e escalonamento." }),
    ],
  },
  {
    key: "vendas-crm",
    label: "Vendas & CRM",
    description: "Conversão, velocidade comercial, adoção do time e proteção de margem.",
    icon: "BriefcaseBusiness",
    metrics: [
      defineKpi({ key: "vendas-speed-to-lead", domain: "vendas-crm", area: "Pré-vendas", layer: "efficiency", label: "Speed to lead", purpose: "Medir a velocidade entre a entrada e o primeiro contato qualificado.", unit: "min", direction: "lower-is-better", formula: "mediana do tempo entre lead recebido e primeiro contato", sourceSignals: ["speed_to_lead"], cadence: "daily", baseline: "required", target: "< 5 min", owner: "Líder de SDR", decisionImpact: "promote", guardrail: false, rationale: "Velocidade aumenta a chance de conversão sem exigir mais headcount." }),
      defineKpi({ key: "vendas-conversao-qualificada", domain: "vendas-crm", area: "Qualificação", layer: "efficacy", label: "Conversão qualificada", purpose: "Medir se a qualificação entrega oportunidades com potencial real.", unit: "%", direction: "higher-is-better", formula: "leads qualificados convertidos / leads qualificados × 100", sourceSignals: ["lead_conversion"], cadence: "weekly", baseline: "required", target: "≥ 25%", owner: "Revenue Operations", decisionImpact: "promote", guardrail: false, rationale: "Mais volume sem qualidade desloca custo para o vendedor." }),
      defineKpi({ key: "vendas-win-rate-uplift", domain: "vendas-crm", area: "Pipeline", layer: "value", label: "Uplift de win rate", purpose: "Comprovar ganho incremental contra vendedores ou contas de controle.", unit: "%", direction: "higher-is-better", formula: "win rate assistido − win rate do grupo de controle", sourceSignals: ["win_rate_uplift"], cadence: "monthly", baseline: "required", target: "≥ +5pp", owner: "Diretor Comercial", decisionImpact: "promote", guardrail: false, rationale: "Sem uplift contra baseline não há evidência de valor incremental." }),
      defineKpi({ key: "vendas-falso-positivo-lead", domain: "vendas-crm", area: "Qualificação", layer: "governance", label: "Falso positivo de lead", purpose: "Limitar leads classificados como bons que não atendem aos critérios.", unit: "%", direction: "lower-is-better", formula: "leads rejeitados pelo vendedor / leads qualificados pelo agente × 100", sourceSignals: ["false_positive_rate"], cadence: "weekly", baseline: "required", target: "≤ 5%", owner: "Revenue Operations", decisionImpact: "mentor", guardrail: true, rationale: "Falsos positivos consomem tempo comercial e corroem confiança." }),
      defineKpi({ key: "vendas-adocao-representante", domain: "vendas-crm", area: "Adoção comercial", layer: "adoption", label: "Adoção pelo representante", purpose: "Medir uso recorrente e voluntário pelo time comercial.", unit: "%", direction: "higher-is-better", formula: "representantes ativos no período / representantes elegíveis × 100", sourceSignals: ["rep_adoption"], cadence: "weekly", baseline: "required", target: "≥ 70%", owner: "Enablement Comercial", decisionImpact: "mentor", guardrail: false, rationale: "Sem adoção do time, o agente não muda o processo real." }),
    ],
  },
  {
    key: "engenharia-it",
    label: "Engenharia & IT",
    description: "Entrega técnica, estabilidade, segurança de mudança e colaboração com desenvolvedores.",
    icon: "Code2",
    metrics: [
      defineKpi({ key: "engenharia-sucesso-primeira-passada", domain: "engenharia-it", area: "Entrega técnica", layer: "efficacy", label: "Sucesso na primeira passada", purpose: "Medir tarefas concluídas sem correção posterior significativa.", unit: "%", direction: "higher-is-better", formula: "tarefas aceitas sem retrabalho / tarefas concluídas × 100", sourceSignals: ["task_success"], cadence: "weekly", baseline: "required", target: "≥ 90%", owner: "Engineering Manager", decisionImpact: "promote", guardrail: false, rationale: "Primeira passada conecta produtividade com qualidade entregue." }),
      defineKpi({ key: "engenharia-defeito-escapado", domain: "engenharia-it", area: "Qualidade", layer: "governance", label: "Defeito escapado", purpose: "Detectar defeitos introduzidos pelo fluxo assistido após a entrega.", unit: "%", direction: "lower-is-better", formula: "defeitos em produção atribuídos / mudanças assistidas × 100", sourceSignals: ["escaped_defect_rate"], cadence: "weekly", baseline: "required", target: "≤ 5%", owner: "Engineering Manager", decisionImpact: "mentor", guardrail: true, rationale: "Velocidade não pode ser comprada com regressão em produção." }),
      defineKpi({ key: "engenharia-cobertura-revisao", domain: "engenharia-it", area: "Code review", layer: "efficacy", label: "Cobertura de revisão", purpose: "Garantir que mudanças elegíveis recebam revisão assistida ou humana.", unit: "%", direction: "higher-is-better", formula: "pull requests revisados / pull requests elegíveis × 100", sourceSignals: ["review_coverage"], cadence: "weekly", baseline: "required", target: "≥ 90%", owner: "Tech Lead", decisionImpact: "promote", guardrail: true, rationale: "Cobertura cria evidência de controle antes do merge." }),
      defineKpi({ key: "engenharia-mttr", domain: "engenharia-it", area: "Confiabilidade", layer: "efficiency", label: "MTTR de incidente", purpose: "Medir a redução do tempo até contenção e recuperação.", unit: "h", direction: "lower-is-better", formula: "soma do tempo de recuperação / incidentes encerrados", sourceSignals: ["mttr_hours"], cadence: "monthly", baseline: "required", target: "≤ 4 h", owner: "SRE Lead", decisionImpact: "promote", guardrail: false, rationale: "Agente operacional precisa reduzir impacto, não apenas gerar tickets." }),
      defineKpi({ key: "engenharia-falha-de-mudanca", domain: "engenharia-it", area: "Release", layer: "governance", label: "Taxa de falha de mudança", purpose: "Limitar releases assistidos que geram rollback ou incidente.", unit: "%", direction: "lower-is-better", formula: "mudanças com rollback ou incidente / mudanças assistidas × 100", sourceSignals: ["change_failure_rate"], cadence: "monthly", baseline: "required", target: "≤ 10%", owner: "Platform Engineering", decisionImpact: "mentor", guardrail: true, rationale: "É um guardrail direto contra expansão insegura do agente." }),
    ],
  },
  {
    key: "risco-financas-rh",
    label: "Risco, Finanças & RH",
    description: "Controle, previsibilidade financeira, decisões responsáveis e impacto nas pessoas.",
    icon: "ShieldCheck",
    metrics: [
      defineKpi({ key: "risco-cobertura-auditoria", domain: "risco-financas-rh", area: "Auditoria", layer: "governance", label: "Cobertura de auditoria", purpose: "Garantir que decisões de risco tenham amostra auditável.", unit: "%", direction: "higher-is-better", formula: "decisões com evidência auditada / decisões elegíveis × 100", sourceSignals: ["audit_coverage"], cadence: "weekly", baseline: "required", target: "≥ 99%", owner: "Risk & Compliance", decisionImpact: "mentor", guardrail: true, rationale: "Sem trilha auditável, o resultado não é defensável." }),
      defineKpi({ key: "risco-exposicao-dado-sensivel", domain: "risco-financas-rh", area: "Privacidade", layer: "governance", label: "Exposição de dado sensível", purpose: "Impedir exposição indevida de dados pessoais ou confidenciais.", unit: "neg.", direction: "lower-is-better", formula: "incidentes confirmados de exposição no período", sourceSignals: ["exposicao_dado_sensivel"], cadence: "per-run", baseline: "not-applicable", target: "0", owner: "Data Protection Officer", decisionImpact: "retire", guardrail: true, rationale: "Um incidente pode sobrepor qualquer ganho de eficiência." }),
      defineKpi({ key: "risco-excecao-politica", domain: "risco-financas-rh", area: "Conformidade", layer: "governance", label: "Taxa de exceção de política", purpose: "Medir decisões que exigem exceção à política vigente.", unit: "%", direction: "lower-is-better", formula: "decisões com exceção / decisões avaliadas × 100", sourceSignals: ["exception_rate"], cadence: "weekly", baseline: "required", target: "≤ 5%", owner: "Risk & Compliance", decisionImpact: "mentor", guardrail: true, rationale: "Exceções frequentes indicam que o agente opera fora do contrato." }),
      defineKpi({ key: "financas-variacao-custo", domain: "risco-financas-rh", area: "Finanças", layer: "efficiency", label: "Variação de custo", purpose: "Controlar diferença entre custo previsto e realizado do agente.", unit: "%", direction: "lower-is-better", formula: "(custo realizado − custo previsto) / custo previsto × 100", sourceSignals: ["cost_variance"], cadence: "monthly", baseline: "required", target: "≤ 10%", owner: "FinOps", decisionImpact: "mentor", guardrail: false, rationale: "Previsibilidade permite escalar sem transformar automação em passivo." }),
      defineKpi({ key: "rh-impacto-experiencia", domain: "risco-financas-rh", area: "Pessoas", layer: "value", label: "Experiência do time", purpose: "Medir se a colaboração com o agente melhora ou degrada o trabalho humano.", unit: "/5", direction: "higher-is-better", formula: "média da pesquisa pós-ciclo com usuários impactados", sourceSignals: ["employee_experience"], cadence: "monthly", baseline: "required", target: "≥ 4/5", owner: "People Operations", decisionImpact: "mentor", guardrail: false, rationale: "Performance de equipe mista inclui o impacto percebido pelas pessoas." }),
    ],
  },
];

export const KPI_DOMAIN_CATALOG: KpiContract[] = KPI_DOMAIN_VERTICALS.flatMap((vertical) => vertical.metrics);

