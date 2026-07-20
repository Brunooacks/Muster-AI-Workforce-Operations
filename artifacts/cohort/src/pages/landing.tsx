import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Fingerprint, Layers, Gavel, AlertTriangle, Users, Plug } from "lucide-react";
import { MusterMark } from "@/components/logo";
import { OpsSchematic, type OpsSchematicLabels, OPS_LABELS_PT } from "@/components/ops-schematic";
import { LangSwitcher } from "@/components/lang-switcher";
import { useLang, localeOf, type Lang } from "@/lib/i18n";

/* ── Dicionário da landing (pt canônico · en · es) ─────────── */

interface LandingDict {
  signIn: string;
  signUp: string;
  eyebrow: string;
  h1a: string;
  h1b: string;
  sub: string;
  schematicHeader: string;
  live: string;
  counters: [string, string, string, string];
  ctaMain: string;
  ctaGhost: string;
  sectionEyebrow: string;
  sectionTitle: string;
  features: Array<{ title: string; desc: string }>;
  finalTitleA: string;
  finalTitleB: string;
  finalSub: string;
  finalCta: string;
  footerRight: string;
  ticker: Array<[string, string, string, string]>;
  ops: OpsSchematicLabels;
}

const OPS_EN: OpsSchematicLabels = {
  connectors: "CONNECTORS",
  admission: "ADMISSION",
  workRecord: "WORK RECORD",
  evaluation: "EVALUATION · 5 LAYERS",
  detector: "ILLUSORY VICTORY DETECTOR",
  alert: "ROI ↑ + ACCURACY ↓",
  verdictTitle: "COMMITTEE VERDICT",
  layers: ["EFFICACY", "EFFICIENCY", "ADOPTION", "GOVERNANCE", "VALUE"],
  verdicts: ["PROMOTE", "MENTOR", "RETIRE"],
  aria: "Animated schematic of the Muster pipeline: connectors feed admission, agents cross the five-layer evaluation under the illusory victory detector and leave with a verdict of promote, mentor or retire.",
};

const OPS_ES: OpsSchematicLabels = {
  connectors: "CONECTORES",
  admission: "ADMISIÓN",
  workRecord: "EXPEDIENTE LABORAL",
  evaluation: "EVALUACIÓN · 5 CAPAS",
  detector: "DETECTOR DE VICTORIA ILUSORIA",
  alert: "ROI ↑ + PRECISIÓN ↓",
  verdictTitle: "VEREDICTO DEL COMITÉ",
  layers: ["EFICACIA", "EFICIENCIA", "ADOPCIÓN", "GOBERNANZA", "VALOR"],
  verdicts: ["ASCENDER", "MENTORÍA", "RETIRAR"],
  aria: "Esquema animado del pipeline de Muster: los conectores alimentan la admisión, los agentes cruzan la evaluación de cinco capas bajo el detector de victoria ilusoria y salen con veredicto de ascender, mentoría o retirar.",
};

const L: Record<Lang, LandingDict> = {
  pt: {
    signIn: "Entrar",
    signUp: "Criar conta",
    eyebrow: "Sala de comando · frota ao vivo",
    h1a: "Toda frota mente.",
    h1b: "Os números confessam.",
    sub: "Agentes de IA otimizam a métrica que você mede — não o resultado que você precisa. O Muster cruza as 5 camadas (eficácia, eficiência, adoção, governança, valor), flagra o padrão antagônico e transforma cada contradição em uma decisão de comitê.",
    schematicHeader: "// esquema — a plataforma operando por dentro",
    live: "ao vivo",
    counters: [
      "agentes sob monitoramento",
      "vitórias ilusórias flagradas este trimestre",
      "R$ de valor protegido por intervenção",
      "da admissão ao primeiro veredito",
    ],
    ctaMain: "Entrar na sala de comando",
    ctaGhost: "$ muster connect github · aws · azure · openai",
    sectionEyebrow: "O que a sala controla",
    sectionTitle: "RH e governança para uma força de trabalho que não dorme.",
    features: [
      { title: "Admissão & Identidade", desc: "Descubra agentes via conectores e admita-os na frota com identidade e Carteira de Trabalho versionada." },
      { title: "Avaliação em 5 camadas", desc: "Eficácia, eficiência, adoção, governança e valor — leitura sistêmica, não métrica isolada." },
      { title: "Detector de Vitória Ilusória", desc: "Cruza KPIs para flagrar padrões antagônicos — ROI subindo com acurácia caindo — antes que virem incidente." },
      { title: "Veredito do Comitê", desc: "Promover, Mentorar ou Aposentar — com confiança, janela de execução e próximas três ações." },
      { title: "Comitê & Governança", desc: "Dono de negócio, técnico e sponsor por agente — trilha auditável de cada veredito." },
      { title: "Plug-and-play", desc: "GitHub, OpenAI, AWS Bedrock, Copilot — conecte a origem e faça o censo da frota em minutos." },
    ],
    finalTitleA: "Quantos dos seus agentes você",
    finalTitleB: "promoveria hoje?",
    finalSub: "Conecte uma origem, faça o censo da frota e receba o primeiro veredito em dias — não em trimestres.",
    finalCta: "Fazer o censo da minha frota",
    footerRight: "Identidade · Avaliação · Veredito",
    ticker: [
      ["text-chart-1", "▲ PROMOVER", "Atlas · revisão de código", "94"],
      ["text-chart-2", "◆ MENTORAR", "Júlia · pré-qualificação", "73"],
      ["text-chart-3", "▼ APOSENTAR", "Vega-1 · OCR fiscal", "48"],
      ["text-chart-1", "▲ PROMOVER", "Sofia · suporte N1", "88"],
      ["text-chart-2", "◆ VITÓRIA ILUSÓRIA", "ROI ↑ + acurácia ↓", "crítico"],
      ["text-chart-1", "▲ PROMOVER", "Triage · roteamento", "91"],
      ["text-chart-2", "◆ MENTORAR", "Téo · cobrança", "64"],
      ["text-chart-3", "▼ SINAL ANTECEDENTE", "drift pós-recalibração", "obs."],
    ],
    ops: OPS_LABELS_PT,
  },
  en: {
    signIn: "Sign in",
    signUp: "Create account",
    eyebrow: "Command room · fleet live",
    h1a: "Every fleet lies.",
    h1b: "The numbers confess.",
    sub: "AI agents optimize the metric you measure — not the outcome you need. Muster crosses the 5 layers (efficacy, efficiency, adoption, governance, value), catches the antagonistic pattern and turns every contradiction into a committee decision.",
    schematicHeader: "// schematic — the platform operating from the inside",
    live: "live",
    counters: [
      "agents under monitoring",
      "illusory victories caught this quarter",
      "in value protected by intervention",
      "from admission to first verdict",
    ],
    ctaMain: "Enter the command room",
    ctaGhost: "$ muster connect github · aws · azure · openai",
    sectionEyebrow: "What the room controls",
    sectionTitle: "HR and governance for a workforce that never sleeps.",
    features: [
      { title: "Admission & Identity", desc: "Discover agents via connectors and admit them to the fleet with identity and a versioned Work Record." },
      { title: "5-layer evaluation", desc: "Efficacy, efficiency, adoption, governance and value — a systemic reading, not an isolated metric." },
      { title: "Illusory Victory Detector", desc: "Crosses KPIs to catch antagonistic patterns — ROI rising while accuracy falls — before they become incidents." },
      { title: "Committee Verdict", desc: "Promote, Mentor or Retire — with confidence, execution window and the next three actions." },
      { title: "Committee & Governance", desc: "Business, technical and sponsor owners per agent — an auditable trail for every verdict." },
      { title: "Plug-and-play", desc: "GitHub, OpenAI, AWS Bedrock, Copilot — connect a source and census your fleet in minutes." },
    ],
    finalTitleA: "How many of your agents would you",
    finalTitleB: "promote today?",
    finalSub: "Connect a source, census the fleet and get the first verdict in days — not quarters.",
    finalCta: "Census my fleet",
    footerRight: "Identity · Evaluation · Verdict",
    ticker: [
      ["text-chart-1", "▲ PROMOTE", "Atlas · code review", "94"],
      ["text-chart-2", "◆ MENTOR", "Júlia · lead qualification", "73"],
      ["text-chart-3", "▼ RETIRE", "Vega-1 · invoice OCR", "48"],
      ["text-chart-1", "▲ PROMOTE", "Sofia · tier-1 support", "88"],
      ["text-chart-2", "◆ ILLUSORY VICTORY", "ROI ↑ + accuracy ↓", "critical"],
      ["text-chart-1", "▲ PROMOTE", "Triage · routing", "91"],
      ["text-chart-2", "◆ MENTOR", "Téo · collections", "64"],
      ["text-chart-3", "▼ LEADING SIGNAL", "post-recalibration drift", "watch"],
    ],
    ops: OPS_EN,
  },
  es: {
    signIn: "Iniciar sesión",
    signUp: "Crear cuenta",
    eyebrow: "Sala de mando · flota en vivo",
    h1a: "Toda flota miente.",
    h1b: "Los números confiesan.",
    sub: "Los agentes de IA optimizan la métrica que mides — no el resultado que necesitas. Muster cruza las 5 capas (eficacia, eficiencia, adopción, gobernanza, valor), detecta el patrón antagónico y convierte cada contradicción en una decisión de comité.",
    schematicHeader: "// esquema — la plataforma operando por dentro",
    live: "en vivo",
    counters: [
      "agentes bajo monitoreo",
      "victorias ilusorias detectadas este trimestre",
      "de valor protegido por intervención",
      "de la admisión al primer veredicto",
    ],
    ctaMain: "Entrar a la sala de mando",
    ctaGhost: "$ muster connect github · aws · azure · openai",
    sectionEyebrow: "Lo que controla la sala",
    sectionTitle: "RR. HH. y gobernanza para una fuerza laboral que no duerme.",
    features: [
      { title: "Admisión e Identidad", desc: "Descubre agentes vía conectores y admítelos en la flota con identidad y Expediente Laboral versionado." },
      { title: "Evaluación en 5 capas", desc: "Eficacia, eficiencia, adopción, gobernanza y valor — lectura sistémica, no métrica aislada." },
      { title: "Detector de Victoria Ilusoria", desc: "Cruza KPIs para detectar patrones antagónicos — ROI subiendo con precisión cayendo — antes de que sean incidentes." },
      { title: "Veredicto del Comité", desc: "Ascender, Mentoría o Retirar — con confianza, ventana de ejecución y las próximas tres acciones." },
      { title: "Comité y Gobernanza", desc: "Dueño de negocio, técnico y sponsor por agente — trazabilidad auditable de cada veredicto." },
      { title: "Plug-and-play", desc: "GitHub, OpenAI, AWS Bedrock, Copilot — conecta el origen y censa tu flota en minutos." },
    ],
    finalTitleA: "¿Cuántos de tus agentes",
    finalTitleB: "ascenderías hoy?",
    finalSub: "Conecta un origen, censa la flota y recibe el primer veredicto en días — no en trimestres.",
    finalCta: "Censar mi flota",
    footerRight: "Identidad · Evaluación · Veredicto",
    ticker: [
      ["text-chart-1", "▲ ASCENDER", "Atlas · revisión de código", "94"],
      ["text-chart-2", "◆ MENTORÍA", "Júlia · precalificación", "73"],
      ["text-chart-3", "▼ RETIRAR", "Vega-1 · OCR fiscal", "48"],
      ["text-chart-1", "▲ ASCENDER", "Sofia · soporte N1", "88"],
      ["text-chart-2", "◆ VICTORIA ILUSORIA", "ROI ↑ + precisión ↓", "crítico"],
      ["text-chart-1", "▲ ASCENDER", "Triage · enrutamiento", "91"],
      ["text-chart-2", "◆ MENTORÍA", "Téo · cobranza", "64"],
      ["text-chart-3", "▼ SEÑAL TEMPRANA", "drift pos-recalibración", "obs."],
    ],
    ops: OPS_ES,
  },
};

/* ── Ticker de vereditos (pregão da frota) ─────────────────── */
function VerdictTicker({ items }: { items: LandingDict["ticker"] }) {
  const reel = [...items, ...items]; // duas cópias → -50% loopa sem emenda
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
function CountUp({ target, locale, className }: { target: number; locale: string; className?: string }) {
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
      {value.toLocaleString(locale)}
    </span>
  );
}

const COUNTER_VALUES: Array<{ target: number; suffix?: string }> = [
  { target: 1024 },
  { target: 37 },
  { target: 2, suffix: ",1M" },
  { target: 9, suffix: " d" },
];

const FEATURE_ICONS = [Fingerprint, Layers, AlertTriangle, Gavel, Users, Plug];

export default function LandingPage() {
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <MusterMark className="h-7 w-7" />
            <span className="font-serif text-lg font-medium tracking-tight">Muster</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              AI Workforce Operations
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <LangSwitcher />
            <Link
              href="/sign-in"
              className="rounded-md px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {t.signIn}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t.signUp}
            </Link>
          </nav>
        </div>
      </header>

      <VerdictTicker items={t.ticker} />

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
          <span style={{ animation: "ops-blink 1.6s steps(1) infinite" }}>●</span> {t.eyebrow}
        </p>
        <h1 className="mt-5 max-w-[14ch] font-serif text-5xl font-medium leading-[1.02] tracking-[-0.02em] [text-wrap:balance] sm:text-7xl md:text-8xl">
          {t.h1a} <em className="italic text-primary">{t.h1b}</em>
        </h1>
        <p className="mt-6 max-w-[56ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t.sub}
        </p>

        {/* ── Esquema: a plataforma por dentro ── */}
        <div className="mt-14 overflow-hidden rounded-lg border border-primary/30 bg-primary/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/25 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{t.schematicHeader}</span>
            <span className="text-primary">
              <span style={{ animation: "ops-blink 1.6s steps(1) infinite" }}>●</span> {t.live}
            </span>
          </div>
          <OpsSchematic className="block h-auto w-full" labels={t.ops} />
        </div>

        {/* ── Contadores ── */}
        <div className="mt-14 grid grid-cols-1 gap-px border-y border-primary/25 bg-primary/25 sm:grid-cols-2 lg:grid-cols-4">
          {COUNTER_VALUES.map((c, i) => (
            <div key={i} className="bg-background px-5 py-6">
              <div className="font-mono text-4xl tabular-nums text-foreground">
                <CountUp target={c.target} locale={locale} />
                {c.suffix && <span className="text-[0.55em] text-primary">{c.suffix}</span>}
              </div>
              <p className="mt-2 font-mono text-xs tracking-wide text-muted-foreground">
                {t.counters[i]}
              </p>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="mt-12 flex flex-wrap items-center gap-5">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-7 py-3.5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.ctaMain}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="font-mono text-[13px] text-muted-foreground">{t.ctaGhost}</span>
        </div>
      </section>

      {/* ── O que a sala controla ── */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-24">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">
          {t.sectionEyebrow}
        </p>
        <h2 className="mt-4 max-w-[26ch] font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          {t.sectionTitle}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? Plug;
            return (
              <div
                key={f.title}
                className="rounded-lg border border-card-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 font-serif text-lg font-medium tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="mx-auto max-w-6xl px-5 py-24 text-center">
        <h2 className="mx-auto max-w-[24ch] font-serif text-4xl font-medium tracking-tight [text-wrap:balance] sm:text-5xl">
          {t.finalTitleA} <em className="italic text-primary">{t.finalTitleB}</em>
        </h2>
        <p className="mx-auto mt-5 max-w-[48ch] text-muted-foreground">{t.finalSub}</p>
        <div className="mt-9">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.finalCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Rodapé ── */}
      <footer className="border-t border-primary/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="flex items-center gap-2">
            <MusterMark className="h-4 w-4" /> Muster · AI Workforce Operations
          </span>
          <span>{t.footerRight}</span>
        </div>
      </footer>
    </div>
  );
}
