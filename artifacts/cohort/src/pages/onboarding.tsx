import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Bot,
  ChevronRight,
  Compass,
  Plug,
  Check,
  Link2,
  Download,
  ArrowRight,
  Gauge,
  Network,
  Radar,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { Pill, AgentDisc } from "@/components/cohort";
import {
  useListConnectors,
  useDiscoverAgents,
  useImportDiscoveredAgents,
  getListConnectorsQueryKey,
  type DiscoveryResult,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { completeOnboarding } from "@/lib/onboarding";
import { locationWithBrowserSearch, onboardingFallbackFromLocation } from "@/lib/auth-routing";
import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-badge";

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  steps: ["Boas-vindas", "Conectar fonte", "Mapear agentes"],
  skip: "Pular configuração",
  welcomeEyebrow: "Bem-vindo",
  welcomeTitle: "Veja sua força de trabalho ganhar contexto",
  welcomeSub:
    "Conecte uma fonte e o Muster transforma execução técnica em propósito, evidência e decisões de gestão.",
  time: "Experiência guiada · cerca de 2 minutos",
  liveLabel: "Simulação visual ao vivo",
  previewTitle: "Do runtime à decisão",
  previewAgent: "Atlas · Revisor de PR",
  previewRole: "Engenharia de Software",
  previewPhases: ["Conectar", "Observar", "Avaliar", "Agir"],
  explore: "Explorar o painel primeiro",
  features: [
    { t: "Conecte", d: "Cloud, SaaS ou local" },
    { t: "Entenda", d: "Função, propósito e risco" },
    { t: "Decida", d: "Com evidência contínua" },
  ],
  start: "Conectar minha primeira fonte",
  step2Eyebrow: "Passo 2",
  step2Title: "Conecte uma fonte",
  step2Sub:
    "Escolha uma origem. Conexão e discovery agora acontecem no mesmo fluxo.",
  step2Hint: "1 clique · sem formulário longo",
  connected: "Conectado",
  available: "Disponível",
  discovering: "Mapeando agentes…",
  runDiscovery: "Rodar discovery",
  connect: "Conectar e mapear",
  pipelineTitle: "O que o Muster fará",
  pipeline: [
    "Validar o contrato da fonte",
    "Identificar agentes e responsabilidades",
    "Sugerir métricas e evidências",
  ],
  back: "Voltar",
  doLater: "Fazer isso depois",
  step3Eyebrow: "Passo 3",
  step3Title: "Sua primeira equipe apareceu",
  step3Fallback: "Revise os agentes descobertos e admita-os na sua frota.",
  agentsFound: (n: number) => `${n} profissionais encontrados`,
  finishHint: "Você poderá ajustar função, propósito e métricas depois.",
  agentMeta: (role: string, n: number, c: number) =>
    `${role} · ${n} métricas · ${c}%`,
  alreadyInFleet: "Já na frota",
  newPill: "Novo",
  admitting: "Admitindo…",
  admitFinish: "Admitir e concluir",
  toastSourceConnected: "Fonte conectada",
  toastSourceDesc: (platform: string) => `${platform} vinculada.`,
  toastErr: "Erro",
  toastDiscoverFail: "Falha ao descobrir agentes.",
  toastFleetStarted: "Frota iniciada",
  toastAdmitted: (n: number) => `${n} agentes admitidos.`,
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    steps: ["Welcome", "Connect source", "Map agents"],
    skip: "Skip setup",
    welcomeEyebrow: "Welcome",
    welcomeTitle: "Watch your workforce gain context",
    welcomeSub:
      "Connect a source and Muster turns technical execution into purpose, evidence and management decisions.",
    time: "Guided experience · about 2 minutes",
    liveLabel: "Live visual simulation",
    previewTitle: "From runtime to decision",
    previewAgent: "Atlas · PR Reviewer",
    previewRole: "Software Engineering",
    previewPhases: ["Connect", "Observe", "Evaluate", "Act"],
    explore: "Explore the dashboard first",
    features: [
      { t: "Connect", d: "Cloud, SaaS or local" },
      { t: "Understand", d: "Role, purpose and risk" },
      { t: "Decide", d: "With continuous evidence" },
    ],
    start: "Connect my first source",
    step2Eyebrow: "Step 2",
    step2Title: "Connect a source",
    step2Sub: "Choose an origin. Connection and discovery now run in one flow.",
    step2Hint: "1 click · no long form",
    connected: "Connected",
    available: "Available",
    discovering: "Mapping agents…",
    runDiscovery: "Run discovery",
    connect: "Connect and map",
    pipelineTitle: "What Muster will do",
    pipeline: [
      "Validate the source contract",
      "Identify agents and responsibilities",
      "Suggest metrics and evidence",
    ],
    back: "Back",
    doLater: "Do this later",
    step3Eyebrow: "Step 3",
    step3Title: "Your first team is here",
    step3Fallback: "Review the discovered agents and admit them to your fleet.",
    agentsFound: (n: number) => `${n} professionals found`,
    finishHint: "You can adjust role, purpose and metrics later.",
    agentMeta: (role: string, n: number, c: number) =>
      `${role} · ${n} metrics · ${c}%`,
    alreadyInFleet: "Already in the fleet",
    newPill: "New",
    admitting: "Admitting…",
    admitFinish: "Admit and finish",
    toastSourceConnected: "Source connected",
    toastSourceDesc: (platform: string) => `${platform} linked.`,
    toastErr: "Error",
    toastDiscoverFail: "Failed to discover agents.",
    toastFleetStarted: "Fleet started",
    toastAdmitted: (n: number) => `${n} agents admitted.`,
  },
  es: {
    steps: ["Bienvenida", "Conectar fuente", "Mapear agentes"],
    skip: "Omitir configuración",
    welcomeEyebrow: "Bienvenido",
    welcomeTitle: "Mira cómo tu fuerza laboral gana contexto",
    welcomeSub:
      "Conecta una fuente y Muster transforma la ejecución técnica en propósito, evidencia y decisiones de gestión.",
    time: "Experiencia guiada · cerca de 2 minutos",
    liveLabel: "Simulación visual en vivo",
    previewTitle: "Del runtime a la decisión",
    previewAgent: "Atlas · Revisor de PR",
    previewRole: "Ingeniería de Software",
    previewPhases: ["Conectar", "Observar", "Evaluar", "Actuar"],
    explore: "Explorar el panel primero",
    features: [
      { t: "Conecta", d: "Cloud, SaaS o local" },
      { t: "Entiende", d: "Función, propósito y riesgo" },
      { t: "Decide", d: "Con evidencia continua" },
    ],
    start: "Conectar mi primera fuente",
    step2Eyebrow: "Paso 2",
    step2Title: "Conecta una fuente",
    step2Sub:
      "Elige un origen. Conexión y discovery ahora ocurren en un solo flujo.",
    step2Hint: "1 clic · sin formulario largo",
    connected: "Conectado",
    available: "Disponible",
    discovering: "Mapeando agentes…",
    runDiscovery: "Ejecutar discovery",
    connect: "Conectar y mapear",
    pipelineTitle: "Qué hará Muster",
    pipeline: [
      "Validar el contrato de la fuente",
      "Identificar agentes y responsabilidades",
      "Sugerir métricas y evidencias",
    ],
    back: "Volver",
    doLater: "Hacerlo después",
    step3Eyebrow: "Paso 3",
    step3Title: "Tu primer equipo apareció",
    step3Fallback: "Revisa los agentes descubiertos y admítelos en tu flota.",
    agentsFound: (n: number) => `${n} profesionales encontrados`,
    finishHint: "Podrás ajustar función, propósito y métricas después.",
    agentMeta: (role: string, n: number, c: number) =>
      `${role} · ${n} métricas · ${c}%`,
    alreadyInFleet: "Ya en la flota",
    newPill: "Nuevo",
    admitting: "Admitiendo…",
    admitFinish: "Admitir y concluir",
    toastSourceConnected: "Fuente conectada",
    toastSourceDesc: (platform: string) => `${platform} vinculada.`,
    toastErr: "Error",
    toastDiscoverFail: "Fallo al descubrir agentes.",
    toastFleetStarted: "Flota iniciada",
    toastAdmitted: (n: number) => `${n} agentes admitidos.`,
  },
};

export default function OnboardingPage() {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const { orgId } = useAuth();
  const { toast } = useToast();
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const t = L[lang];
  const [step, setStep] = useState(0);
  const [previewPhase, setPreviewPhase] = useState(0);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  const { data: connectors } = useListConnectors();
  const discoverAgents = useDiscoverAgents();
  const importAgents = useImportDiscoveredAgents();

  useEffect(() => {
    if (reduceMotion || step !== 0) return;
    const interval = window.setInterval(
      () => setPreviewPhase((current) => (current + 1) % t.previewPhases.length),
      1800,
    );
    return () => window.clearInterval(interval);
  }, [reduceMotion, step, t.previewPhases.length]);

  const finish = () => {
    completeOnboarding(user?.id, orgId);
    setLocation(
      onboardingFallbackFromLocation(
        locationWithBrowserSearch(location, window.location.search),
      ),
    );
  };

  function handleDiscover(connectorId: string) {
    setDiscoveringId(connectorId);
    discoverAgents.mutate(
      { connectorId },
      {
        onSuccess: (result) => {
          setDiscovery(result);
          setDiscoveringId(null);
          setStep(2);
        },
        onError: () => {
          setDiscoveringId(null);
          toast({
            title: t.toastErr,
            description: t.toastDiscoverFail,
            variant: "destructive",
          });
        },
      },
    );
  }

  const handleImportAll = () => {
    if (!discovery) return;
    const ids = discovery.agents
      .filter((a) => !a.alreadyImported)
      .map((a) => a.externalId);
    if (ids.length === 0) {
      finish();
      return;
    }
    importAgents.mutate(
      { connectorId: discovery.connectorId, data: { externalIds: ids } },
      {
        onSuccess: () => {
          toast({
            title: t.toastFleetStarted,
            description: t.toastAdmitted(ids.length),
          });
          queryClient.invalidateQueries({
            queryKey: getListConnectorsQueryKey(),
          });
          finish();
        },
      },
    );
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#07110d] text-[#f2f1e8]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[#6dd3a0]/10 blur-[120px]" />
        <div className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-[#6a7dff]/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1240px] flex-col px-4 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#8ce0b5]/25 bg-[#8ce0b5]/10 text-[#8ce0b5]">
              <Compass className="h-4 w-4" />
            </span>
            <span>
              <strong className="block font-serif text-lg font-medium tracking-tight">Muster</strong>
              <span className="hidden text-[9px] uppercase tracking-[0.15em] text-[#8b9b92] sm:block">AI Workforce Operations</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] text-[#9aaba1] sm:flex">
              <Timer className="h-3 w-3 text-[#8ce0b5]" /> {t.time}
            </span>
            <button type="button" onClick={finish} className="rounded-lg px-3 py-2 text-xs font-medium text-[#9aaba1] transition hover:bg-white/5 hover:text-[#f2f1e8]">
              {t.skip}
            </button>
          </div>
        </header>

        <nav aria-label="Onboarding" className="mx-auto mt-6 flex w-full max-w-2xl items-center">
          {t.steps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span className={cn("grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold transition-all duration-500", index < step ? "border-[#8ce0b5] bg-[#8ce0b5] text-[#07110d]" : index === step ? "border-[#8ce0b5] bg-[#8ce0b5]/15 text-[#b6f0d0] shadow-[0_0_24px_rgba(140,224,181,.18)]" : "border-white/10 bg-white/[0.035] text-[#63746a]")}>{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
                <span className={cn("hidden text-[10px] font-medium sm:block", index === step ? "text-[#e9eee9]" : "text-[#718078]")}>{label}</span>
              </div>
              {index < t.steps.length - 1 && <div className="mx-3 h-px min-w-5 flex-1 overflow-hidden bg-white/10"><motion.div className="h-full bg-[#8ce0b5]" animate={{ width: index < step ? "100%" : "0%" }} transition={{ duration: reduceMotion ? 0 : 0.45 }} /></div>}
            </div>
          ))}
        </nav>

        <div className="flex flex-1 items-center py-6 lg:py-8">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.section key="welcome" initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: reduceMotion ? 0 : -24 }} transition={{ duration: reduceMotion ? 0 : 0.4 }} className="grid w-full gap-8 lg:grid-cols-[.86fr_1.14fr] lg:items-center lg:gap-14">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#8ce0b5]/20 bg-[#8ce0b5]/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8ce0b5]"><Sparkles className="h-3 w-3" /> {t.welcomeEyebrow}</div>
                  <h1 className="mt-5 font-serif text-[clamp(2.5rem,5vw,4.7rem)] font-medium leading-[.98] tracking-[-0.05em] text-[#f4f1e7]">{t.welcomeTitle}</h1>
                  <p className="mt-5 max-w-lg text-sm leading-7 text-[#9aaba1] sm:text-base">{t.welcomeSub}</p>

                  <div className="mt-7 grid gap-2 sm:grid-cols-3">
                    {[{ icon: Plug, ...t.features[0]! }, { icon: Radar, ...t.features[1]! }, { icon: Zap, ...t.features[2]! }].map((feature, index) => (
                      <motion.div key={feature.t} initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : .12 + index * .08 }} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-3.5">
                        <feature.icon className="h-4 w-4 text-[#8ce0b5]" />
                        <strong className="mt-3 block text-xs font-medium text-[#e8ece8]">{feature.t}</strong>
                        <span className="mt-1 block text-[10px] text-[#7f9086]">{feature.d}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => setStep(1)} className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#8ce0b5] px-5 py-3 text-xs font-semibold text-[#07110d] shadow-[0_12px_40px_rgba(140,224,181,.16)] transition hover:bg-[#a1eac4]">
                      {t.start} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                    <button type="button" onClick={finish} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3 text-xs font-medium text-[#b6c2ba] transition hover:bg-white/[0.07] hover:text-white">
                      {t.explore} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <LiveWorkforcePreview copy={t} phase={previewPhase} reduceMotion={Boolean(reduceMotion)} />
              </motion.section>
            )}

            {step === 1 && (
              <motion.section key="connect" initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduceMotion ? 0 : -24 }} transition={{ duration: reduceMotion ? 0 : 0.35 }} className="grid w-full gap-5 lg:grid-cols-[1.3fr_.7fr]">
                <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1712]/90 shadow-2xl shadow-black/20">
                  <div className="border-b border-white/[0.08] p-5 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8ce0b5]">{t.step2Eyebrow}</span><h2 className="mt-2 font-serif text-3xl font-medium tracking-[-0.035em]">{t.step2Title}</h2><p className="mt-2 max-w-xl text-xs leading-6 text-[#8ea097]">{t.step2Sub}</p></div>
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#8ce0b5]/10 px-3 py-1.5 text-[9px] text-[#a9e9c8]"><Zap className="h-3 w-3" /> {t.step2Hint}</span>
                    </div>
                  </div>

                  <div className="grid max-h-[52vh] gap-px overflow-y-auto bg-white/[0.07] sm:grid-cols-2">
                    {(connectors ?? []).map((connector) => {
                      const connected = connector.status === "connected";
                      const canDiscover = connected && connector.mode === "native";
                      const busy = discoveringId === connector.id || discoveringId === `platform:${connector.platform}`;
                      return (
                        <article key={connector.id} className="flex min-h-40 flex-col bg-[#0b1712] p-4 transition hover:bg-[#0e1c16]">
                          <div className="flex items-start gap-3">
                            <PlatformIcon platform={connector.platform} size="lg" />
                            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><strong className="truncate text-xs font-medium text-[#edf0eb]">{connector.name}</strong><span className={cn("rounded-full px-2 py-1 text-[8px] font-medium uppercase tracking-[0.06em]", connected ? "bg-[#8ce0b5]/12 text-[#8ce0b5]" : "bg-white/5 text-[#829188]")}>{connected ? t.connected : t.available}</span></div><span className="mt-1 block text-[9px] text-[#74847b]">{connector.category}</span></div>
                          </div>
                          <button type="button" disabled={busy || discoverAgents.isPending} onClick={() => canDiscover ? handleDiscover(connector.id) : setLocation("/conectores")} className={cn("mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-semibold transition disabled:cursor-wait disabled:opacity-70", canDiscover ? "border border-white/10 bg-white/[0.035] text-[#d7dfda] hover:bg-white/[0.07]" : "bg-[#8ce0b5] text-[#07110d] hover:bg-[#a1eac4]")}>{busy ? <><motion.span animate={reduceMotion ? undefined : { rotate: 360 }} transition={{ duration: .8, repeat: Infinity, ease: "linear" }}><Radar className="h-3.5 w-3.5" /></motion.span>{t.discovering}</> : canDiscover ? <><Sparkles className="h-3.5 w-3.5" />{t.runDiscovery}</> : <><Link2 className="h-3.5 w-3.5" />{connected ? "Abrir integração" : t.connect}</>}</button>
                        </article>
                      );
                    })}
                    {!connectors?.length && Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse bg-[#0b1712] p-4"><div className="h-10 w-10 rounded-xl bg-white/5" /><div className="mt-4 h-2 w-1/2 rounded bg-white/5" /><div className="mt-8 h-8 rounded-lg bg-white/5" /></div>)}
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-4"><button type="button" onClick={() => setStep(0)} className="text-xs text-[#8fa097] hover:text-white">{t.back}</button><button type="button" onClick={finish} className="text-xs text-[#8fa097] hover:text-white">{t.doLater}</button></div>
                </section>

                <PipelinePreview copy={t} active={discoveringId !== null} reduceMotion={Boolean(reduceMotion)} />
              </motion.section>
            )}

            {step === 2 && (
              <motion.section key="agents" initial={{ opacity: 0, scale: reduceMotion ? 1 : .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.35 }} className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b1712]/95 shadow-2xl shadow-black/25">
                <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
                  <div><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8ce0b5]">{t.step3Eyebrow}</span><h2 className="mt-2 font-serif text-3xl font-medium tracking-[-0.035em]">{t.step3Title}</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-[#8ea097]">{discovery?.coverageNote ?? t.step3Fallback}</p></div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#8ce0b5]/20 bg-[#8ce0b5]/10 px-3 py-2 text-[10px] font-medium text-[#aceaca]"><Bot className="h-4 w-4" /> {t.agentsFound(discovery?.agents.length ?? 0)}</span>
                </div>

                <div className="grid gap-px bg-white/[0.07] md:grid-cols-2">
                  {(discovery?.agents ?? []).map((agent, index) => (
                    <motion.article key={agent.externalId} initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : index * .07 }} className="flex items-center justify-between gap-4 bg-[#0b1712] p-5">
                      <div className="flex min-w-0 items-center gap-3"><AgentDisc name={agent.name} size="sm" /><div className="min-w-0"><strong className="block truncate text-xs font-medium text-[#edf0eb]">{agent.name}</strong><span className="mt-1 block truncate text-[9px] text-[#7f9086]">{t.agentMeta(agent.role, agent.proposedMetrics.length, agent.confidence)}</span><div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-white/[0.06]"><motion.div initial={{ width: 0 }} animate={{ width: `${agent.confidence}%` }} transition={{ delay: reduceMotion ? 0 : .15 + index * .07, duration: reduceMotion ? 0 : .6 }} className="h-full rounded-full bg-[#8ce0b5]" /></div></div></div>
                      {agent.alreadyImported ? <Pill tone="sage">{t.alreadyInFleet}</Pill> : <Pill tone="ochre">{t.newPill}</Pill>}
                    </motion.article>
                  ))}
                </div>

                <div className="flex flex-col gap-4 border-t border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><button type="button" onClick={() => setStep(1)} className="text-xs text-[#8fa097] hover:text-white">{t.back}</button><div className="flex flex-col items-stretch gap-3 sm:items-end"><span className="text-[9px] text-[#718078]">{t.finishHint}</span><button type="button" onClick={handleImportAll} disabled={importAgents.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8ce0b5] px-5 py-3 text-xs font-semibold text-[#07110d] transition hover:bg-[#a1eac4] disabled:opacity-60"><Download className="h-4 w-4" />{importAgents.isPending ? t.admitting : t.admitFinish}</button></div></div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

function LiveWorkforcePreview({ copy, phase, reduceMotion }: { copy: Dict; phase: number; reduceMotion: boolean }) {
  const metrics = [
    { label: "Propósito", value: [32, 54, 78, 91][phase]!, icon: Gauge },
    { label: "Evidência", value: [18, 67, 84, 96][phase]!, icon: Activity },
    { label: "Governança", value: [24, 46, 82, 94][phase]!, icon: ShieldCheck },
  ];
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <motion.div animate={reduceMotion ? undefined : { y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0a1611]/95 p-3 shadow-[0_30px_90px_rgba(0,0,0,.38)] sm:p-5">
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-4"><div><span className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8ce0b5]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8ce0b5]" />{copy.liveLabel}</span><strong className="mt-1.5 block text-sm font-medium">{copy.previewTitle}</strong></div><Network className="h-4 w-4 text-[#75877d]" /></div>
        <div className="relative py-6 sm:px-5">
          <div className="absolute left-1/2 top-7 h-[calc(100%-3rem)] w-px -translate-x-1/2 bg-gradient-to-b from-[#8ce0b5]/50 via-white/10 to-transparent" />
          <div className="relative flex justify-center gap-3">
            {["github", "openai-agents", "vllm-local"].map((platform, index) => <motion.div key={platform} animate={reduceMotion ? undefined : { y: phase === 0 ? [0, -4, 0] : 0 }} transition={{ delay: index * .15, duration: 1.4, repeat: phase === 0 ? Infinity : 0 }} className="rounded-xl border border-white/10 bg-[#101f18] p-2 shadow-lg"><PlatformIcon platform={platform} size="lg" /></motion.div>)}
          </div>
          <motion.div layout className="relative mx-auto mt-8 max-w-md rounded-2xl border border-[#8ce0b5]/20 bg-[#0f2018] p-4 shadow-[0_16px_50px_rgba(0,0,0,.28)]">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#8ce0b5] font-serif text-base font-semibold text-[#07110d]">A</span><div><strong className="block text-xs font-medium">{copy.previewAgent}</strong><span className="mt-1 block text-[9px] text-[#82938a]">{copy.previewRole}</span></div><span className="ml-auto rounded-full bg-[#8ce0b5]/10 px-2 py-1 text-[8px] uppercase tracking-[0.07em] text-[#8ce0b5]">live</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">{metrics.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl bg-black/15 p-2.5"><div className="flex items-center justify-between"><span className="text-[8px] text-[#788980]">{label}</span><Icon className="h-3 w-3 text-[#8ce0b5]" /></div><strong className="mt-2 block font-mono text-base font-medium">{value}%</strong><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]"><motion.div animate={{ width: `${value}%` }} transition={{ duration: reduceMotion ? 0 : .7 }} className="h-full rounded-full bg-[#8ce0b5]" /></div></div>)}</div>
          </motion.div>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/15 p-1.5">{copy.previewPhases.map((label, index) => <div key={label} className={cn("relative overflow-hidden rounded-lg px-2 py-2.5 text-center text-[8px] font-medium transition-colors", phase === index ? "text-[#07110d]" : "text-[#75877d]")}>{phase === index && <motion.span layoutId="active-onboarding-phase" className="absolute inset-0 rounded-lg bg-[#8ce0b5]" transition={{ duration: reduceMotion ? 0 : .3 }} />}<span className="relative">0{index + 1} · {label}</span></div>)}</div>
      </motion.div>
      <div className="absolute -bottom-4 left-8 right-8 -z-10 h-20 rounded-full bg-[#8ce0b5]/15 blur-3xl" />
    </div>
  );
}

function PipelinePreview({ copy, active, reduceMotion }: { copy: Dict; active: boolean; reduceMotion: boolean }) {
  const icons = [Link2, Radar, Gauge];
  return (
    <aside className="rounded-2xl border border-white/10 bg-[#0b1712]/90 p-5 lg:p-6">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8ce0b5]">Discovery visual</span>
      <h3 className="mt-2 font-serif text-2xl font-medium tracking-[-0.03em]">{copy.pipelineTitle}</h3>
      <div className="mt-6 space-y-3">{copy.pipeline.map((label, index) => { const Icon = icons[index]!; return <div key={label} className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#8ce0b5]/10 text-[#8ce0b5]"><Icon className="h-4 w-4" /></span><div className="min-w-0"><span className="block text-[8px] uppercase tracking-[0.1em] text-[#687970]">0{index + 1}</span><strong className="mt-1 block text-[10px] font-medium text-[#dce3de]">{label}</strong></div>{active && <motion.span initial={{ x: "-100%" }} animate={reduceMotion ? { x: 0 } : { x: ["-100%", "400%"] }} transition={{ duration: 1.8, repeat: reduceMotion ? 0 : Infinity, delay: index * .25, ease: "easeInOut" }} className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-[#8ce0b5]/10 to-transparent" />}</div>; })}</div>
      <div className="mt-6 rounded-xl border border-[#8ce0b5]/15 bg-[#8ce0b5]/[0.06] p-4"><div className="flex items-center gap-2 text-[9px] font-medium text-[#a7e8c6]"><ShieldCheck className="h-3.5 w-3.5" /> Tenant protegido</div><p className="mt-2 text-[9px] leading-5 text-[#74857c]">Identidade, credenciais e dados descobertos permanecem vinculados à organização ativa.</p></div>
    </aside>
  );
}
