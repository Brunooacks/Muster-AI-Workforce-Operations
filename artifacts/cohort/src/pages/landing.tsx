import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Fingerprint, Layers, Gavel, AlertTriangle, Users, Plug, Activity, Gauge, ShieldCheck, Target } from "lucide-react";
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
  mvpEyebrow: string;
  mvpTitle: string;
  mvpSub: string;
  mvpCards: Array<{ title: string; desc: string; meta: string; href: string }>;
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
    h1a: "Seus agentes de IA já trabalham.",
    h1b: "Alguém avalia o desempenho deles?",
    sub: "Um agente pode bater a meta que você mede e ainda assim entregar o resultado errado. O Muster avalia cada agente em cinco camadas — eficácia, eficiência, adoção, governança e valor —, mostra quando uma sobe às custas da outra e transforma isso numa decisão do comitê: promover, mentorar ou aposentar.",
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
    sectionTitle: "Gestão de desempenho e governança para uma força de trabalho que não dorme.",
    features: [
      { title: "Admissão & Identidade", desc: "Descubra agentes via conectores e admita-os na frota com identidade e Carteira de Trabalho versionada." },
      { title: "Avaliação em 5 camadas", desc: "Eficácia, eficiência, adoção, governança e valor — leitura sistêmica, não métrica isolada." },
      { title: "Detector de Vitória Ilusória", desc: "Compara sucesso local, conclusão end-to-end e handoffs para revelar quando uma etapa parece saudável, mas o resultado real não se confirma." },
      { title: "Veredito do Comitê", desc: "Promover, Mentorar ou Aposentar — com confiança, janela de execução e próximas três ações." },
      { title: "Comitê & Governança", desc: "Dono de negócio, técnico e sponsor por agente — trilha auditável de cada veredito." },
      { title: "Sem instrumentar seus agentes", desc: "Leia a telemetria que sua nuvem já produz — Azure Monitor, CloudWatch, Cloud Logging — com credencial somente leitura. Ou reporte por SDK e REST, em qualquer linguagem." },
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
    mvpEyebrow: "Capacidades operacionais",
    mvpTitle: "Do agente isolado à jornada completa.",
    mvpSub: "Modele o trabalho, acompanhe os sinais e transforme cada recomendação aprovada em ações com responsável, autonomia e prazo.",
    mvpCards: [
      { title: "Times mistos", desc: "Defina propósito, owner, supervisor e responsabilidades entre pessoas e agentes.", meta: "Propósito + papéis + decisão", href: "/equipes" },
      { title: "KPIs por domínio", desc: "Avalie atendimento, vendas, engenharia, risco e pessoas com contratos de fórmula, alvo e guardrail.", meta: "20 contratos · 4 domínios", href: "/equipes" },
      { title: "Evidência auditável", desc: "Telemetria vira observação com fonte, linhagem, confiança e amostra antes de influenciar o veredito.", meta: "Fonte + confiança + baseline", href: "/metricas" },
      { title: "Discovery orientado", desc: "Descubra o que cada agente faz, proponha métricas e importe candidatos para a frota.", meta: "GitHub hoje · extensível", href: "/conectores" },
      { title: "Jornadas A2A", desc: "Conecte agentes e pessoas em um fluxo end-to-end, monitore handoffs e desdobre recomendações em ações com SLA.", meta: "Frota + handoff + ação", href: "/jornadas" },
    ],
    ops: OPS_LABELS_PT,
  },
  en: {
    signIn: "Sign in",
    signUp: "Create account",
    eyebrow: "Command room · fleet live",
    h1a: "Your AI agents are already working.",
    h1b: "Is anyone reviewing how they perform?",
    sub: "An agent can hit the metric you measure and still deliver the wrong outcome. Muster evaluates every agent across five layers — efficacy, efficiency, adoption, governance and value —, shows when one rises at another's expense, and turns that into a committee decision: promote, mentor or retire.",
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
    sectionTitle: "Performance management and governance for a workforce that never sleeps.",
    features: [
      { title: "Admission & Identity", desc: "Discover agents via connectors and admit them to the fleet with identity and a versioned Work Record." },
      { title: "5-layer evaluation", desc: "Efficacy, efficiency, adoption, governance and value — a systemic reading, not an isolated metric." },
      { title: "Illusory Victory Detector", desc: "Compares local success, end-to-end completion and handoffs to reveal when a step looks healthy but the real outcome is not confirmed." },
      { title: "Committee Verdict", desc: "Promote, Mentor or Retire — with confidence, execution window and the next three actions." },
      { title: "Committee & Governance", desc: "Business, technical and sponsor owners per agent — an auditable trail for every verdict." },
      { title: "No agent instrumentation needed", desc: "Read the telemetry your cloud already produces — Azure Monitor, CloudWatch, Cloud Logging — with read-only credentials. Or report via SDK and REST, in any language." },
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
    mvpEyebrow: "Operational capabilities",
    mvpTitle: "From isolated agent to complete journey.",
    mvpSub: "Model the work, follow the signals and turn each approved recommendation into accountable actions with autonomy and deadlines.",
    mvpCards: [
      { title: "Mixed teams", desc: "Define purpose, owner, supervisor and responsibilities across people and agents.", meta: "Purpose + roles + decision", href: "/equipes" },
      { title: "Domain KPIs", desc: "Evaluate support, sales, engineering, risk and people with formula, target and guardrail contracts.", meta: "20 contracts · 4 domains", href: "/equipes" },
      { title: "Auditable evidence", desc: "Telemetry becomes an observation with source, lineage, confidence and sample before affecting a verdict.", meta: "Source + confidence + baseline", href: "/metricas" },
      { title: "Guided discovery", desc: "Discover what each agent does, propose metrics and import candidates into the fleet.", meta: "GitHub today · extensible", href: "/conectores" },
      { title: "A2A journeys", desc: "Connect agents and people in an end-to-end flow, monitor handoffs and unfold recommendations into SLA-bound actions.", meta: "Fleet + handoff + action", href: "/jornadas" },
    ],
    ops: OPS_EN,
  },
  es: {
    signIn: "Iniciar sesión",
    signUp: "Crear cuenta",
    eyebrow: "Sala de mando · flota en vivo",
    h1a: "Tus agentes de IA ya trabajan.",
    h1b: "¿Alguien evalúa su desempeño?",
    sub: "Un agente puede cumplir la métrica que mides y aun así entregar el resultado equivocado. Muster evalúa cada agente en cinco capas — eficacia, eficiencia, adopción, gobernanza y valor —, muestra cuándo una sube a costa de otra y lo convierte en una decisión del comité: promover, mentorizar o retirar.",
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
    sectionTitle: "Gestión del desempeño y gobernanza para una fuerza laboral que no duerme.",
    features: [
      { title: "Admisión e Identidad", desc: "Descubre agentes vía conectores y admítelos en la flota con identidad y Expediente Laboral versionado." },
      { title: "Evaluación en 5 capas", desc: "Eficacia, eficiencia, adopción, gobernanza y valor — lectura sistémica, no métrica aislada." },
      { title: "Detector de Victoria Ilusoria", desc: "Compara éxito local, conclusión end-to-end y handoffs para revelar cuando una etapa parece saludable, pero el resultado real no se confirma." },
      { title: "Veredicto del Comité", desc: "Ascender, Mentoría o Retirar — con confianza, ventana de ejecución y las próximas tres acciones." },
      { title: "Comité y Gobernanza", desc: "Dueño de negocio, técnico y sponsor por agente — trazabilidad auditable de cada veredicto." },
      { title: "Sin instrumentar tus agentes", desc: "Lee la telemetría que tu nube ya produce — Azure Monitor, CloudWatch, Cloud Logging — con credencial de solo lectura. O reporta por SDK y REST, en cualquier lenguaje." },
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
    mvpEyebrow: "Capacidades operativas",
    mvpTitle: "Del agente aislado a la jornada completa.",
    mvpSub: "Modela el trabajo, acompaña las señales y convierte cada recomendación aprobada en acciones con responsable, autonomía y plazo.",
    mvpCards: [
      { title: "Equipos mixtos", desc: "Define propósito, owner, supervisor y responsabilidades entre personas y agentes.", meta: "Propósito + roles + decisión", href: "/equipes" },
      { title: "KPIs por dominio", desc: "Evalúa atención, ventas, ingeniería, riesgo y personas con contratos de fórmula, objetivo y guardrail.", meta: "20 contratos · 4 dominios", href: "/equipes" },
      { title: "Evidencia auditable", desc: "La telemetría se convierte en observación con fuente, linaje, confianza y muestra antes del veredicto.", meta: "Fuente + confianza + baseline", href: "/metricas" },
      { title: "Discovery orientado", desc: "Descubre qué hace cada agente, propone métricas e importa candidatos a la flota.", meta: "GitHub hoy · extensible", href: "/conectores" },
      { title: "Jornadas A2A", desc: "Conecta agentes y personas en un flujo end-to-end, monitorea handoffs y despliega recomendaciones en acciones con SLA.", meta: "Flota + handoff + acción", href: "/jornadas" },
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

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-20">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-primary">{t.mvpEyebrow}</p>
        <h2 className="mt-4 max-w-[27ch] font-serif text-3xl font-medium tracking-tight sm:text-4xl">{t.mvpTitle}</h2>
        <p className="mt-4 max-w-[62ch] text-muted-foreground">{t.mvpSub}</p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.mvpCards.map((card, i) => {
            const Icon = [Users, Gauge, ShieldCheck, Target][i] ?? Activity;
            return (
              <Link key={card.title} href={card.href} className="group rounded-lg border border-card-border bg-card/70 p-5 transition-colors hover:border-primary/50 hover:bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <h3 className="mt-5 font-serif text-lg font-medium tracking-tight">{card.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{card.desc}</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-primary/80">{card.meta}</p>
              </Link>
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
