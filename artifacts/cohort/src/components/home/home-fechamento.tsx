import { Link } from "wouter";
import { MusterMark } from "@/components/logo";
import { LangSwitcher } from "@/components/lang-switcher";
import { useLang, type Lang } from "@/lib/i18n";

const pt = {
  h2: "Comece pelo agente que mais preocupa você.",
  sub: "Em 30 dias: objetivos, KPIs, acompanhamento e o primeiro relatório para o board.",
  cta: "Iniciar avaliação",
  secondary: "Falar com a equipe ›",
  brand: "Muster Workforce Operations",
  tagline: "Identidade · Prova · Decisão · Responsabilidade",
  veltrix: "Gateway de IA: quanto cada chamada custa, com limite de gasto em todos os modelos.",
  tupiniquim: "As taxas do dia a dia, sem letra miúda — dá para comparar antes de assinar.",
};

const en: typeof pt = {
  h2: "Start with the agent that concerns you most.",
  sub: "In 30 days: objectives, KPIs, monitoring and the first board report.",
  cta: "Start evaluation",
  secondary: "Talk to our team ›",
  brand: "Muster Workforce Operations",
  tagline: "Identity · Evidence · Decision · Accountability",
  veltrix: "AI gateway: what each call costs, with spending limits across all models.",
  tupiniquim: "Everyday fees with no fine print, so you can compare before you sign.",
};
const es: typeof pt = {
  h2: "Comience por el agente que más le preocupa.",
  sub: "En 30 días: objetivos, KPIs, seguimiento y el primer informe para el directorio.",
  cta: "Iniciar evaluación",
  secondary: "Hablar con el equipo ›",
  brand: "Muster Workforce Operations",
  tagline: "Identidad · Prueba · Decisión · Responsabilidad",
  veltrix: "Gateway de IA: cuánto cuesta cada llamada, con límite de gasto en todos los modelos.",
  tupiniquim: "Las tarifas del día a día, sin letra pequeña, para comparar antes de contratar.",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

export function HomeFechamento() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;

  return (
    <>
      <section className="flex flex-col items-center gap-6 bg-secondary px-5 py-[clamp(64px,10vw,120px)] text-center">
        <h2 className="max-w-[900px] text-[clamp(29px,5.6vw,72px)] font-semibold leading-none tracking-[-0.045em] text-balance">
          {t.h2}
        </h2>
        <p className="max-w-[560px] text-[20px] leading-[1.5] text-muted-foreground">{t.sub}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-[18px]">
          <Link
            href="/calculadora"
            className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          >
            {t.cta}
          </Link>
          <Link href="/sign-up" className="text-foreground transition-colors hover:text-muted-foreground">
            {t.secondary}
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-6 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[.06] pt-6 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <MusterMark className="h-4 w-4" /> {t.brand}
          </span>
          <span className="flex items-center gap-3">
            <span>{t.tagline}</span>
            <LangSwitcher />
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="https://veltrixplatform.com"
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-1 rounded-[16px] border border-black/[.08] p-4 transition-colors hover:bg-secondary"
          >
            <span className="text-[13px] font-semibold text-foreground">Veltrix</span>
            <span className="text-[13px] leading-[1.45] text-muted-foreground">{t.veltrix}</span>
          </a>
          <a
            href="https://tupiniquim.veltrixplatform.com"
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-1 rounded-[16px] border border-black/[.08] p-4 transition-colors hover:bg-secondary"
          >
            <span className="text-[13px] font-semibold text-foreground">Taxa Tupiniquim</span>
            <span className="text-[13px] leading-[1.45] text-muted-foreground">{t.tupiniquim}</span>
          </a>
        </div>
      </footer>
    </>
  );
}
