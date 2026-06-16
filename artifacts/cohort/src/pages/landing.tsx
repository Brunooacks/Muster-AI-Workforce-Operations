import { Link } from "wouter";
import {
  Fingerprint,
  Layers,
  Gavel,
  AlertTriangle,
  Users,
  Plug,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

const layers = [
  { label: "Eficácia", score: 88, tone: "good" },
  { label: "Eficiência", score: 74, tone: "warn" },
  { label: "Adoção", score: 81, tone: "good" },
  { label: "Governança", score: 67, tone: "warn" },
  { label: "Valor", score: 92, tone: "good" },
] as const;

const features = [
  {
    icon: Fingerprint,
    title: "Admissão & Identidade",
    desc: "Descubra agentes via conectores e admita-os na frota com identidade e Carteira de Trabalho versionada.",
  },
  {
    icon: Layers,
    title: "Avaliação em 5 camadas",
    desc: "Eficácia, eficiência, adoção, governança e valor — uma leitura sistêmica, não métrica isolada.",
  },
  {
    icon: Gavel,
    title: "Veredito do Comitê",
    desc: "Promover, Mentorar ou Aposentar — com confiança, janela de execução e próximas três ações.",
  },
  {
    icon: AlertTriangle,
    title: "Detector de Vitória Ilusória",
    desc: "Cruza KPIs para flagrar padrões antagônicos antes que virem incidente.",
  },
  {
    icon: Users,
    title: "Comitê & Governança",
    desc: "Dono de negócio, técnico e sponsor por agente — trilha auditável de cada veredito.",
  },
  {
    icon: Plug,
    title: "Plug-and-play",
    desc: "Conecta nas plataformas onde os agentes já rodam. Primeiro insight antes do café esfriar.",
  },
];

const verdicts = [
  { label: "Promover", icon: TrendingUp, colorClass: "text-chart-1", count: "12" },
  { label: "Mentorar", icon: Minus, colorClass: "text-chart-2", count: "7" },
  { label: "Aposentar", icon: TrendingDown, colorClass: "text-chart-3", count: "3" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground font-sans selection:bg-primary/20">
      {/* ── Soft editorial backdrop ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-[130px] opacity-[0.22]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
        />
        <div
          className="absolute top-1/4 right-[-15%] h-[60vh] w-[60vh] rounded-full blur-[130px] opacity-[0.18]"
          style={{ background: "radial-gradient(circle, hsl(var(--chart-1)), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-15%] left-1/4 h-[55vh] w-[55vh] rounded-full blur-[130px] opacity-[0.14]"
          style={{ background: "radial-gradient(circle, hsl(var(--chart-2)), transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-card-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-serif text-lg font-semibold text-primary-foreground">
              C
            </div>
            <span className="font-serif text-xl font-medium tracking-tight">Cohort</span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Começar
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-20">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-chart-1" />
          Governança contínua para frotas de agentes de IA
        </div>

        <h1 className="font-serif text-[14vw] font-medium leading-[0.92] tracking-[-0.02em] sm:text-6xl md:text-7xl">
          Sua força de
          <br />
          trabalho de IA,
          <br />
          <span className="bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--chart-1))] to-[hsl(var(--chart-2))] bg-clip-text italic text-transparent">
            sob julgamento.
          </span>
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            Cada agente em produção com identidade, donos e veredito periódico. Cohort cruza KPIs em{" "}
            <span className="font-medium text-foreground">5 camadas</span>, detecta vitórias ilusórias e
            decide com dados: <span className="font-medium text-chart-1">promover</span>,{" "}
            <span className="font-medium text-chart-2">mentorar</span> ou{" "}
            <span className="font-medium text-chart-3">aposentar</span>.
          </p>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Criar conta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Acessar painel
            </Link>
          </div>
        </div>

        {/* Floating product preview */}
        <div className="relative mt-20">
          <div
            className="absolute -inset-x-10 -top-10 bottom-0 -z-10 opacity-40 blur-3xl"
            style={{ background: "radial-gradient(60% 60% at 50% 0%, hsl(var(--primary) / 0.2), transparent 70%)" }}
          />
          <div className="rounded-2xl border border-card-border bg-card p-6 shadow-xl md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Perfil de desempenho
                </p>
                <p className="mt-0.5 font-serif text-lg font-medium">Frota · 22 agentes em campanha</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Saúde média
                </p>
                <p className="font-serif text-3xl font-medium tabular-nums text-primary">80</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <div className="space-y-3.5">
                {layers.map((l) => (
                  <div key={l.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{l.label}</span>
                      <span className="font-mono font-semibold tabular-nums">{l.score}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${l.tone === "good" ? "bg-chart-1" : "bg-chart-2"}`}
                        style={{ width: `${l.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 md:grid-cols-1 md:content-start">
                {verdicts.map((v) => (
                  <div
                    key={v.label}
                    className="flex flex-col gap-3 rounded-xl border border-card-border bg-background p-3 text-center md:flex-row md:items-center md:text-left"
                  >
                    <v.icon className={`mx-auto h-5 w-5 md:mx-0 ${v.colorClass}`} />
                    <div>
                      <p className="font-serif text-xl font-medium leading-none tabular-nums">{v.count}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{v.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The loop ── */}
      <section className="border-y border-card-border bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-3">
            {["Admissão", "Avaliação", "Veredito"].map((step, i) => (
              <div key={step} className="flex items-center gap-4 sm:gap-3">
                <div className="flex items-center gap-3 rounded-full border border-card-border bg-card px-5 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="font-medium">{step}</span>
                </div>
                {i < 2 && <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground sm:rotate-0" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
            A camada de gestão da sua frota
          </p>
          <h2 className="font-serif text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
            Outras ferramentas mostram o que o agente fez.{" "}
            <span className="italic text-muted-foreground">Cohort responde se ele deve continuar.</span>
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-card-border bg-card-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group bg-card p-7 transition-colors hover:bg-secondary/40">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-serif text-lg font-medium">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-3xl border border-card-border bg-card px-8 py-16 text-center md:py-20">
          <div
            className="absolute inset-0 -z-10"
            style={{ background: "radial-gradient(80% 120% at 50% 0%, hsl(var(--primary) / 0.12), transparent 70%)" }}
          />
          <h2 className="mb-5 font-serif text-4xl font-medium tracking-tight md:text-6xl">
            Cada agente. <span className="italic text-primary">Cada ciclo.</span> Um veredito.
          </h2>
          <p className="mx-auto mb-9 max-w-xl text-lg text-muted-foreground">
            Admita seus primeiros agentes em minutos e tenha o primeiro veredito do comitê ainda hoje.
          </p>
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Criar conta gratuita
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-card-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary font-serif text-xs font-semibold text-primary-foreground">
              C
            </div>
            <span className="font-serif font-medium text-foreground">Cohort</span>
          </div>
          <p>Sua força de trabalho de IA, sob julgamento contínuo.</p>
        </div>
      </footer>
    </div>
  );
}
