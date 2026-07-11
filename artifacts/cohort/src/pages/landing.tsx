import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Fingerprint, Layers, Gavel, AlertTriangle, Users, Plug } from "lucide-react";
import { CohortMark } from "@/components/logo";
import { OpsSchematic } from "@/components/ops-schematic";

/* ── Ticker de vereditos (pregão da frota) ─────────────────── */
const TICKER: Array<[string, string, string, string]> = [
  ["text-chart-1", "▲ PROMOVER", "Atlas · revisão de código", "94"],
  ["text-chart-2", "◆ MENTORAR", "Júlia · pré-qualificação", "73"],
  ["text-chart-3", "▼ APOSENTAR", "Vega-1 · OCR fiscal", "48"],
  ["text-chart-1", "▲ PROMOVER", "Sofia · suporte N1", "88"],
  ["text-chart-2", "◆ VITÓRIA ILUSÓRIA", "ROI ↑ + acurácia ↓", "crítico"],
  ["text-chart-1", "▲ PROMOVER", "Triage · roteamento", "91"],
  ["text-chart-2", "◆ MENTORAR", "Téo · cobrança", "64"],
  ["text-chart-3", "▼ SINAL ANTECEDENTE", "drift pós-recalibração", "obs."],
];

function VerdictTicker() {
  const reel = [...TICKER, ...TICKER]; // duas cópias → -50% loopa sem emenda
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden whitespace-nowrap border-b border-primary/25 py-2.5 font-mono text-xs tracking-wide"
    >
      <div
        className="ops-reel-anim inline-flex gap-11 pr-11"
        style={{ animation: "ops-reel 36s linear infinite" }}
      >
        {reel.map(([tone, tag, who, score], i) => (
          <span key={i} className="inline-flex gap-3">
            <span className={tone}>{tag}</span>
            <span className="text-foreground/70">{who}</span>
            <span className="text-foreground/40">{score}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Contador que sobe ao entrar na tela ───────────────────── */
function CountUp({ target, className }: { target: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const dur = 1400;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("pt-BR")}
    </span>
  );
}

const COUNTERS: Array<{ target: number; suffix?: string; caption: string }> = [
  { target: 1024, caption: "agentes sob monitoramento" },
  { target: 37, caption: "vitórias ilusórias flagradas este trimestre" },
  { target: 2, suffix: ",1M", caption: "R$ de valor protegido por intervenção" },
  { target: 9, suffix: " dias", caption: "da admissão ao primeiro veredito" },
];

const FEATURES = [
  {
    icon: Fingerprint,
    title: "Admissão & Identidade",
    desc: "Descubra agentes via conectores e admita-os na frota com identidade e Carteira de Trabalho versionada.",
  },
  {
    icon: Layers,
    title: "Avaliação em 5 camadas",
    desc: "Eficácia, eficiência, adoção, governança e valor — leitura sistêmica, não métrica isolada.",
  },
  {
    icon: AlertTriangle,
    title: "Detector de Vitória Ilusória",
    desc: "Cruza KPIs para flagrar padrões antagônicos — ROI subindo com acurácia caindo — antes que virem incidente.",
  },
  {
    icon: Gavel,
    title: "Veredito do Comitê",
    desc: "Promover, Mentorar ou Aposentar — com confiança, janela de execução e próximas três ações.",
  },
  {
    icon: Users,
    title: "Comitê & Governança",
    desc: "Dono de negócio, técnico e sponsor por agente — trilha auditável de cada veredito.",
  },
  {
    icon: Plug,
    title: "Plug-and-play",
    desc: "GitHub, OpenAI, AWS Bedrock, Copilot — conecte a origem e faça o censo da frota em minutos.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <CohortMark className="h-7 w-7" />
            <span className="font-serif text-lg font-medium tracking-tight">Muster</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              AI Workforce Operations
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-md px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <VerdictTicker />

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
          <span style={{ animation: "ops-blink 1.6s steps(1) infinite" }}>●</span> Sala de comando ·
          frota ao vivo
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-5xl font-medium leading-[1.02] tracking-[-0.02em] [text-wrap:balance] sm:text-7xl md:text-8xl">
          Toda frota mente. <em className="italic text-primary">Os números confessam.</em>
        </h1>
        <p className="mt-6 max-w-[56ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
          Agentes de IA otimizam a métrica que você mede — não o resultado que você precisa. O Muster
          cruza as 5 camadas (eficácia, eficiência, adoção, governança, valor), flagra o padrão
          antagônico e transforma cada contradição em uma decisão de comitê.
        </p>

        {/* ── Esquema: a plataforma por dentro ── */}
        <div className="mt-14 overflow-hidden rounded-lg border border-primary/30 bg-primary/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/25 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{"// esquema — a plataforma operando por dentro"}</span>
            <span className="text-primary">
              <span style={{ animation: "ops-blink 1.6s steps(1) infinite" }}>●</span> ao vivo
            </span>
          </div>
          <OpsSchematic className="block h-auto w-full" />
        </div>

        {/* ── Contadores ── */}
        <div className="mt-14 grid grid-cols-1 gap-px border-y border-primary/25 bg-primary/25 sm:grid-cols-2 lg:grid-cols-4">
          {COUNTERS.map((c) => (
            <div key={c.caption} className="bg-background px-5 py-6">
              <div className="font-mono text-4xl tabular-nums text-foreground">
                <CountUp target={c.target} />
                {c.suffix && <span className="text-[0.55em] text-primary">{c.suffix}</span>}
              </div>
              <p className="mt-2 font-mono text-xs tracking-wide text-muted-foreground">{c.caption}</p>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="mt-12 flex flex-wrap items-center gap-5">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-7 py-3.5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entrar na sala de comando
            <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="font-mono text-[13px] text-muted-foreground">
            $ cohort connect github · aws · azure · openai
          </span>
        </div>
      </section>

      {/* ── O que a sala controla ── */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-24">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
          O que a sala controla
        </p>
        <h2 className="mt-4 max-w-[24ch] font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          RH e governança para uma força de trabalho que não dorme.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-card-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <f.icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-serif text-lg font-medium tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="mx-auto max-w-6xl px-5 py-24 text-center">
        <h2 className="mx-auto max-w-[22ch] font-serif text-4xl font-medium tracking-tight [text-wrap:balance] sm:text-5xl">
          Quantos dos seus agentes você <em className="italic text-primary">promoveria hoje?</em>
        </h2>
        <p className="mx-auto mt-5 max-w-[48ch] text-muted-foreground">
          Conecte uma origem, faça o censo da frota e receba o primeiro veredito em dias — não em
          trimestres.
        </p>
        <div className="mt-9">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Fazer o censo da minha frota
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer className="border-t border-primary/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="flex items-center gap-2">
            <CohortMark className="h-4 w-4" /> Muster · AI Workforce Operations
          </span>
          <span>Identidade · Avaliação · Veredito</span>
        </div>
      </footer>
    </div>
  );
}
