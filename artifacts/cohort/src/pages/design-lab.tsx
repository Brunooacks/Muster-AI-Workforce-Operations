import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cloud,
  Command,
  GitBranch,
  Layers3,
  LockKeyhole,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Eyebrow, Pill } from "@/components/cohort";
import { cn } from "@/lib/utils";

type JourneyId = "command" | "integrations" | "agent" | "alerts";
type CommandMode = "console" | "signal" | "briefing";

const journeys: Array<{ id: JourneyId; label: string; description: string; icon: typeof Command }> = [
  { id: "command", label: "Comando", description: "Priorizar a operação em uma única página.", icon: Command },
  { id: "integrations", label: "Integrações", description: "Conectar, descobrir, revisar e admitir.", icon: GitBranch },
  { id: "agent", label: "Agente", description: "Entender identidade, valor e evolução.", icon: Bot },
  { id: "alerts", label: "Alertas", description: "Transformar sinais em compromissos.", icon: CircleAlert },
];

const examples: Record<JourneyId, string[]> = {
  command: ["Semana estável", "Spike de risco", "Comitê mensal"],
  integrations: ["GitHub · descoberta real", "AWS Bedrock · próximo", "Vertex AI · próximo"],
  agent: ["Júlia · Growth", "Atlas · Suporte", "Nora · Financeiro"],
  alerts: ["Conversão da Júlia", "Adoção do Atlas", "Custo da Nora"],
};

const commandModes: Array<{ id: CommandMode; label: string; description: string }> = [
  { id: "console", label: "Console", description: "Operação densa e rápida." },
  { id: "signal", label: "Signal", description: "Melhor equilíbrio entre contexto e ação — recomendada." },
  { id: "briefing", label: "Briefing", description: "Visão executiva para reuniões e decisões." },
];

function MetricTile({ label, value, detail, tone = "sage" }: { label: string; value: string; detail: string; tone?: "sage" | "ochre" | "terracotta" | "red" }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-3 font-serif text-3xl tracking-tight text-foreground">{value}</div>
      <Pill tone={tone} className="mt-3">{detail}</Pill>
    </div>
  );
}

function SectionCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-card-border bg-card p-5", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><h2 className="font-serif text-2xl tracking-tight text-foreground">{title}</h2>{subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}</div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      {children}
    </section>
  );
}

function CommandJourney({ example, mode }: { example: string; mode: CommandMode }) {
  const isRisk = example === "Spike de risco";
  const isCommittee = example === "Comitê mensal";
  const modeSpec = commandModes.find((item) => item.id === mode) ?? commandModes[1];
  const score = isRisk ? "64" : isCommittee ? "76" : "82";
  const alertCount = isRisk ? "08" : isCommittee ? "04" : "02";
  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="space-y-5">
        <div className="rounded-[1.75rem] border border-[#2b3b31] bg-[#0d1511] p-5 text-[#eee8d9] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><Eyebrow className="text-[#91b79e]">{modeSpec.label} · {example}</Eyebrow><h2 className="mt-3 max-w-2xl font-serif text-4xl leading-[.98] tracking-tight">{mode === "console" ? "Tudo que precisa de atenção, em uma única superfície." : mode === "briefing" ? "A frota está pronta para a conversa do comitê." : isRisk ? "O risco subiu antes do resultado aparecer." : isCommittee ? "A frota está pronta para a conversa do comitê." : "A operação está saudável, mas ainda há sinais para acompanhar."}</h2></div><div className="flex items-center gap-2 text-xs text-[#91b79e]"><span className="h-2 w-2 rounded-full bg-[#91b79e]" /> Atualizado agora</div></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#d6e4c2] p-4 text-[#172018]"><Eyebrow className="text-[#52614c]">Saúde da frota</Eyebrow><div className="mt-4 font-serif text-5xl">{score}</div><div className="mt-2 text-xs text-[#52614c]">{isRisk ? "-8 pontos em 7 dias" : "+6 pontos em 7 dias"}</div></div><div className="rounded-2xl border border-[#2b3b31] bg-[#17221b] p-4"><Eyebrow>Valor protegido</Eyebrow><div className="mt-4 font-serif text-4xl">R$ {isRisk ? "61k" : "84k"}</div><div className="mt-2 text-xs text-[#91a293]">impacto mensal estimado</div></div><div className="rounded-2xl border border-[#2b3b31] bg-[#17221b] p-4"><Eyebrow>Alertas abertos</Eyebrow><div className="mt-4 font-serif text-4xl">{alertCount}</div><div className="mt-2 text-xs text-[#91a293]">{isRisk ? "3 críticos" : "1 crítico"}</div></div></div>
        </div>
        <SectionCard title="Fila de decisão" subtitle="As três próximas ações de maior impacto"><div className="space-y-2">{(isRisk ? [["Escalar queda de conversão", "Júlia", "Hoje", "red"], ["Pausar expansão do Atlas", "Rafael", "Amanhã", "terracotta"], ["Revisar custo da Nora", "Marina", "3 dias", "ochre"]] : [["Validar meta de adoção", "Marina", "Hoje", "sage"], ["Acompanhar alerta de qualidade", "Rafael", "2 dias", "ochre"], ["Atualizar sponsor do comitê", "Comitê", "5 dias", "blue"]]).map(([action, owner, due, tone]) => <div key={action} className="flex items-center gap-3 rounded-xl border border-card-border bg-background/60 p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary"><Target className="h-4 w-4 text-chart-1" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-foreground">{action}</div><div className="mt-1 text-xs text-muted-foreground">{owner} · prazo {due}</div></div><Pill tone={tone as "sage" | "ochre" | "terracotta" | "blue"}>{isCommittee ? "Comitê" : "Ação"}</Pill></div>)}</div></SectionCard>
      </div>
      <div className="space-y-5"><SectionCard title="Camadas em movimento" subtitle="O que está puxando a saúde hoje"><div className="space-y-4">{[["Eficácia", isRisk ? 58 : 86], ["Eficiência", isCommittee ? 88 : 74], ["Adoção", isRisk ? 63 : 79], ["Governança", isRisk ? 71 : 92]].map(([label, value]) => <div key={label as string}><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono text-foreground">{value}</span></div><div className="h-2 rounded-full bg-secondary"><div className={cn("h-full rounded-full", Number(value) < 65 ? "bg-chart-4" : "bg-chart-1")} style={{ width: `${value}%` }} /></div></div>)}</div></SectionCard><SectionCard title="Ritmo da operação" subtitle="Últimos 7 dias"><div className="flex h-28 items-end gap-2">{[32, 44, 38, 55, 49, isRisk ? 31 : 68, isRisk ? 24 : 76].map((height, index) => <div key={index} className={cn("flex-1 rounded-t-md", index === 6 && isRisk ? "bg-chart-4" : "bg-chart-1/70")} style={{ height: `${height}%` }} />)}</div><div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Seg</span><span>Dom</span><span className="font-medium text-foreground">{isRisk ? "Tendência de queda" : "Tendência positiva"}</span></div></SectionCard></div>
    </div>
  );
}

function IntegrationsJourney({ example }: { example: string }) {
  const isGitHub = example.startsWith("GitHub");
  const isAws = example.startsWith("AWS");
  const platform = isGitHub ? "GitHub" : isAws ? "AWS Bedrock" : "Vertex AI";
  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-card-border bg-card p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><Eyebrow>Jornada de integração · exemplo selecionado</Eyebrow><h2 className="mt-3 font-serif text-4xl tracking-tight">{platform}: da credencial à primeira agente.</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Uma sequência guiada para reduzir dúvidas e mostrar exatamente o que será importado para a frota.</p></div><Pill tone={isGitHub ? "sage" : "muted"}>{isGitHub ? "Disponível agora" : "Próxima integração"}</Pill></div><div className="mt-8 grid gap-2 md:grid-cols-5">{["Credencial", "Teste", "Discovery", "Revisão", "Admissão"].map((step, index) => <div key={step} className="relative"><div className={cn("flex items-center gap-2 rounded-xl border p-3", index < (isGitHub ? 3 : 1) ? "border-chart-1/40 bg-chart-1/10" : "border-card-border bg-background/50")}><div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", index < (isGitHub ? 3 : 1) ? "bg-chart-1 text-primary-foreground" : "bg-secondary text-muted-foreground")}>{index < (isGitHub ? 3 : 1) ? <Check className="h-3.5 w-3.5" /> : index + 1}</div><span className="text-xs font-medium">{step}</span></div>{index < 4 && <ArrowRight className="absolute -right-2 top-5 z-10 hidden h-3.5 w-3.5 text-muted-foreground md:block" />}</div>)}</div></div>
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><SectionCard title="Fonte" subtitle="Como o Muster acessa a plataforma"><div className="flex items-center gap-3 rounded-xl border border-card-border bg-background/50 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">{isGitHub ? <GitBranch className="h-5 w-5 text-chart-1" /> : <Cloud className="h-5 w-5 text-chart-5" />}</div><div><div className="font-medium">{platform}</div><div className="mt-1 text-xs text-muted-foreground">{isGitHub ? "PAT com leitura de repositórios" : "API oficial + escopo da conta"}</div></div></div><div className="mt-4 space-y-3 text-sm"><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-chart-1" /> Credencial nunca aparece na resposta</div><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-chart-2" /> Última sincronização: {isGitHub ? "agora" : "a configurar"}</div></div></SectionCard><SectionCard title="Agentes encontrados" subtitle={isGitHub ? "Candidatos detectados por sinais no repositório" : "Exemplo do contrato esperado da integração"}><div className="space-y-2">{(isGitHub ? [["support-triage", "LangChain", "89%"], ["billing-guardian", "Anthropic", "78%"], ["review-copilot", "OpenAI", "64%"]] : [["bedrock-router", "Bedrock", "—"], ["claims-assistant", "Vertex", "—"], ["ops-reviewer", "Framework nativo", "—"]]).map(([name, stack, confidence]) => <div key={name} className="flex items-center gap-3 rounded-xl border border-card-border bg-background/50 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"><Bot className="h-4 w-4 text-chart-2" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{name}</div><div className="mt-1 text-xs text-muted-foreground">{stack} · confiança {confidence}</div></div><Pill tone={isGitHub ? "sage" : "muted"}>{isGitHub ? "Revisar" : "Mock"}</Pill></div>)}</div></SectionCard></div>
    </div>
  );
}

function AgentJourney({ example }: { example: string }) {
  const [name, role, health, platform] = example.split(" · ");
  const isAtlas = name === "Atlas";
  const isNora = name === "Nora";
  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-[#2b3b31] bg-[#0d1511] p-5 text-[#eee8d9] sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d6e4c2] text-xl font-semibold text-[#172018]">{name?.slice(0, 2)}</div><div><Eyebrow className="text-[#91b79e]">Carteira de trabalho · {platform}</Eyebrow><h2 className="mt-2 font-serif text-4xl tracking-tight">{name}</h2><p className="mt-1 text-sm text-[#a5b1a5]">{role} · versão 1.4.0</p></div></div><Pill tone={isAtlas ? "ochre" : isNora ? "terracotta" : "sage"}>{isAtlas ? "Mentorar" : isNora ? "Observar" : "Promover"}</Pill></div><div className="mt-8 grid gap-3 sm:grid-cols-4"><MetricTile label="Saúde" value={health ?? "78"} detail={isAtlas ? "-4 pts" : "+6 pts"} tone={isAtlas ? "ochre" : "sage"} /><MetricTile label="Execuções · 30d" value={isNora ? "4.2k" : "8.7k"} detail={isNora ? "alto custo" : "ritmo saudável"} tone={isNora ? "terracotta" : "sage"} /><MetricTile label="Governança" value={isAtlas ? "54" : "88"} detail={isAtlas ? "atenção" : "comprovada"} tone={isAtlas ? "terracotta" : "sage"} /><MetricTile label="Valor líquido" value={isNora ? "R$ 9k" : "R$ 31k"} detail={isNora ? "-8%" : "+18%"} tone={isNora ? "ochre" : "sage"} /></div></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><SectionCard title="Evidências da avaliação" subtitle="O que sustenta o próximo veredito"><div className="space-y-3">{[["Resultado correto", isAtlas ? "72%" : "91%", isAtlas ? "Eficácia" : "Eficácia"], ["Tempo médio", isNora ? "4,8s" : "1,2s", "Eficiência"], ["Uso recorrente", isAtlas ? "41%" : "78%", "Adoção"], ["Escalações corretas", isAtlas ? "63%" : "94%", "Governança"]].map(([label, value, layer]) => <div key={label} className="flex items-center gap-3 rounded-xl border border-card-border bg-background/50 p-3"><Activity className="h-4 w-4 text-chart-1" /><div className="min-w-0 flex-1"><div className="text-sm font-medium">{label}</div><div className="mt-1 text-xs text-muted-foreground">{layer}</div></div><span className="font-mono text-sm">{value}</span></div>)}</div></SectionCard><SectionCard title="Próxima revisão" subtitle="Plano de evolução do agente"><div className="flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chart-1/15"><Clock3 className="h-4 w-4 text-chart-1" /></div><div><div className="text-sm font-medium">{isAtlas ? "Reduzir escalações incorretas" : isNora ? "Recalibrar custo por execução" : "Validar expansão de volume"}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Meta sugerida para os próximos 14 dias, com evidência coletada automaticamente pela telemetria.</p><div className="mt-4 flex items-center gap-2 text-xs text-chart-1">Abrir plano de ação <ArrowRight className="h-3.5 w-3.5" /></div></div></div></SectionCard></div>
    </div>
  );
}

function AlertsJourney({ example }: { example: string }) {
  const isJúlia = example.startsWith("Conversão");
  const isAtlas = example.startsWith("Adoção");
  const agent = isJúlia ? "Júlia" : isAtlas ? "Atlas" : "Nora";
  const severity = isJúlia ? "Crítico" : isAtlas ? "Alto" : "Médio";
  const tone = isJúlia ? "red" : isAtlas ? "terracotta" : "ochre";
  return (
    <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]"><div className="space-y-5"><div className="rounded-[1.75rem] border border-[#4c302b] bg-[#1d1513] p-5 text-[#f2e5da] sm:p-7"><div className="flex items-center justify-between gap-3"><Pill tone={tone}>{severity}</Pill><span className="text-xs text-[#bba49a]">Detectado há 18 min</span></div><h2 className="mt-5 font-serif text-4xl leading-[.98] tracking-tight">{example}</h2><p className="mt-4 text-sm leading-relaxed text-[#c2aaa0]">O volume de {agent} cresceu, mas o resultado que sustenta o valor da operação se moveu na direção contrária.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#4c302b] bg-[#2a1b18] p-4"><Eyebrow className="text-[#c2aaa0]">Sinal observado</Eyebrow><div className="mt-3 font-mono text-lg">{isJúlia ? "+42% volume" : isAtlas ? "-19% uso" : "+27% custo"}</div></div><div className="rounded-xl border border-[#4c302b] bg-[#2a1b18] p-4"><Eyebrow className="text-[#c2aaa0]">Impacto provável</Eyebrow><div className="mt-3 font-mono text-lg">{isJúlia ? "-12% conversão" : isAtlas ? "SLA em risco" : "ROI comprimido"}</div></div></div></div><SectionCard title="Trilha da ação" subtitle="Cada passo tem responsável e prazo"><div className="space-y-4">{[["Reconhecer sinal", "Comitê", "Concluído"], ["Validar hipótese", "Marina", "Hoje"], ["Recalibrar métrica", "Rafael", "Em 3 dias"]].map(([step, owner, status], index) => <div key={step} className="flex gap-3"><div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", index === 0 ? "bg-chart-1/15 text-chart-1" : "bg-secondary text-muted-foreground")}>{index === 0 ? <Check className="h-3.5 w-3.5" /> : index + 1}</div><div className="flex-1"><div className="flex justify-between gap-3 text-sm"><span>{step}</span><span className="text-xs text-muted-foreground">{status}</span></div><div className="mt-1 text-xs text-muted-foreground">Responsável: {owner}</div></div></div>)}</div></SectionCard></div><div className="space-y-5"><SectionCard title="Hipótese e evidências" subtitle="Do detector para uma decisão explicável"><div className="rounded-xl border border-card-border bg-background/50 p-4"><div className="flex gap-3"><Radar className="mt-0.5 h-5 w-5 text-chart-2" /><div><div className="text-sm font-medium">Vitória ilusória por desacoplamento</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">A métrica de topo melhorou, mas a camada de valor não acompanhou. O sinal precisa ser validado antes de qualquer promoção.</p></div></div></div><div className="mt-4 space-y-2">{[["Eficácia", isJúlia ? "72 → 61" : "81 → 74"], ["Eficiência", isAtlas ? "78 → 69" : "82 → 77"], ["Valor", isJúlia ? "84 → 65" : "76 → 62"]].map(([layer, value]) => <div key={layer} className="flex items-center justify-between rounded-lg border border-card-border px-3 py-2 text-sm"><span className="text-muted-foreground">{layer}</span><span className="font-mono text-chart-3">{value}</span></div>)}</div></SectionCard><div className="rounded-2xl border border-chart-1/30 bg-chart-1/5 p-5"><div className="flex items-center gap-2 text-chart-1"><ShieldCheck className="h-4 w-4" /><span className="text-sm font-medium">Critério de conclusão</span></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Resolver somente quando a evidência retornar à meta por dois ciclos consecutivos.</p></div></div></div>
  );
}

function JourneyPreview({ journey, example, commandMode }: { journey: JourneyId; example: string; commandMode: CommandMode }) {
  if (journey === "command") return <CommandJourney example={example} mode={commandMode} />;
  if (journey === "integrations") return <IntegrationsJourney example={example} />;
  if (journey === "agent") return <AgentJourney example={example} />;
  return <AlertsJourney example={example} />;
}

export default function DesignLabPage() {
  const [journey, setJourney] = useState<JourneyId>("command");
  const [commandMode, setCommandMode] = useState<CommandMode>("signal");
  const [selectedExamples, setSelectedExamples] = useState<Record<JourneyId, string>>({
    command: examples.command[0]!,
    integrations: examples.integrations[0]!,
    agent: examples.agent[0]!,
    alerts: examples.alerts[0]!,
  });
  const example = selectedExamples[journey];
  const activeJourney = journeys.find((item) => item.id === journey);

  return (
    <AppLayout title="Laboratório de jornadas" breadcrumbs={[{ label: "Protótipos" }]}>
      <div className="mx-auto max-w-[1480px] space-y-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-chart-2"><Sparkles className="h-4 w-4" /><Eyebrow className="text-chart-2">Design lab · jornada completa · não produtivo</Eyebrow></div>
            <h1 className="max-w-4xl font-serif text-4xl leading-[.98] tracking-tight sm:text-5xl">Quatro páginas para transformar sinal em operação.</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">Clique em uma jornada, escolha um cenário e a visualização abaixo muda automaticamente. O produto atual permanece intacto até escolhermos o que promover.</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-2">
            <Eyebrow className="px-2 pb-1">1. Escolha a jornada</Eyebrow>
            <div className="flex flex-wrap items-center gap-1">
              {journeys.map((item) => <button key={item.id} type="button" aria-pressed={journey === item.id} onClick={() => setJourney(item.id)} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors", journey === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">{journeys.map((item, index) => <button key={item.id} type="button" aria-pressed={journey === item.id} onClick={() => setJourney(item.id)} className={cn("group rounded-2xl border p-4 text-left transition-all", journey === item.id ? "border-primary/60 bg-primary/5 shadow-lg shadow-primary/5" : "border-card-border bg-card hover:border-foreground/25")}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">0{index + 1}</span><item.icon className="h-4 w-4 text-chart-1" /></div>{journey === item.id && <Pill tone="sage">Ativa</Pill>}</div><div className="mt-4 font-medium text-foreground">{item.label}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p></button>)}</div>
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Eyebrow>2. Escolha o cenário</Eyebrow><Pill tone="muted">Jornada: {activeJourney?.label}</Pill></div><p className="mt-1 text-sm text-muted-foreground">A prévia muda abaixo conforme você troca este exemplo.</p></div><div className="flex flex-wrap gap-2">{examples[journey].map((item) => <button key={item} type="button" aria-pressed={example === item} onClick={() => setSelectedExamples((current) => ({ ...current, [journey]: item }))} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", example === item ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{item}</button>)}</div></div>
        {journey === "command" && <div className="rounded-2xl border border-card-border bg-card/70 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><Eyebrow>3. Escolha o modo de visualização</Eyebrow><p className="mt-1 text-xs text-muted-foreground">O mesmo comando pode ser lido como operação, sinal ou briefing.</p></div><Pill tone="sage">Recomendação: Signal</Pill></div><div className="grid gap-2 md:grid-cols-3">{commandModes.map((item) => <button key={item.id} type="button" aria-pressed={commandMode === item.id} onClick={() => setCommandMode(item.id)} className={cn("rounded-xl border p-3 text-left transition-colors", commandMode === item.id ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-foreground/25")}><div className="flex items-center justify-between gap-2"><span className="font-medium text-foreground">{item.label}</span>{commandMode === item.id && <Check className="h-4 w-4 text-primary" />}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p></button>)}</div></div>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-chart-1" />4. Visualização atual: <span className="font-medium text-foreground">{activeJourney?.label} · {journey === "command" ? commandModes.find((item) => item.id === commandMode)?.label : example}</span></div>
        <JourneyPreview journey={journey} example={example} commandMode={commandMode} />
      </div>
    </AppLayout>
  );
}
