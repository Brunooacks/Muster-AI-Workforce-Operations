import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Fingerprint,
  Gavel,
  Layers,
  Pause,
  Play,
  Plug,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

/* ── Scenario data (100% mocked client-side) ───────────────── */

type LayerScore = { label: string; score: number };
type VerdictKind = "promote" | "mentor" | "retire";

type Scenario = {
  id: string;
  category: string;
  agent: { name: string; platform: string; role: string };
  layers: LayerScore[];
  health: number;
  illusoryWin: boolean;
  illusoryNote?: string;
  verdict: VerdictKind;
  confidence: number;
  window: string;
  actions: string[];
};

const LAYER_LABELS = ["Eficácia", "Eficiência", "Adoção", "Governança", "Valor"] as const;

const SCENARIOS: Scenario[] = [
  {
    id: "atlas",
    category: "Suporte",
    agent: { name: "Atlas", platform: "Zendesk", role: "Triagem de suporte N1" },
    layers: [
      { label: "Eficácia", score: 91 },
      { label: "Eficiência", score: 84 },
      { label: "Adoção", score: 88 },
      { label: "Governança", score: 79 },
      { label: "Valor", score: 93 },
    ],
    health: 87,
    illusoryWin: false,
    verdict: "promote",
    confidence: 94,
    window: "Próximo trimestre",
    actions: [
      "Ampliar escopo para filas N2",
      "Elevar limite de autonomia",
      "Definir nova meta de valor",
    ],
  },
  {
    id: "vega",
    category: "Marketing",
    agent: { name: "Vega", platform: "HubSpot", role: "Qualificação de leads" },
    layers: [
      { label: "Eficácia", score: 72 },
      { label: "Eficiência", score: 58 },
      { label: "Adoção", score: 81 },
      { label: "Governança", score: 49 },
      { label: "Valor", score: 64 },
    ],
    health: 65,
    illusoryWin: true,
    illusoryNote: "Volume alto mascara baixa conversão real",
    verdict: "mentor",
    confidence: 78,
    window: "Próximas 4 semanas",
    actions: [
      "Recalibrar critério de lead qualificado",
      "Revisar guardrails de governança",
      "Acompanhamento semanal do comitê",
    ],
  },
  {
    id: "orion",
    category: "Produtividade",
    agent: { name: "Orion", platform: "Notion AI", role: "Resumo de reuniões" },
    layers: [
      { label: "Eficácia", score: 41 },
      { label: "Eficiência", score: 38 },
      { label: "Adoção", score: 27 },
      { label: "Governança", score: 52 },
      { label: "Valor", score: 23 },
    ],
    health: 36,
    illusoryWin: false,
    verdict: "retire",
    confidence: 88,
    window: "Imediato",
    actions: [
      "Encerrar acesso às integrações",
      "Arquivar Carteira de Trabalho",
      "Migrar tarefas para fluxo nativo",
    ],
  },
  {
    id: "lyra",
    category: "Vendas",
    agent: { name: "Lyra", platform: "Salesforce", role: "Cadência de SDR" },
    layers: [
      { label: "Eficácia", score: 85 },
      { label: "Eficiência", score: 90 },
      { label: "Adoção", score: 76 },
      { label: "Governança", score: 81 },
      { label: "Valor", score: 87 },
    ],
    health: 84,
    illusoryWin: false,
    verdict: "promote",
    confidence: 90,
    window: "Próximo trimestre",
    actions: [
      "Expandir para contas enterprise",
      "Conectar ao forecast de receita",
      "Aumentar cota de cadências ativas",
    ],
  },
  {
    id: "nova",
    category: "Dados",
    agent: { name: "Nova", platform: "Snowflake", role: "Qualidade de dados" },
    layers: [
      { label: "Eficácia", score: 77 },
      { label: "Eficiência", score: 69 },
      { label: "Adoção", score: 54 },
      { label: "Governança", score: 71 },
      { label: "Valor", score: 61 },
    ],
    health: 67,
    illusoryWin: true,
    illusoryNote: "Muitos alertas, mas alta taxa de falsos positivos",
    verdict: "mentor",
    confidence: 80,
    window: "Próximas 6 semanas",
    actions: [
      "Reduzir falsos positivos de alerta",
      "Ampliar cobertura de testes de dados",
      "Treinar squad de dados no fluxo",
    ],
  },
];

const VERDICT_META: Record<
  VerdictKind,
  { label: string; icon: typeof TrendingUp; toneText: string; toneBg: string; barClass: string }
> = {
  promote: {
    label: "Promover",
    icon: TrendingUp,
    toneText: "text-chart-1",
    toneBg: "bg-chart-1/15",
    barClass: "bg-chart-1",
  },
  mentor: {
    label: "Mentorar",
    icon: Minus,
    toneText: "text-chart-2-text",
    toneBg: "bg-chart-2/20",
    barClass: "bg-chart-2",
  },
  retire: {
    label: "Aposentar",
    icon: TrendingDown,
    toneText: "text-chart-3-text",
    toneBg: "bg-chart-3/15",
    barClass: "bg-chart-3",
  },
};

function barTone(score: number) {
  if (score >= 70) return "bg-chart-1";
  if (score >= 50) return "bg-chart-2";
  return "bg-chart-3";
}

/* ── Cycle config ──────────────────────────────────────────── */

const PHASES = ["Admissão", "Avaliação", "Veredito"] as const;
const PHASE_DURATIONS = [2800, 4600, 4200]; // ms per phase
const TOTAL_STEPS = SCENARIOS.length * PHASES.length;

/* ── Component ─────────────────────────────────────────────── */

export default function LandingDemo() {
  const reduce = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef<number | null>(null);

  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  const scenarioIndex = Math.floor(step / PHASES.length) % SCENARIOS.length;
  const phase = step % PHASES.length; // 0 admission, 1 evaluation, 2 verdict
  const scenario = SCENARIOS[scenarioIndex];

  // Step within the pinned scenario's phases, or across the whole cycle when unpinned.
  const stepBy = useCallback((dir: 1 | -1) => {
    setStep((s) => {
      const pin = pinnedRef.current;
      if (pin !== null) {
        const ph = s % PHASES.length;
        return pin * PHASES.length + ((ph + dir + PHASES.length) % PHASES.length);
      }
      return (s + dir + TOTAL_STEPS) % TOTAL_STEPS;
    });
  }, []);

  const advance = useCallback(() => stepBy(1), [stepBy]);
  const goPrev = useCallback(() => stepBy(-1), [stepBy]);
  const goToScenario = useCallback((i: number) => {
    setPinned(i);
    setStep(i * PHASES.length);
  }, []);
  const resumeAuto = useCallback(() => setPinned(null), []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(advance, PHASE_DURATIONS[phase]);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, paused, phase, advance]);

  const evaluated = phase >= 1;
  const decided = phase >= 2;
  const verdictMeta = VERDICT_META[scenario.verdict];

  const transition = useMemo(
    () => (reduce ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }),
    [reduce],
  );

  return (
    <div className="relative">
      <div
        className="absolute -inset-x-10 -top-10 bottom-0 -z-10 opacity-40 blur-3xl"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, hsl(var(--primary) / 0.2), transparent 70%)" }}
      />

      {/* ── Scenario selector (jump by platform) ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Ver caso
        </span>
        <button
          type="button"
          onClick={resumeAuto}
          aria-pressed={pinned === null}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            pinned === null
              ? "bg-primary text-primary-foreground"
              : "border border-card-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          Automático
        </button>
        {SCENARIOS.map((s, i) => {
          const isPinned = pinned === i;
          const isPlaying = pinned === null && scenarioIndex === i;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goToScenario(i)}
              aria-pressed={isPinned}
              title={`${s.agent.name} · ${s.agent.role}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isPinned
                  ? "bg-primary text-primary-foreground"
                  : isPlaying
                    ? "border border-primary/50 bg-primary/5 text-primary"
                    : "border border-card-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {s.agent.platform}
              <span
                className={`font-mono text-[10px] uppercase tracking-wider ${
                  isPinned ? "text-primary-foreground/70" : "text-muted-foreground/70"
                }`}
              >
                {s.category}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl">
        {/* ── Top bar: live + step tracker ── */}
        <div className="flex flex-col gap-3 border-b border-card-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              {!reduce && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-1 opacity-75" />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-chart-1" />
            </span>
            {pinned === null
              ? "Demo ao vivo · ciclo do comitê"
              : `Cenário fixado · ${scenario.agent.platform}`}
          </div>

          <div className="flex items-center gap-1.5">
            {PHASES.map((p, i) => (
              <div key={p} className="flex items-center gap-1.5">
                <span
                  className={`font-mono text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    i === phase ? "text-primary" : "text-muted-foreground/50"
                  }`}
                >
                  {p}
                </span>
                {i < PHASES.length - 1 && (
                  <span className="text-muted-foreground/30">·</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Stage ── */}
        <div className="relative min-h-[420px] p-6 md:p-8">
          {/* Agent identity header (always visible once admitted) */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                key={`disc-${scenario.id}`}
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={transition}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-xl font-medium text-primary"
              >
                {scenario.agent.name.charAt(0)}
              </motion.div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {scenario.agent.platform} · admitido
                </p>
                <p className="font-serif text-lg font-medium leading-tight">{scenario.agent.name}</p>
                <p className="text-xs text-muted-foreground">{scenario.agent.role}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Saúde
              </p>
              <p
                className={`font-serif text-3xl font-medium tabular-nums transition-colors ${
                  evaluated ? verdictMeta.toneText : "text-muted-foreground/40"
                }`}
              >
                {evaluated ? scenario.health : "—"}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* ── PHASE 0: Admissão ── */}
            {phase === 0 && (
              <motion.div
                key={`admission-${scenario.id}`}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -12 }}
                transition={transition}
                className="flex flex-col items-center justify-center gap-5 py-10 text-center"
              >
                <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Plug className="h-4 w-4" strokeWidth={1.75} />
                  Descobrindo via conector {scenario.agent.platform}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                  <Fingerprint className="h-4 w-4 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="max-w-md font-serif text-2xl font-medium leading-tight md:text-3xl">
                  Agente admitido na frota com{" "}
                  <span className="italic text-primary">Carteira de Trabalho</span>.
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {["Identidade", "Donos", "Histórico versionado"].map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={reduce ? { duration: 0 } : { delay: 0.25 + i * 0.18, duration: 0.4 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                    >
                      <Check className="h-3 w-3 text-chart-1" strokeWidth={2.5} />
                      {tag}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── PHASE 1 & 2: Avaliação / Veredito ── */}
            {phase >= 1 && (
              <motion.div
                key={`eval-${scenario.id}`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={transition}
                className="grid gap-6 md:grid-cols-[1.4fr_1fr]"
              >
                {/* 5-layer scores */}
                <div>
                  <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Avaliação em 3 camadas
                  </div>
                  <div className="space-y-3">
                    {scenario.layers.map((l, i) => (
                      <div key={l.label}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{l.label}</span>
                          <motion.span
                            key={`${scenario.id}-${l.label}-num`}
                            initial={reduce ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={reduce ? { duration: 0 } : { delay: 0.2 + i * 0.14, duration: 0.4 }}
                            className="font-mono font-semibold tabular-nums"
                          >
                            {l.score}
                          </motion.span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <motion.div
                            key={`${scenario.id}-${l.label}-bar`}
                            className={`h-full rounded-full ${barTone(l.score)}`}
                            initial={reduce ? false : { width: 0 }}
                            animate={{ width: `${l.score}%` }}
                            transition={
                              reduce
                                ? { duration: 0 }
                                : { delay: 0.15 + i * 0.14, duration: 0.7, ease: [0.22, 1, 0.36, 1] }
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Illusory-win alert */}
                  <AnimatePresence>
                    {scenario.illusoryWin && (
                      <motion.div
                        key={`illusory-${scenario.id}`}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0 }}
                        transition={reduce ? { duration: 0 } : { delay: 1, duration: 0.5 }}
                        className="mt-4 flex items-start gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2"
                      >
                        <motion.span
                          animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
                          transition={reduce ? undefined : { repeat: Infinity, duration: 1.4 }}
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-3-text" strokeWidth={2} />
                        </motion.span>
                        <div>
                          <p className="text-xs font-semibold text-chart-3-text">Vitória ilusória detectada</p>
                          <p className="text-xs text-muted-foreground">{scenario.illusoryNote}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Verdict panel */}
                <div className="flex flex-col">
                  <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <Gavel className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Veredito do comitê
                  </div>

                  <AnimatePresence mode="wait">
                    {!decided ? (
                      <motion.div
                        key="awaiting"
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduce ? undefined : { opacity: 0 }}
                        transition={transition}
                        className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-card-border bg-background/50 px-4 py-8 text-center"
                      >
                        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          {reduce ? "Deliberando…" : "Cruzando KPIs…"}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="decided"
                        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className={`flex flex-1 flex-col rounded-xl border border-card-border ${verdictMeta.toneBg} p-4`}
                      >
                        <div className="flex items-center gap-2">
                          <verdictMeta.icon className={`h-5 w-5 ${verdictMeta.toneText}`} strokeWidth={2} />
                          <span className={`font-serif text-2xl font-medium ${verdictMeta.toneText}`}>
                            {verdictMeta.label}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                            Confiança
                          </span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/70">
                            <motion.div
                              className={`h-full rounded-full ${verdictMeta.barClass}`}
                              initial={reduce ? false : { width: 0 }}
                              animate={{ width: `${scenario.confidence}%` }}
                              transition={reduce ? { duration: 0 } : { delay: 0.2, duration: 0.6 }}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold tabular-nums">
                            {scenario.confidence}%
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          Janela · {scenario.window}
                        </p>

                        <div className="mt-3 space-y-1.5 border-t border-card-border/60 pt-3">
                          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                            Próximas ações
                          </p>
                          {scenario.actions.map((a, i) => (
                            <motion.div
                              key={a}
                              initial={reduce ? false : { opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={reduce ? { duration: 0 } : { delay: 0.3 + i * 0.12, duration: 0.35 }}
                              className="flex items-start gap-2 text-xs text-foreground"
                            >
                              <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${verdictMeta.barClass}`} />
                              {a}
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center justify-between gap-3 border-t border-card-border px-6 py-3">
          <div className="flex items-center gap-1.5">
            {SCENARIOS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToScenario(i)}
                aria-label={`Ver cenário ${s.agent.name}`}
                aria-current={i === scenarioIndex}
                className={`h-1.5 rounded-full transition-all ${
                  i === scenarioIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
            <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {scenario.agent.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Etapa anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar demo" : "Pausar demo"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {paused ? <Play className="h-3.5 w-3.5" strokeWidth={2} /> : <Pause className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
            <button
              type="button"
              onClick={advance}
              aria-label="Próxima etapa"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
