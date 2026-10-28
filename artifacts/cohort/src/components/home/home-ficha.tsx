import { useEffect, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { MusterMark } from "@/components/logo";
import { useLang, localize, type Lang } from "@/lib/i18n";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const TABS_PT = [
  { label: "Identidade", badge: "ATIVA", badgeColor: "chart-1" },
  { label: "Objetivos e KPIs", badge: "METAS DO TRIMESTRE", badgeColor: "foreground" },
  { label: "Acompanhamento", badge: "AO VIVO", badgeColor: "chart-1" },
  { label: "Decisão", badge: "AGUARDA MARINA", badgeColor: "chart-2" },
] as const;

const FIELDS_PT = [
  { label: "OBJETIVO", value: "Resolver 90% dos chamados de 1º nível sem escalar" },
  { label: "LIMITE", value: "Reembolsa até R$ 500 sozinha" },
  { label: "RESPONSÁVEL", value: "Marina Alves · CX" },
];

const METRICS_PT = [
  { label: "Qualidade", value: "93%", width: "93%" },
  { label: "Resultado real", value: "91%", width: "91%" },
  { label: "Prova", value: "96%", width: "96%" },
];

const CALLOUTS_LEFT_PT = [
  { title: "Identidade", desc: "Nome, função e onde roda.", abas: [0] },
  { title: "Objetivo e limite", desc: "O que deve entregar e até onde vai sozinho.", abas: [1] },
];

const CALLOUTS_RIGHT_PT = [
  { title: "Responsável", desc: "Uma pessoa com nome responde por ele.", abas: [1] },
  { title: "Indicadores e prova", desc: "Como está indo, com a origem de cada número.", abas: [2, 3] },
];

const TR: Partial<Record<Lang, Record<string, string>>> = {
  en: {
  "Identidade": "Identity",
  "ATIVA": "ACTIVE",
  "Objetivos e KPIs": "Objectives and KPIs",
  "METAS DO TRIMESTRE": "QUARTERLY TARGETS",
  "Acompanhamento": "Monitoring",
  "AO VIVO": "LIVE",
  "Decisão": "Decision",
  "AGUARDA MARINA": "AWAITING MARINA",
  "OBJETIVO": "OBJECTIVE",
  "Resolver 90% dos chamados de 1º nível sem escalar": "Resolve 90% of tier 1 tickets without escalation",
  "LIMITE": "LIMIT",
  "Reembolsa até R$ 500 sozinha": "Refunds up to R$ 500 on her own",
  "RESPONSÁVEL": "ACCOUNTABLE",
  "Qualidade": "Quality",
  "Resultado real": "Actual result",
  "Prova": "Evidence",
  "Nome, função e onde roda.": "Name, role and where it runs.",
  "Objetivo e limite": "Objective and limit",
  "O que deve entregar e até onde vai sozinho.": "What it must deliver and how far it goes on its own.",
  "Responsável": "Accountable person",
  "Uma pessoa com nome responde por ele.": "A named person is accountable for it.",
  "Indicadores e prova": "Indicators and evidence",
  "Como está indo, com a origem de cada número.": "How it is performing, with the source of every number."
},
  es: {
  "Identidade": "Identidad",
  "ATIVA": "ACTIVA",
  "Objetivos e KPIs": "Objetivos y KPIs",
  "METAS DO TRIMESTRE": "METAS DEL TRIMESTRE",
  "Acompanhamento": "Seguimiento",
  "AO VIVO": "EN VIVO",
  "Decisão": "Decisión",
  "AGUARDA MARINA": "ESPERA A MARINA",
  "OBJETIVO": "OBJETIVO",
  "Resolver 90% dos chamados de 1º nível sem escalar": "Resolver el 90% de los tickets de 1.er nivel sin escalar",
  "LIMITE": "LÍMITE",
  "Reembolsa até R$ 500 sozinha": "Reembolsa hasta R$ 500 por sí sola",
  "RESPONSÁVEL": "RESPONSABLE",
  "Qualidade": "Calidad",
  "Resultado real": "Resultado real",
  "Prova": "Prueba",
  "Nome, função e onde roda.": "Nombre, función y dónde opera.",
  "Objetivo e limite": "Objetivo y límite",
  "O que deve entregar e até onde vai sozinho.": "Qué debe entregar y hasta dónde actúa solo.",
  "Responsável": "Responsable",
  "Uma pessoa com nome responde por ele.": "Una persona con nombre responde por él.",
  "Indicadores e prova": "Indicadores y prueba",
  "Como está indo, com a origem de cada número.": "Cómo va, con el origen de cada número."
},
};

const pt = {
  eyebrow: "Objetivos e KPIs por agente",
  h2: "Cada agente tem uma ficha, como um funcionário.",
  ficha: "FICHA DO AGENTE",
  agentName: "Sofia",
  agentRole: "Atendimento N1 · Zendesk",
  captions: [
    "Nome, função e onde roda. Você sabe quantos existem e o que cada um faz.",
    "O que ele deve entregar, até onde vai sozinho e quem responde por ele, por escrito.",
    "KPIs, custo e resultado medidos o tempo todo, com a origem de cada número.",
    "Quando um KPI sai da meta, uma pessoa recebe a recomendação e decide.",
  ],
  illustrative: "Dados ilustrativos",
};

const en: typeof pt = {
  eyebrow: "Objectives and KPIs per agent",
  h2: "Every agent has a file, like an employee.",
  ficha: "AGENT FILE",
  agentName: "Sofia",
  agentRole: "Tier 1 support · Zendesk",
  captions: [
    "Name, role and where it runs. You know how many exist and what each one does.",
    "What it must deliver, how far it can go on its own and who is accountable for it, in writing.",
    "KPIs, cost and results measured continuously, with the source of every number.",
    "When a KPI drifts off target, a person receives the recommendation and decides.",
  ],
  illustrative: "Illustrative data",
};
const es: typeof pt = {
  eyebrow: "Objetivos y KPIs por agente",
  h2: "Cada agente tiene una ficha, como un empleado.",
  ficha: "FICHA DEL AGENTE",
  agentName: "Sofia",
  agentRole: "Atención N1 · Zendesk",
  captions: [
    "Nombre, función y dónde opera. Usted sabe cuántos existen y qué hace cada uno.",
    "Qué debe entregar, hasta dónde actúa solo y quién responde por él, por escrito.",
    "KPIs, costo y resultado medidos en todo momento, con el origen de cada número.",
    "Cuando un KPI se aleja de la meta, una persona recibe la recomendación y decide.",
  ],
  illustrative: "Datos ilustrativos",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

// Como no protótipo: OBJETIVO acende em Identidade e Objetivos; LIMITE e
// RESPONSÁVEL só em Objetivos e KPIs; os KPIs em Acompanhamento e Decisão.
function fieldOpacity(tab: number, index: number): number {
  if (index === 0) return tab === 0 || tab === 1 ? 1 : 0.45;
  return tab === 1 ? 1 : 0.45;
}

function calloutOpacity(tab: number, abas: readonly number[]): number {
  return abas.includes(tab) ? 1 : 0.35;
}

export function HomeFicha() {
  const { lang } = useLang();
  const TABS = localize(TABS_PT, TR[lang]);
  const FIELDS = localize(FIELDS_PT, TR[lang]);
  const METRICS = localize(METRICS_PT, TR[lang]);
  const CALLOUTS_LEFT = localize(CALLOUTS_LEFT_PT, TR[lang]);
  const CALLOUTS_RIGHT = localize(CALLOUTS_RIGHT_PT, TR[lang]);
  const t = copy[lang] ?? copy.pt;
  const [tab, setTab] = useState(0);
  const [touched, setTouched] = useState(false);

  const reduzirMovimento = useReducedMotion();

  useEffect(() => {
    if (touched || reduzirMovimento) return;
    const id = window.setInterval(() => setTab((current) => (current + 1) % TABS.length), 3600);
    return () => window.clearInterval(id);
  }, [touched, reduzirMovimento]);

  const badgeColor =
    TABS[tab].badgeColor === "chart-1"
      ? "hsl(var(--chart-1))"
      : TABS[tab].badgeColor === "chart-2"
        ? "hsl(var(--chart-2))"
        : "#f5f5f7";

  return (
    <section id="ficha" className="mx-auto flex max-w-[1280px] scroll-mt-20 flex-col items-center gap-4 px-5 pt-[clamp(64px,8vw,96px)] text-center lg:px-12">
      <span className="text-[13px] font-medium text-muted-foreground">{t.eyebrow}</span>
      <h2 className="max-w-[900px] text-[clamp(24px,4.7vw,60px)] font-semibold leading-[1.05] tracking-[-0.04em] text-balance">
        {t.h2}
      </h2>

      <div className="mt-8 flex w-full flex-col items-center gap-8 rounded-t-[40px] bg-gradient-to-b from-background from-30% to-secondary pb-16">
        <div className="mt-10 flex flex-wrap justify-center gap-1 rounded-[24px] bg-black/[.06] p-1">
          {TABS.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setTab(index);
                setTouched(true);
              }}
              aria-pressed={index === tab}
              className={`rounded-full px-5 py-2 text-[14px] font-medium transition-all ${
                index === tab
                  ? "bg-white text-foreground shadow-[0_1px_4px_rgba(0,0,0,.12)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex w-full max-w-[1152px] flex-col items-center gap-8 px-5 text-left">
          <div className="relative flex w-full max-w-[620px] flex-col justify-between gap-7 overflow-hidden rounded-[28px] p-9 text-[#f5f5f7] shadow-[0_50px_100px_-30px_rgba(0,0,0,.5)] lg:p-10"
            style={{ background: "linear-gradient(135deg,#2a2a2e 0%,#141416 55%,#1f1f23 100%)" }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 80% 0%,rgba(255,255,255,.08),transparent 60%)",
              }}
            />
            <div className="relative flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[11px] font-medium tracking-[0.18em] text-[#f5f5f7]/55">
                  {t.ficha}
                </span>
                <span className="font-mono text-[11px] text-[#f5f5f7]/40">Nº 0417 · v3</span>
              </div>
              <span
                className="block"
                style={{ "--primary": "0 0% 100%" } as CSSProperties}
                aria-hidden="true"
              >
                <MusterMark className="h-[26px] w-[26px]" />
              </span>
            </div>

            <div className="relative flex flex-col gap-[18px]">
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f7] text-[20px] font-semibold text-[#1d1d1f]">
                  S
                </span>
                <div className="flex flex-col">
                  <span className="text-[30px] font-semibold leading-none tracking-[-0.02em]">
                    {t.agentName}
                  </span>
                  <span className="text-[14px] text-[#f5f5f7]/60">{t.agentRole}</span>
                </div>
                <span
                  className="ml-auto rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.1em] transition-all duration-300"
                  style={{ color: badgeColor, borderColor: badgeColor }}
                >
                  {TABS[tab].badge}
                </span>
              </div>

              <div className="grid gap-[18px] border-t border-white/12 pt-[18px] sm:grid-cols-3">
                {FIELDS.map((field, index) => (
                  <div
                    key={field.label}
                    className="flex flex-col gap-1 transition-opacity duration-[400ms]"
                    style={{ opacity: fieldOpacity(tab, index) }}
                  >
                    <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-[#f5f5f7]/50">
                      {field.label}
                    </span>
                    <span className="text-[14px] leading-[1.35]">{field.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4 border-t border-white/12 pt-[18px] transition-opacity duration-[400ms]"
                style={{ opacity: tab >= 2 ? 1 : 0.45 }}
              >
                <Badge variant="illustrative" className="self-start">
                  {t.illustrative}
                </Badge>
                <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
                  {METRICS.map((metric) => (
                    <div key={metric.label} className="flex flex-col gap-1.5">
                      <span className="text-[12px] text-[#f5f5f7]/55">{metric.label}</span>
                      <span className="text-[26px] font-medium leading-none tracking-[-0.02em]">
                        {metric.value}
                      </span>
                      <div className="h-0.5 rounded-sm bg-white/14">
                        <div
                          className="h-0.5 rounded-sm transition-all duration-500"
                          style={{ width: metric.width, background: "hsl(var(--chart-1))" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CALLOUTS_LEFT.map((item) => (
              <div
                key={item.title}
                className="flex max-w-[230px] flex-col gap-1 transition-opacity duration-300"
                style={{ opacity: calloutOpacity(tab, item.abas) }}
              >
                <span className="text-[15px] font-semibold text-foreground">{item.title}</span>
                <span className="text-[14px] leading-[1.45] text-muted-foreground">{item.desc}</span>
                <span className="mt-1.5 h-px w-10 bg-foreground" />
              </div>
            ))}
            {CALLOUTS_RIGHT.map((item) => (
              <div
                key={item.title}
                className="flex max-w-[230px] flex-col gap-1 transition-opacity duration-300"
                style={{ opacity: calloutOpacity(tab, item.abas) }}
              >
                <span className="mb-1.5 h-px w-10 bg-foreground" />
                <span className="text-[15px] font-semibold text-foreground">{item.title}</span>
                <span className="text-[14px] leading-[1.45] text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="min-h-[56px] max-w-[640px] px-5 text-center text-[19px] leading-[1.45] text-foreground">
          {t.captions[tab]}
        </p>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {t.illustrative}
        </span>
      </div>
    </section>
  );
}
