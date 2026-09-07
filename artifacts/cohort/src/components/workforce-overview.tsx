import {
  Activity,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Cloud,
  Laptop,
  RefreshCw,
  Server,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Waypoints,
} from "lucide-react";

export interface WorkforceOverviewLabels {
  aria: string;
  environments: string;
  environmentItems: [string, string, string];
  connected: string;
  professionalRecord: string;
  agentName: string;
  agentRole: string;
  purpose: string;
  purposeText: string;
  scores: [string, string, string];
  contractStatus: string;
  mixedTeam: string;
  teamMembers: [string, string, string];
  journey: string;
  journeyName: string;
  stages: [string, string, string, string];
  loop: string;
  loopItems: [string, string, string, string];
  live: string;
}

export const WORKFORCE_OVERVIEW_PT: WorkforceOverviewLabels = {
  aria: "Visão do Muster Workforce OS conectando ambientes cloud, híbridos e locais a contratos profissionais, equipes mistas, jornadas A2A e supervisão contínua.",
  environments: "Ambientes conectados",
  environmentItems: ["Cloud", "Híbrido", "On-premise / local"],
  connected: "conectado",
  professionalRecord: "Contrato profissional",
  agentName: "Vega",
  agentRole: "Operadora de entrega contínua",
  purpose: "Propósito contratado",
  purposeText: "Entregar mudanças confiáveis dentro do escopo técnico aprovado.",
  scores: ["Propósito", "Qualidade", "Evidência"],
  contractStatus: "Contrato cumprido",
  mixedTeam: "Equipe mista",
  teamMembers: ["Agente executa", "Agente recomenda", "Humano responde"],
  journey: "Jornada A2A",
  journeyName: "Entrega contínua segura",
  stages: ["Planejar", "Implementar", "Autorizar", "Observar"],
  loop: "Ciclo de gestão",
  loopItems: ["Coletar", "Avaliar", "Decidir", "Desenvolver"],
  live: "supervisão contínua",
};

const environmentIcons = [Cloud, Server, Laptop];
const teamIcons = [Bot, ShieldCheck, UserCheck];

export function WorkforceOverview({ labels = WORKFORCE_OVERVIEW_PT }: { labels?: WorkforceOverviewLabels }) {
  return (
    <div role="img" aria-label={labels.aria} className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.14),transparent_52%)] p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" /> Muster Workforce OS</span>
        <span className="flex items-center gap-2 text-primary"><Activity className="h-3.5 w-3.5" /> {labels.live}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[.7fr_1.4fr_.75fr]">
        <section className="rounded-xl border border-primary/20 bg-background/70 p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{labels.environments}</div>
          <div className="mt-3 space-y-2">
            {labels.environmentItems.map((item, index) => {
              const Icon = environmentIcons[index] ?? Server;
              return (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-card-border bg-card/75 p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><strong className="block text-[11px] font-medium text-foreground">{item}</strong><span className="mt-1 flex items-center gap-1 text-[8px] uppercase tracking-[0.08em] text-primary"><CheckCircle2 className="h-2.5 w-2.5" /> {labels.connected}</span></span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-muted-foreground"><span className="h-px flex-1 bg-primary/20" /><ArrowRight className="h-3.5 w-3.5 text-primary" /></div>
        </section>

        <section className="rounded-xl border border-primary/35 bg-card p-4 shadow-[0_18px_70px_hsl(var(--background)/0.7)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">VE</span>
              <div><div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-primary"><BriefcaseBusiness className="h-3 w-3" /> {labels.professionalRecord}</div><strong className="mt-1 block font-serif text-lg font-medium text-foreground">{labels.agentName}</strong><span className="text-[9px] text-muted-foreground">{labels.agentRole}</span></div>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-primary">{labels.contractStatus}</span>
          </div>

          <div className="mt-4 rounded-lg border border-card-border bg-background/50 p-3">
            <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground"><Target className="h-3 w-3" /> {labels.purpose}</div>
            <p className="mt-2 text-[11px] leading-relaxed text-foreground">{labels.purposeText}</p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {labels.scores.map((score, index) => <div key={score} className="rounded-lg bg-secondary/60 p-2.5"><span className="block text-[8px] text-muted-foreground">{score}</span><strong className="mt-1 block font-mono text-base font-medium text-foreground">{[91, 96, 97][index]}%</strong><div className="mt-2 h-1 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${[91, 96, 97][index]}%` }} /></div></div>)}
          </div>

          <div className="mt-3 rounded-lg border border-card-border bg-background/40 p-3">
            <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground"><Users className="h-3 w-3" /> {labels.mixedTeam}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">{labels.teamMembers.map((member, index) => { const Icon = teamIcons[index] ?? Bot; return <div key={member} className="flex items-center gap-2 rounded-md bg-secondary/55 px-2 py-2"><Icon className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="text-[8px] leading-tight text-muted-foreground">{member}</span></div>; })}</div>
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-background/70 p-3">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground"><RefreshCw className="h-3.5 w-3.5 text-primary" /> {labels.loop}</div>
          <div className="mt-3 space-y-2">
            {labels.loopItems.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-lg border border-card-border bg-card/75 px-3 py-2.5"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 font-mono text-[9px] text-primary">0{index + 1}</span><strong className="text-[10px] font-medium text-foreground">{item}</strong>{index < labels.loopItems.length - 1 && <span className="ml-auto h-4 w-px bg-primary/20" />}</div>)}
          </div>
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.06] p-3 text-[9px] leading-relaxed text-muted-foreground"><strong className="text-primary">100%</strong> traces, decisões e ações ligados ao contrato.</div>
        </section>
      </div>

      <section className="mt-3 rounded-xl border border-primary/20 bg-background/70 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground"><Waypoints className="h-3.5 w-3.5 text-primary" /> {labels.journey}</div><strong className="mt-1 block text-xs font-medium text-foreground">{labels.journeyName}</strong></div><span className="font-mono text-[9px] text-primary">94% end-to-end · p95 42 min</span></div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">{labels.stages.map((stage, index) => <div key={stage} className="flex min-w-0 flex-1 items-center gap-2"><div className="min-w-[112px] flex-1 rounded-lg border border-card-border bg-card/80 px-3 py-2 text-center"><span className="block font-mono text-[8px] text-muted-foreground">0{index + 1}</span><strong className="mt-1 block text-[9px] font-medium text-foreground">{stage}</strong></div>{index < labels.stages.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />}</div>)}</div>
      </section>
    </div>
  );
}
