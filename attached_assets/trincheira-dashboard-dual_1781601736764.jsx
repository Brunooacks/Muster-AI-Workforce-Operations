import React, { useState } from 'react';
import {
  Target, TrendingUp, DollarSign, Clock, BarChart3, Shield,
  AlertTriangle, CheckCircle2, XCircle, ArrowRight, ArrowUpRight,
  ArrowDownRight, Calendar, User, Wrench, ScrollText, Sparkles,
  Lock, Compass, Activity, Award, RefreshCw, Zap, Eye,
  ChevronRight, Circle, Code2, Briefcase, Terminal
} from 'lucide-react';

// ============ TRANSLATION DICTIONARY ============
const i18n = {
  manager: {
    // Header
    headerSubtitle: 'AI Workforce Ops',
    nav: ['Agentes', 'Portfólio', 'Governança', 'Benchmarks'],
    org: 'Organização',

    // Status
    statusAlert: 'Em alerta',
    statusActive: 'Ativo',
    statusProbation: 'Onboarding',
    statusRecalibration: 'Em recalibração',

    // Persona card
    bio: 'Bio',
    sinceLabel: 'Em produção desde',
    versionsLabel: 'gerações · última há',
    executionsLabel: 'execuções no mês',

    // Pillars
    jobDescription: 'Job Description',
    mustDo: 'Deve fazer',
    mustNotDo: 'Não deve fazer',
    responsibility: 'Responsabilidade',
    businessOwner: 'Dono de negócio',
    techOwner: 'Dono técnico',
    governance: 'Governança',
    autonomy: 'Autonomia',
    decidesAlone: 'Decide sozinha',
    escalates: 'Escala para humano',
    limits: 'Limites',
    origin: 'Por que foi criada',
    baseline: 'Baseline pré-Júlia',
    paybackTarget: 'Meta de payback',
    paybackReal: 'Payback real',

    // Section headers
    section01Title: 'Carteira de Trabalho',
    section01Caption: 'Identidade, papel e cadeia de responsabilidade da agente',
    section02Title: 'Avaliação de Desempenho',
    section02Caption: 'Cinco camadas de desempenho · mês corrente',
    section03Title: 'Histórico de Avaliações',
    section03Caption: 'Mesma agente, três trimestres — três decisões diferentes',
    section04Title: 'Detector de Vitória Ilusória',
    section04Caption: 'Padrões antagônicos cruzados — o que dashboards isolados não veem',
    section05Title: 'Recomendação para o Comitê',
    section05Caption: 'Síntese para a reunião de portfólio',

    // Metric layers
    layerEfficacy: 'Eficácia',
    layerEfficacyCaption: 'A agente resolve mesmo?',
    layerEfficiency: 'Eficiência',
    layerEfficiencyCaption: 'A agente é viável?',
    layerAdoption: 'Adoção',
    layerAdoptionCaption: 'A organização usa?',
    layerGovernance: 'Governança',
    layerGovernanceCaption: 'É seguro deixar rodando?',
    layerValue: 'Valor',
    layerValueCaption: 'Vale o investimento?',

    // Severity
    sevCritical: 'Crítica',
    sevHigh: 'Alta',
    sevMedium: 'Média',
    sevStable: 'Estável',

    // Metric names (manager-friendly)
    metricAccuracy: 'Acurácia das decisões',
    metricCompletion: 'Tarefas concluídas',
    metricRepeat: 'Cliente volta em 72h',
    metricTool: 'Uso correto de ferramentas',
    metricHallucination: 'Respostas inventadas',
    metricCPE: 'Custo por atendimento',
    metricLatency: 'Tempo de resposta',
    metricTokens: 'Volume de processamento',
    metricLoop: 'Casos com retrabalho interno',
    metricVolume: 'Volume processado',
    metricEligibility: 'Captura de demanda elegível',
    metricOverride: 'Time corrige a saída',
    metricNPS: 'NPS interno do time',
    metricViolations: 'Tentativas fora do escopo',
    metricAppropEscalation: 'Escalonamento correto',
    metricDrift: 'Mudança de comportamento',
    metricPII: 'Exposição de dado sensível',
    metricAudit: 'Trilha de auditoria',
    metricROI: 'Retorno sobre investimento',
    metricRevenue: 'Receita influenciada',
    metricHours: 'Horas humanas liberadas',
    metricTCO: 'Custo total mensal',
    metricTimeValue: 'Tempo até primeiro valor',

    // Targets (translated where applicable)
    targetGrowing: 'crescimento ≥5% ao mês',
    targetReposition: '≥ 60% reposicionada',

    // Timeline
    monthJun: 'Junho',
    monthAug: 'Agosto',
    monthOct: 'Outubro',
    stateStable: 'Operação estável',
    stateCostRising: 'Custo subindo',
    stateQuality: 'Qualidade comprometida',
    decisionScale: 'Promover',
    decisionRefine: 'Mentoria',
    decisionStop: 'Decisão pendente',
    descScale: 'Triplicar volume nos próximos 60 dias.',
    descRefine: 'Custo exponencial em volume — pausar expansão.',
    descStop: 'ROI alto encobre qualidade comprometida.',

    // Detector
    detector_pattern1_title: 'Vitória ilusória provável',
    detector_pattern1_pattern: 'ROI ↑ + Acurácia ↓',
    detector_pattern1_severity: 'Vitória ilusória crítica',
    detector_pattern1_detected: 'ROI subiu de 11x para 12x enquanto acurácia caiu de 88% para 72%.',
    detector_pattern1_hypothesis: 'A Júlia está fechando conversas mais barato, mas resolvendo errado. O ganho de eficiência está sendo financiado por queda em qualidade — fenômeno típico após simplificação da operação.',
    detector_pattern1_action: 'Auditar 50 conversas marcadas como "resolvidas" nos últimos 14 dias. Calcular taxa real de resolução vs. abandono do cliente.',

    detector_pattern2_title: 'Confiança em queda silenciosa',
    detector_pattern2_pattern: 'Adoção ↑ + Override ↑',
    detector_pattern2_severity: 'Alerta antagônico',
    detector_pattern2_detected: 'Volume cresceu 12% no mês, mas correções do time comercial subiram de 8% para 14%.',
    detector_pattern2_hypothesis: 'O time está usando porque é obrigatório, mas corrigindo cada vez mais a saída. NPS interno caiu 19 pontos — o uso é por inércia, não por confiança.',
    detector_pattern2_action: 'Entrevistar 5 SDRs sobre tipos de correção mais comuns. Provavelmente há um padrão de erro recorrente ainda não diagnosticado.',

    detector_pattern3_title: 'Velocidade às custas de resolução',
    detector_pattern3_pattern: 'Latência ↓ + Repeat contact ↑',
    detector_pattern3_severity: 'Alerta antagônico',
    detector_pattern3_detected: 'Tempo de resposta caiu de 1,5s para 1,2s (-20%) ao mesmo tempo em que clientes voltam em 72h subiu de 13% para 24%.',
    detector_pattern3_hypothesis: 'Respostas mais rápidas, mas clientes voltando — sinal clássico de "resolução de fachada". A agente encerrou a conversa antes da resolução real.',
    detector_pattern3_action: 'Aumentar janela de avaliação de resolução para 7 dias e re-classificar conversas. Avaliar voltar à configuração anterior.',

    detector_pattern4_title: 'Sinal antecedente',
    detector_pattern4_pattern: 'Mudança de comportamento silenciosa',
    detector_pattern4_severity: 'Sinal antecedente',
    detector_pattern4_detected: 'Padrão de respostas mudou significativamente desde 23/set sem ainda impactar acurácia agregada.',
    detector_pattern4_hypothesis: 'Algo mudou no padrão de respostas — provavelmente a recalibração de 14/set. Em geral, mudanças dessa magnitude precedem queda de qualidade em 3–5 semanas.',
    detector_pattern4_action: 'Comparar amostras de saída pré e pós 14/set. Se a mudança degradou estilo de qualificação, voltar à versão anterior antes de afetar conversão.',

    // Recommendation
    recommendedRoute: 'Decisão recomendada',
    decisionTitle: 'Mentoria',
    decisionSubtitle: 'Recalibrar antes de qualquer decisão de aposentar. A agente ainda tem espaço de recuperação — mas o tempo é curto.',
    confidence: 'Confiança do modelo',
    window: 'Janela de execução',
    sponsor: 'Sponsor da ação',
    whyNotStop: 'Por que não aposentar',
    rationale: 'O ROI agregado de 12x e o custo controlado em R$ 0,18 mascaram que acurácia despencou para 72% e clientes voltando dobrou — sinais clássicos da vitória ilusória. Porém, os indicadores sugerem causa específica (mudança de 14/set), o que torna a falha reversível. Aposentar agora desperdiça um ativo organizacional que tem 4 meses de aprendizado capturado e 1.240h liberadas em valor reposicionado.',
    nextActions: 'Próximas três ações',
    action1Title: 'Reverter recalibração',
    action1Detail: 'Voltar para a configuração anterior à mudança de 14/set. Manter job description atual para isolar variável.',
    action2Title: 'Auditoria amostral de 100 conversas pós-reversão',
    action2Detail: 'Re-classificar com janela de 7 dias para resolução. Comparar acurácia real vs. auto-reportada.',
    action3Title: 'Revisão de gate Promover/Mentoria/Aposentar',
    action3Detail: 'Se acurácia real ≥ 82% e clientes voltando ≤ 18%, retomar plano de promoção. Caso contrário, aposentar com post-mortem.',
    in: 'Em',
    owner: 'Responsável',

    // Recommendation footer
    generatedAt: 'Recomendação gerada às 09:42 de hoje · próxima revisão automática em 24h',
    approvePlan: 'Aprovar plano',
    disagree: 'Discordar do sistema',
    exportCommittee: 'Exportar para comitê',

    // Footer
    quote: '"Quem lê só um indicador, comemora. Quem lê o sistema, intervém."',
  },

  technical: {
    // Header
    headerSubtitle: 'Agent Observability Platform',
    nav: ['Agents', 'Fleet', 'Compliance', 'Benchmarks'],
    org: 'Workspace',

    // Status
    statusAlert: 'Degraded',
    statusActive: 'Healthy',
    statusProbation: 'Canary',
    statusRecalibration: 'Recalibrating',

    // Persona
    bio: 'Description',
    sinceLabel: 'Deployed since',
    versionsLabel: 'versions · last',
    executionsLabel: 'executions / month',

    // Pillars
    jobDescription: 'Spec / Boundaries',
    mustDo: 'In-scope tasks',
    mustNotDo: 'Out-of-scope',
    responsibility: 'Ownership',
    businessOwner: 'Business owner',
    techOwner: 'Tech owner',
    governance: 'Governance',
    autonomy: 'Autonomy config',
    decidesAlone: 'Autonomous decisions',
    escalates: 'Human escalation triggers',
    limits: 'Operational limits',
    origin: 'Business case',
    baseline: 'Pre-agent baseline',
    paybackTarget: 'Target payback',
    paybackReal: 'Actual payback',

    // Section headers
    section01Title: 'Agent Registry Record',
    section01Caption: 'ID, ownership chain, autonomy boundaries',
    section02Title: 'Metrics Dashboard',
    section02Caption: 'Six-layer KPI framework · current window',
    section03Title: 'Performance Trajectory',
    section03Caption: 'Same agent, three temporal snapshots',
    section04Title: 'Antagonistic Pattern Detector',
    section04Caption: 'Cross-metric anomaly patterns invisible to single-metric dashboards',
    section05Title: 'System Recommendation',
    section05Caption: 'Auto-generated routing decision with evidence',

    // Metric layers
    layerEfficacy: 'Efficacy',
    layerEfficacyCaption: 'Does the agent actually resolve?',
    layerEfficiency: 'Efficiency',
    layerEfficiencyCaption: 'Is unit economics viable?',
    layerAdoption: 'Adoption',
    layerAdoptionCaption: 'Is the org actually using it?',
    layerGovernance: 'Governance',
    layerGovernanceCaption: 'Is it safe in production?',
    layerValue: 'Value',
    layerValueCaption: 'Worth the investment?',

    // Severity
    sevCritical: 'Critical',
    sevHigh: 'High',
    sevMedium: 'Medium',
    sevStable: 'Stable',

    // Metric names
    metricAccuracy: 'Groundedness',
    metricCompletion: 'Task completion',
    metricRepeat: 'Repeat contact (72h)',
    metricTool: 'Tool selection accuracy',
    metricHallucination: 'Hallucination rate',
    metricCPE: 'Cost per execution',
    metricLatency: 'Latency P95',
    metricTokens: 'Tokens / task',
    metricLoop: 'Loop rate (>3 it.)',
    metricVolume: 'Execution volume',
    metricEligibility: '% eligibility captured',
    metricOverride: 'Override rate',
    metricNPS: 'Internal NPS',
    metricViolations: 'Policy violations',
    metricAppropEscalation: 'Appropriate escalation',
    metricDrift: 'Behavioral drift',
    metricPII: 'Sensitive data exposure',
    metricAudit: 'Audit trail completeness',
    metricROI: 'ROI',
    metricRevenue: 'Influenced revenue',
    metricHours: 'Human hours freed',
    metricTCO: 'Effective TCO',
    metricTimeValue: 'Time to value',

    targetGrowing: 'growth ≥5% MoM',
    targetReposition: '≥ 60% repositioned',

    // Timeline
    monthJun: 'June',
    monthAug: 'August',
    monthOct: 'October',
    stateStable: 'Stable operation',
    stateCostRising: 'Cost spike',
    stateQuality: 'Quality regression',
    decisionScale: 'Scale',
    decisionRefine: 'Recalibrate',
    decisionStop: 'Decision pending',
    descScale: '3x volume target over next 60 days.',
    descRefine: 'Exponential cost in volume — pause expansion.',
    descStop: 'High ROI masking quality regression.',

    // Detector
    detector_pattern1_title: 'Likely illusory victory',
    detector_pattern1_pattern: 'ROI ↑ + Groundedness ↓',
    detector_pattern1_severity: 'Critical illusory victory',
    detector_pattern1_detected: 'ROI rose from 11x to 12x while groundedness dropped from 88% to 72%.',
    detector_pattern1_hypothesis: 'Agent is closing sessions cheaper but answering incorrectly. Efficiency gain financed by quality loss — classic pattern after model downgrade or prompt simplification.',
    detector_pattern1_action: 'Audit 50 conversations marked "resolved" in last 14 days. Compute true resolution rate vs. user abandonment.',

    detector_pattern2_title: 'Silent confidence decay',
    detector_pattern2_pattern: 'Adoption ↑ + Override ↑',
    detector_pattern2_severity: 'Antagonistic pattern',
    detector_pattern2_detected: 'Volume grew 12% MoM, but commercial team overrides rose from 8% to 14%.',
    detector_pattern2_hypothesis: 'Team uses by mandate, not by trust. Internal NPS dropped 19 points — usage is inertial, not endorsement.',
    detector_pattern2_action: 'Interview 5 SDRs about most common override types. Likely a recurring error pattern not yet diagnosed.',

    detector_pattern3_title: 'Speed at the cost of resolution',
    detector_pattern3_pattern: 'Latency ↓ + Repeat ↑',
    detector_pattern3_severity: 'Antagonistic pattern',
    detector_pattern3_detected: 'P95 latency dropped from 1.5s to 1.2s (-20%) while 72h repeat contact rose from 13% to 24%.',
    detector_pattern3_hypothesis: 'Faster responses but users returning — classic false-containment signal. Agent terminated session before true resolution.',
    detector_pattern3_action: 'Extend resolution evaluation window to 7 days and reclassify. Consider rollback to prior version.',

    detector_pattern4_title: 'Leading indicator',
    detector_pattern4_pattern: 'Behavioral drift without immediate degradation',
    detector_pattern4_severity: 'Leading indicator',
    detector_pattern4_detected: 'Output distribution shifted 2.3σ since 23/Sep without yet impacting aggregate accuracy.',
    detector_pattern4_hypothesis: 'Pattern shift — likely the model swap on 14/Sep. Drift of this magnitude typically precedes quality degradation in 3–5 weeks.',
    detector_pattern4_action: 'Compare pre/post 14/Sep output samples. If qualification style degraded, rollback before it hits conversion.',

    // Recommendation
    recommendedRoute: 'Recommended route',
    decisionTitle: 'Recalibrate',
    decisionSubtitle: 'Recalibrate before any decommissioning decision. Agent still has recovery space — but the window is short.',
    confidence: 'Model confidence',
    window: 'Execution window',
    sponsor: 'Action sponsor',
    whyNotStop: 'Why not decommission',
    rationale: 'Aggregate ROI of 12x and controlled cost of R$ 0.18 mask that groundedness dropped to 72% and repeat contact doubled — classic illusory victory signals. However, drift indicators suggest specific cause (model swap on 14/Sep), making the failure reversible. Decommissioning now wastes an organizational asset with 4 months of captured learning and 1,240h of repositioned human work.',
    nextActions: 'Next three actions',
    action1Title: 'Model rollback',
    action1Detail: 'Revert to version prior to 14/Sep. Keep prompt and tools fixed to isolate variable.',
    action2Title: 'Sample audit of 100 post-rollback conversations',
    action2Detail: 'Re-classify with 7-day resolution window. Compare actual vs. auto-reported accuracy.',
    action3Title: 'Gate review: Scale/Recalibrate/Decommission',
    action3Detail: 'If true accuracy ≥ 82% and repeat ≤ 18%, resume scaling plan. Otherwise, decommission with post-mortem.',
    in: 'In',
    owner: 'Owner',

    generatedAt: 'Recommendation generated 09:42 today · next auto-review in 24h',
    approvePlan: 'Approve plan',
    disagree: 'Override system',
    exportCommittee: 'Export traces',

    quote: '"Read one metric, celebrate. Read the system, intervene."',
  },
};

export default function TrincheiraDualToggle() {
  const [audience, setAudience] = useState('manager');
  const t = i18n[audience];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .font-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .paper-bg {
          background-color: #F4EFE3;
          background-image:
            radial-gradient(at 12% 18%, rgba(45, 95, 79, 0.04) 0px, transparent 50%),
            radial-gradient(at 88% 82%, rgba(179, 58, 42, 0.03) 0px, transparent 50%);
        }
        .paper-card {
          background: linear-gradient(180deg, #FDFAF3 0%, #FBF6EB 100%);
          box-shadow: 0 1px 0 rgba(31, 46, 40, 0.04), 0 8px 24px -12px rgba(31, 46, 40, 0.08);
        }
        .grain::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
          opacity: 0.03;
          pointer-events: none;
          mix-blend-mode: multiply;
        }
        .number-display {
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 500;
          letter-spacing: -0.02em;
        }
        .divider-thin {
          height: 1px;
          background: linear-gradient(90deg, transparent, #C9BEAA 20%, #C9BEAA 80%, transparent);
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .pulse-dot { animation: pulse-soft 2.5s ease-in-out infinite; }
        .toggle-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .fade-in {
          animation: fade-in 0.4s ease;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="paper-bg min-h-screen font-body text-stone-900">
        {/* ==================== HEADER WITH TOGGLE ==================== */}
        <header className="border-b border-stone-300/60 bg-[#FAF5E9]/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-10">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl tracking-tight" style={{ color: '#1F2E28' }}>
                  Trincheira
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium">
                  {t.headerSubtitle}
                </span>
              </div>
              <nav className="hidden md:flex items-center gap-7 text-sm text-stone-600">
                <span className="text-stone-900 border-b border-stone-900 pb-1">{t.nav[0]}</span>
                {t.nav.slice(1).map((n, i) => (
                  <span key={i} className="hover:text-stone-900 cursor-pointer transition-colors">{n}</span>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-5">
              {/* TOGGLE DE LINGUAGEM */}
              <div className="flex items-center gap-0 p-1 rounded-full" style={{ background: '#E8E4D8' }}>
                <button
                  onClick={() => setAudience('manager')}
                  className={`toggle-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${
                    audience === 'manager'
                      ? 'bg-[#1F2E28] text-[#FAF5E9] shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span className="font-medium">Gestor</span>
                </button>
                <button
                  onClick={() => setAudience('technical')}
                  className={`toggle-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${
                    audience === 'technical'
                      ? 'bg-[#1F2E28] text-[#FAF5E9] shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="font-medium">Platform</span>
                </button>
              </div>

              <div className="text-right">
                <div className="text-xs text-stone-500 uppercase tracking-wider">{t.org}</div>
                <div className="text-sm font-medium">Veridian Capital · BR</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#2D5F4F] text-white flex items-center justify-center text-xs font-medium">
                RS
              </div>
            </div>
          </div>
        </header>

        {/* CONTEXT BANNER */}
        <div className="max-w-[1400px] mx-auto px-8 pt-4">
          <div className="text-[11px] text-stone-500 italic flex items-center gap-2">
            {audience === 'manager' ? (
              <><Briefcase className="w-3 h-3" /> Vista de gestor — linguagem de pessoas, decisões e ROI</>
            ) : (
              <><Terminal className="w-3 h-3" /> Platform view — engineering vocabulary, metrics & traces</>
            )}
          </div>
        </div>

        <div className="fade-in" key={audience}>
          {/* BREADCRUMB */}
          <div className="max-w-[1400px] mx-auto px-8 pt-4">
            <div className="text-xs uppercase tracking-[0.18em] text-stone-500 mb-3 flex items-center gap-2">
              <span>{audience === 'manager' ? 'Portfólio' : 'Fleet'}</span>
              <ChevronRight className="w-3 h-3" />
              <span>{audience === 'manager' ? 'Comercial' : 'commercial'}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-stone-800">
                {audience === 'manager' ? 'Júlia · Pré-qualificação Inbound' : 'AGT-COM-007 · julia-prequal-inbound'}
              </span>
            </div>
          </div>

          {/* ============= 01: CARTEIRA / REGISTRY ============= */}
          <section className="max-w-[1400px] mx-auto px-8 mb-10">
            <SectionHeader number="01" title={t.section01Title} caption={t.section01Caption} />

            <div className="paper-card rounded-lg relative grain overflow-hidden">
              <div className="p-8 pb-6 grid grid-cols-12 gap-8 items-start border-b border-stone-300/60">
                <div className="col-span-2 flex flex-col items-start">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center font-display text-4xl text-[#FAF5E9] mb-3"
                       style={{ background: 'linear-gradient(135deg, #2D5F4F 0%, #1F2E28 100%)' }}>
                    {audience === 'manager' ? 'J' : <Code2 className="w-8 h-8" />}
                  </div>
                  <span className="pill" style={{
                    background: '#C5762E', color: '#FDFAF3',
                    fontSize: '9.5px', letterSpacing: '0.08em',
                    textTransform: 'uppercase', fontWeight: 600,
                    padding: '3px 8px', borderRadius: '100px'
                  }}>
                    {t.statusAlert}
                  </span>
                </div>

                <div className="col-span-10">
                  <div className="flex items-baseline gap-3 mb-1">
                    <h1 className="font-display text-5xl tracking-tight" style={{ color: '#1F2E28' }}>
                      {audience === 'manager' ? 'Júlia' : 'AGT-COM-007'}
                    </h1>
                    <span className="text-stone-500 text-sm font-mono">
                      {audience === 'manager' ? 'AGT-COM-007 · v3.2' : 'v3.2 · julia-prequal-inbound'}
                    </span>
                  </div>
                  <p className="font-display italic text-xl text-stone-700 mb-5 leading-snug max-w-3xl">
                    {audience === 'manager'
                      ? '"Qualifico leads inbound em até 90 segundos para o time comercial não perder janela."'
                      : 'Inbound lead qualification agent. Target SLA: 90s end-to-end. Outputs: BANT scoring + opportunity creation in CRM.'}
                  </p>
                  <div className="flex items-center gap-6 text-xs text-stone-500">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {t.sinceLabel} 14/jun/2026</span>
                    <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> 14 {t.versionsLabel} 9d</span>
                    <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> 14.230 {t.executionsLabel}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 divide-x divide-stone-300/60">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ScrollText className="w-4 h-4 text-[#2D5F4F]" />
                    <h3 className="font-display text-base font-medium tracking-tight">{t.jobDescription}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">{t.mustDo}</div>
                      <ul className="space-y-1 text-stone-700">
                        {(audience === 'manager'
                          ? ['Coletar BANT do lead', 'Agendar reunião com SDR', 'Atualizar CRM em tempo real']
                          : ['collect_bant(lead)', 'schedule_meeting(sdr_id)', 'update_crm(opportunity)']
                        ).map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <CheckCircle2 className="w-3 h-3 text-[#2D5F4F] mt-1 flex-shrink-0" />
                            <span className={audience === 'technical' ? 'font-mono text-xs' : ''}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">{t.mustNotDo}</div>
                      <ul className="space-y-1 text-stone-700">
                        {(audience === 'manager'
                          ? ['Cotar preço', 'Discutir contratos']
                          : ['quote_price()', 'discuss_contract()']
                        ).map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <XCircle className="w-3 h-3 text-[#B33A2A] mt-1 flex-shrink-0" />
                            <span className={audience === 'technical' ? 'font-mono text-xs' : ''}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-4 h-4 text-[#2D5F4F]" />
                    <h3 className="font-display text-base font-medium tracking-tight">{t.responsibility}</h3>
                  </div>
                  <div className="space-y-3.5 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{t.businessOwner}</div>
                      <div className="text-stone-800 font-medium">Renata Silva</div>
                      <div className="text-xs text-stone-500">
                        {audience === 'manager' ? 'Head of Growth · responde por ROI' : 'rsilva@veridian.com · owns ROI signal'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{t.techOwner}</div>
                      <div className="text-stone-800 font-medium">Marcos Tavares</div>
                      <div className="text-xs text-stone-500">
                        {audience === 'manager' ? 'Lead AI Eng · responde por uptime' : 'mtavares@veridian.com · owns SLO'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{t.governance}</div>
                      <div className="text-stone-800 font-medium">
                        {audience === 'manager' ? 'Comitê de IA' : 'ai-governance@veridian.com'}
                      </div>
                      <div className="text-xs text-stone-500">
                        {audience === 'manager' ? 'Audita trimestralmente' : 'Quarterly audit cadence'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Compass className="w-4 h-4 text-[#2D5F4F]" />
                    <h3 className="font-display text-base font-medium tracking-tight">{t.autonomy}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">{t.decidesAlone}</div>
                      <p className="text-stone-700 text-[13px] leading-snug">
                        {audience === 'manager'
                          ? 'Qualificação BANT, scheduling, criação de oportunidade até R$ 50k de ARR projetado'
                          : 'bant_qualification, meeting_scheduling, opportunity_create (projected_arr < 50000)'}
                      </p>
                    </div>
                    <div className="divider-thin" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">{t.escalates}</div>
                      <p className="text-stone-700 text-[13px] leading-snug">
                        {audience === 'manager'
                          ? 'Lead com ARR > R$ 50k, lead enterprise, pedido de demo técnica'
                          : 'projected_arr >= 50000 || segment == "enterprise" || intent == "technical_demo"'}
                      </p>
                    </div>
                    <div className="divider-thin" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">{t.limits}</div>
                      <p className="text-stone-700 text-[13px] leading-snug">
                        {audience === 'manager'
                          ? 'Máx. 3 follow-ups · Custo teto R$ 0,40/execução · 7 ferramentas autorizadas'
                          : 'max_followups=3, cost_ceiling=0.40_BRL, allowed_tools=[7]'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[#2D5F4F]" />
                    <h3 className="font-display text-base font-medium tracking-tight">{t.origin}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-stone-700 text-[13px] leading-snug italic">
                      {audience === 'manager'
                        ? '"SDRs estavam levando 4h para responder leads inbound — perdendo 38% da janela quente de contato."'
                        : 'Baseline pre-agent: 4h median response time, 38% drop-off in hot-window contact rate.'}
                    </p>
                    <div className="divider-thin" />
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-stone-500">{t.baseline}</span>
                        <span className="font-mono text-stone-800">
                          {audience === 'manager' ? '4h · 38% perda' : '4h · 38% drop'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-stone-500">{t.paybackTarget}</span>
                        <span className="font-mono text-stone-800">
                          {audience === 'manager' ? '90 dias' : '90d'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-stone-500">{t.paybackReal}</span>
                        <span className="font-mono text-[#2D5F4F] font-semibold">
                          {audience === 'manager' ? '47 dias' : '47d'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============= 02: METRICS ============= */}
          <section className="max-w-[1400px] mx-auto px-8 mb-10">
            <SectionHeader number="02" title={t.section02Title} caption={t.section02Caption} />

            <div className="grid grid-cols-12 gap-4">
              <MetricLayer
                title={t.layerEfficacy} subtitle={t.layerEfficacyCaption} icon={Target} span={4} t={t}
                metrics={[
                  { name: t.metricAccuracy, value: '72%', target: '≥ 85%', severity: 'critical', trend: 'down', delta: '-16pp em 60d' },
                  { name: t.metricCompletion, value: '91%', target: '≥ 90%', severity: 'stable', trend: 'flat' },
                  { name: t.metricRepeat, value: '24%', target: '≤ 15%', severity: 'critical', trend: 'up', delta: '+11pp' },
                  { name: t.metricTool, value: '88%', target: '≥ 95%', severity: 'high', trend: 'down' },
                  { name: t.metricHallucination, value: '3.2%', target: '≤ 2%', severity: 'high', trend: 'up' },
                ]}
              />
              <MetricLayer
                title={t.layerEfficiency} subtitle={t.layerEfficiencyCaption} icon={Zap} span={4} t={t}
                metrics={[
                  { name: t.metricCPE, value: 'R$ 0,18', target: 'R$ 0,10–0,40', severity: 'stable', trend: 'down' },
                  { name: t.metricLatency, value: '1,2 s', target: '< 3 s', severity: 'stable', trend: 'down' },
                  { name: t.metricTokens, value: '4,8k', target: '±20%', severity: 'stable', trend: 'flat' },
                  { name: t.metricLoop, value: '2%', target: '≤ 5%', severity: 'stable', trend: 'flat' },
                ]}
              />
              <MetricLayer
                title={t.layerAdoption} subtitle={t.layerAdoptionCaption} icon={TrendingUp} span={4} t={t}
                metrics={[
                  { name: t.metricVolume, value: '14.230', target: t.targetGrowing, severity: 'stable', trend: 'up', delta: '+12%' },
                  { name: t.metricEligibility, value: '83%', target: '≥ 70%', severity: 'stable', trend: 'up' },
                  { name: t.metricOverride, value: '14%', target: '≤ 8%', severity: 'high', trend: 'up', delta: '+6pp' },
                  { name: t.metricNPS, value: '28', target: '≥ 40', severity: 'high', trend: 'down', delta: '-19' },
                ]}
              />
              <MetricLayer
                title={t.layerGovernance} subtitle={t.layerGovernanceCaption} icon={Shield} span={6} t={t}
                metrics={[
                  { name: t.metricViolations, value: '2', target: audience === 'manager' ? '0 sem bloqueio' : '0 unblocked', severity: 'high', trend: 'up' },
                  { name: t.metricAppropEscalation, value: '64%', target: '≥ 80%', severity: 'critical', trend: 'down', delta: '-21pp' },
                  { name: t.metricDrift, value: audience === 'manager' ? 'Alto' : 'High (2.3σ)', target: audience === 'manager' ? '< limiar' : '< 2σ', severity: 'critical', trend: 'up' },
                  { name: t.metricPII, value: '0', target: '0', severity: 'stable', trend: 'flat' },
                  { name: t.metricAudit, value: '99,8%', target: '≥ 99%', severity: 'stable', trend: 'flat' },
                ]}
              />
              <MetricLayer
                title={t.layerValue} subtitle={t.layerValueCaption} icon={Award} span={6} t={t}
                metrics={[
                  { name: t.metricROI, value: '12x', target: '≥ 3x · 60–90d', severity: 'stable', trend: 'up', delta: '+1x', warning: audience === 'manager' ? 'Valor inflado por queda em qualidade' : 'Inflated by quality regression' },
                  { name: t.metricRevenue, value: 'R$ 2,1M', target: '—', severity: 'stable', trend: 'up' },
                  { name: t.metricHours, value: '1.240h', target: t.targetReposition, severity: 'medium', trend: 'flat' },
                  { name: t.metricTCO, value: 'R$ 18,2k', target: '—', severity: 'stable', trend: 'flat' },
                  { name: t.metricTimeValue, value: audience === 'manager' ? '32 dias' : '32d', target: '≤ 45d', severity: 'stable', trend: 'flat' },
                ]}
              />
            </div>
          </section>

          {/* ============= 03: TIMELINE ============= */}
          <section className="max-w-[1400px] mx-auto px-8 mb-10">
            <SectionHeader number="03" title={t.section03Title} caption={t.section03Caption} />

            <div className="paper-card rounded-lg p-8 relative grain">
              <div className="grid grid-cols-3 gap-8">
                <TimelineMonth
                  month={t.monthJun} state={t.stateStable} stateColor="#2D5F4F"
                  metrics={[
                    { label: t.metricAccuracy, value: '89%' },
                    { label: audience === 'manager' ? 'Escalonamento' : 'Escalation', value: '7%' },
                    { label: 'CPE', value: 'R$ 0,12' },
                    { label: audience === 'manager' ? 'Tempo resp.' : 'Latency', value: '1,5 s' },
                    { label: 'ROI', value: '15x' },
                  ]}
                  decisionLabel={t.decisionScale}
                  decisionColor="#2D5F4F" decisionBg="#C5D6CE"
                  decisionDescription={t.descScale} isPast
                />
                <TimelineMonth
                  month={t.monthAug} state={t.stateCostRising} stateColor="#C5762E"
                  metrics={[
                    { label: t.metricAccuracy, value: '88%' },
                    { label: audience === 'manager' ? 'Escalonamento' : 'Escalation', value: '12%', alert: true },
                    { label: 'CPE', value: 'R$ 0,38', alert: true },
                    { label: audience === 'manager' ? 'Tempo resp.' : 'Latency', value: '1,4 s' },
                    { label: 'ROI', value: '11x' },
                  ]}
                  decisionLabel={t.decisionRefine}
                  decisionColor="#FAF5E9" decisionBg="#C5762E"
                  decisionDescription={t.descRefine} isPast
                />
                <TimelineMonth
                  month={t.monthOct} state={t.stateQuality} stateColor="#B33A2A"
                  metrics={[
                    { label: t.metricAccuracy, value: '72%', alert: true },
                    { label: audience === 'manager' ? 'Escalonamento' : 'Escalation', value: '8%' },
                    { label: 'CPE', value: 'R$ 0,18' },
                    { label: audience === 'manager' ? 'Tempo resp.' : 'Latency', value: '1,2 s' },
                    { label: 'ROI', value: '12x' },
                  ]}
                  decisionLabel={t.decisionStop}
                  decisionColor="#FAF5E9" decisionBg="#1F2E28"
                  decisionDescription={t.descStop} isCurrent
                />
              </div>

              <div className="divider-thin my-8" />

              <p className="font-display italic text-center text-stone-600 text-sm">
                {audience === 'manager'
                  ? 'O mesmo painel. A leitura sistêmica é que muda a decisão.'
                  : 'Same dashboard. Systemic reading changes the call.'}
              </p>
            </div>
          </section>

          {/* ============= 04: DETECTOR ============= */}
          <section className="max-w-[1400px] mx-auto px-8 mb-10">
            <SectionHeader number="04" title={t.section04Title} caption={t.section04Caption} />

            <div className="grid grid-cols-2 gap-4">
              <IllusoryAlert
                severity="critical"
                pattern={t.detector_pattern1_pattern}
                title={t.detector_pattern1_title}
                severityLabel={t.detector_pattern1_severity}
                detected={t.detector_pattern1_detected}
                hypothesis={t.detector_pattern1_hypothesis}
                action={t.detector_pattern1_action}
                t={t}
                audience={audience}
              />
              <IllusoryAlert
                severity="high"
                pattern={t.detector_pattern2_pattern}
                title={t.detector_pattern2_title}
                severityLabel={t.detector_pattern2_severity}
                detected={t.detector_pattern2_detected}
                hypothesis={t.detector_pattern2_hypothesis}
                action={t.detector_pattern2_action}
                t={t}
                audience={audience}
              />
              <IllusoryAlert
                severity="high"
                pattern={t.detector_pattern3_pattern}
                title={t.detector_pattern3_title}
                severityLabel={t.detector_pattern3_severity}
                detected={t.detector_pattern3_detected}
                hypothesis={t.detector_pattern3_hypothesis}
                action={t.detector_pattern3_action}
                t={t}
                audience={audience}
              />
              <IllusoryAlert
                severity="medium"
                pattern={t.detector_pattern4_pattern}
                title={t.detector_pattern4_title}
                severityLabel={t.detector_pattern4_severity}
                detected={t.detector_pattern4_detected}
                hypothesis={t.detector_pattern4_hypothesis}
                action={t.detector_pattern4_action}
                t={t}
                audience={audience}
              />
            </div>
          </section>

          {/* ============= 05: RECOMMENDATION ============= */}
          <section className="max-w-[1400px] mx-auto px-8 mb-16">
            <SectionHeader number="05" title={t.section05Title} caption={t.section05Caption} />

            <div className="paper-card rounded-lg overflow-hidden relative grain">
              <div className="grid grid-cols-12">
                <div className="col-span-4 p-8 border-r border-stone-300/60" style={{ background: 'linear-gradient(135deg, #FDF8EC 0%, #F4EFE3 100%)' }}>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-3">{t.recommendedRoute}</div>
                  <div className="font-display text-5xl tracking-tight mb-4 leading-none" style={{ color: '#C5762E' }}>
                    {t.decisionTitle}
                  </div>
                  <div className="text-sm text-stone-600 mb-6">
                    {t.decisionSubtitle}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t.confidence}</span>
                      <span className="font-mono font-medium">87%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t.window}</span>
                      <span className="font-mono font-medium">14 {audience === 'manager' ? 'dias' : 'd'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t.sponsor}</span>
                      <span className="font-medium">Marcos Tavares</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-8 p-8">
                  <div className="mb-7">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2.5">{t.whyNotStop}</div>
                    <p className="text-[15px] text-stone-700 leading-relaxed">{t.rationale}</p>
                  </div>

                  <div className="divider-thin mb-6" />

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-4">{t.nextActions}</div>
                    <div className="space-y-3.5">
                      <ActionStep n="1" window={audience === 'manager' ? '48 horas' : '48h'} title={t.action1Title} detail={t.action1Detail} owner="Marcos Tavares" t={t} />
                      <ActionStep n="2" window={audience === 'manager' ? '7 dias' : '7d'} title={t.action2Title} detail={t.action2Detail} owner="Renata + Marcos" t={t} />
                      <ActionStep n="3" window={audience === 'manager' ? '14 dias' : '14d'} title={t.action3Title} detail={t.action3Detail} owner={audience === 'manager' ? 'Comitê de IA' : 'AI Governance'} t={t} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 border-t border-stone-300/60 flex items-center justify-between text-xs text-stone-500" style={{ background: '#FBF6EB' }}>
                <span className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  {t.generatedAt}
                </span>
                <span className="flex items-center gap-4">
                  <button className="hover:text-stone-800 transition-colors">{t.approvePlan}</button>
                  <span className="text-stone-300">|</span>
                  <button className="hover:text-stone-800 transition-colors">{t.disagree}</button>
                  <span className="text-stone-300">|</span>
                  <button className="hover:text-stone-800 transition-colors">{t.exportCommittee}</button>
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="border-t border-stone-300/60 py-6 mt-10">
          <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between text-xs text-stone-500">
            <span className="font-display italic">{t.quote}</span>
            <span>Trincheira · protótipo dual · {audience === 'manager' ? 'vista de gestor' : 'platform view'}</span>
          </div>
        </footer>
      </div>
    </>
  );
}

// ============= AUX COMPONENTS =============

function SectionHeader({ number, title, caption }) {
  return (
    <div className="flex items-baseline gap-5 mb-5">
      <span className="font-display italic text-2xl text-stone-400">{number}</span>
      <div>
        <h2 className="font-display text-2xl tracking-tight" style={{ color: '#1F2E28' }}>{title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{caption}</p>
      </div>
    </div>
  );
}

function MetricLayer({ title, subtitle, icon: Icon, metrics, span, t }) {
  const spanClass = { 4: 'col-span-4', 6: 'col-span-6', 12: 'col-span-12' }[span];
  return (
    <div className={`${spanClass} paper-card rounded-lg p-5 relative grain`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-[#2D5F4F]" />
          <div>
            <h3 className="font-display text-lg font-medium tracking-tight leading-none">{title}</h3>
            <p className="text-[11px] text-stone-500 mt-1">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {metrics.map((m, i) => <MetricRow key={i} {...m} t={t} />)}
      </div>
    </div>
  );
}

function MetricRow({ name, value, target, severity, trend, delta, warning, t }) {
  const sevColors = {
    critical: { bg: '#B33A2A', label: t.sevCritical },
    high: { bg: '#C5762E', label: t.sevHigh },
    medium: { bg: '#D9B36A', label: t.sevMedium },
    stable: { bg: '#9BBFAE', label: t.sevStable },
  };
  const sev = sevColors[severity];
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Circle;

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2 border-b border-stone-200/70 last:border-0">
      <div className="col-span-5">
        <div className="text-[13px] text-stone-800 leading-tight">{name}</div>
        <div className="text-[10px] text-stone-500 font-mono mt-0.5">{target}</div>
      </div>
      <div className="col-span-4 flex items-baseline gap-1.5">
        <span className="number-display text-base text-stone-900">{value}</span>
        {trend !== 'flat' && (
          <TrendIcon className="w-3 h-3 text-stone-600" />
        )}
        {delta && (
          <span className={`text-[10px] font-mono ${severity === 'critical' || severity === 'high' ? 'text-[#B33A2A]' : 'text-[#2D5F4F]'}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="col-span-3 flex justify-end">
        <span
          className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
          style={{ background: sev.bg, color: severity === 'medium' || severity === 'stable' ? '#1F2E28' : '#FAF5E9' }}
        >
          {sev.label}
        </span>
      </div>
      {warning && (
        <div className="col-span-12 mt-1 flex items-start gap-1.5 text-[11px] italic text-[#B33A2A]">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}

function TimelineMonth({ month, state, stateColor, metrics, decisionLabel, decisionColor, decisionBg, decisionDescription, isPast, isCurrent }) {
  return (
    <div className={`flex flex-col ${isCurrent ? '' : 'opacity-80'}`}>
      <div className="mb-4">
        <h3 className="font-display text-3xl tracking-tight mb-1" style={{ color: stateColor }}>{month}</h3>
        <div className="text-xs font-medium" style={{ color: stateColor }}>{state}</div>
      </div>

      <div className="space-y-2 mb-5 border-t border-stone-300/60 pt-3">
        {metrics.map((m, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-stone-600 text-[13px]">{m.label}</span>
            <span className={`number-display font-mono ${m.alert ? 'text-[#B33A2A] font-semibold' : 'text-stone-900'}`}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      <div
        className="px-4 py-3 rounded text-center font-semibold tracking-wider text-xs uppercase mb-3"
        style={{ background: decisionBg, color: decisionColor, letterSpacing: '0.15em' }}
      >
        {decisionLabel}
        {isCurrent && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-current pulse-dot" />}
      </div>

      <p className="text-[12px] text-stone-600 italic leading-snug">{decisionDescription}</p>
    </div>
  );
}

function IllusoryAlert({ severity, pattern, title, severityLabel, detected, hypothesis, action, t, audience }) {
  const sevStyles = {
    critical: { border: '#B33A2A', labelBg: '#B33A2A', labelColor: '#FAF5E9' },
    high: { border: '#C5762E', labelBg: '#C5762E', labelColor: '#FAF5E9' },
    medium: { border: '#D9B36A', labelBg: '#D9B36A', labelColor: '#1F2E28' },
  };
  const s = sevStyles[severity];

  const labels = audience === 'manager' ? {
    detected: 'Detectado', hypothesis: 'Hipótese', action: 'Recomendação'
  } : {
    detected: 'Detected', hypothesis: 'Hypothesis', action: 'Action'
  };

  return (
    <div className="paper-card rounded-lg p-5 relative grain" style={{ borderLeft: `3px solid ${s.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-stone-500">{pattern}</span>
        <span
          className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
          style={{ background: s.labelBg, color: s.labelColor }}
        >
          {severityLabel}
        </span>
      </div>
      <h3 className="font-display text-xl tracking-tight mb-3 leading-tight" style={{ color: '#1F2E28' }}>
        {title}
      </h3>
      <div className="space-y-3 text-[13px]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{labels.detected}</div>
          <p className="text-stone-700 leading-snug">{detected}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{labels.hypothesis}</div>
          <p className="text-stone-700 leading-snug">{hypothesis}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{labels.action}</div>
          <p className="text-stone-800 leading-snug font-medium">{action}</p>
        </div>
      </div>
    </div>
  );
}

function ActionStep({ n, window, title, detail, owner, t }) {
  return (
    <div className="grid grid-cols-12 gap-4 items-start">
      <div className="col-span-1">
        <div className="w-8 h-8 rounded-full bg-[#1F2E28] text-[#FAF5E9] flex items-center justify-center font-display text-base">
          {n}
        </div>
      </div>
      <div className="col-span-2 pt-1.5">
        <div className="text-[10px] uppercase tracking-wider text-stone-500">{t.in}</div>
        <div className="font-mono text-sm text-stone-800">{window}</div>
      </div>
      <div className="col-span-7 pt-1">
        <div className="font-medium text-stone-900 text-sm mb-0.5">{title}</div>
        <div className="text-[12px] text-stone-600 leading-snug">{detail}</div>
      </div>
      <div className="col-span-2 pt-1.5 text-right">
        <div className="text-[10px] uppercase tracking-wider text-stone-500">{t.owner}</div>
        <div className="text-xs text-stone-800 font-medium">{owner}</div>
      </div>
    </div>
  );
}
