import { Link } from "wouter";
import { useLang, type Lang } from "@/lib/i18n";

const pt = {
  h1a: "Seus agentes de IA já decidem.",
  h1b: "Quem responde por eles?",
  product: "Muster: todos os seus agentes de IA, com objetivos, KPIs e um responsável.",
  sub: "Onde quer que eles rodem, o Muster mostra em um só lugar o que cada agente deve entregar, quanto custa, se está entregando e quem responde por ele.",
  logosLabel: "Compatível com",
  homeMade: "+ agentes feitos em casa",
  cta: "Iniciar avaliação",
  secondary: "Ver como funciona ›",
};

const en: typeof pt = {
  h1a: "Your AI agents already make decisions.",
  h1b: "Who is accountable for them?",
  product: "Muster: all your AI agents, with objectives, KPIs and an accountable person.",
  sub: "Wherever they run, Muster shows in one place what each agent should deliver, what it costs, whether it is delivering and who is accountable for it.",
  logosLabel: "Works with",
  homeMade: "+ in-house agents",
  cta: "Start evaluation",
  secondary: "See how it works ›",
};
const es: typeof pt = {
  h1a: "Sus agentes de IA ya toman decisiones.",
  h1b: "¿Quién responde por ellos?",
  product: "Muster: todos sus agentes de IA, con objetivos, KPIs y un responsable.",
  sub: "Dondequiera que operen, Muster muestra en un solo lugar qué debe entregar cada agente, cuánto cuesta, si está entregando y quién responde por él.",
  logosLabel: "Compatible con",
  homeMade: "+ agentes desarrollados internamente",
  cta: "Iniciar evaluación",
  secondary: "Ver cómo funciona ›",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

const LOGOS: Array<{ alt: string; file: string; height: number }> = [
  { alt: "AWS", file: "Amazon_Web_Services_Logo.svg", height: 24 },
  { alt: "Microsoft Azure", file: "Microsoft_Azure_Logo.svg", height: 22 },
  { alt: "Google Cloud", file: "Google_Cloud_logo.svg", height: 20 },
  { alt: "Salesforce", file: "Salesforce.com_logo.svg", height: 26 },
  { alt: "OpenAI", file: "OpenAI_Logo.svg", height: 18 },
  { alt: "Anthropic", file: "Anthropic_logo.svg", height: 16 },
  { alt: "ServiceNow", file: "ServiceNow_logo.svg", height: 18 },
];

export function HomeHero() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;

  return (
    <section
      id="top"
      className="mx-auto flex max-w-[1280px] scroll-mt-20 flex-col items-center gap-5 px-5 pt-24 text-center lg:px-12"
    >
      <h1 className="max-w-[1040px] text-[clamp(37px,7.2vw,92px)] font-semibold leading-[0.98] tracking-[-0.05em] text-balance">
        {t.h1a} <span className="text-muted-foreground">{t.h1b}</span>
      </h1>

      <h2 className="mt-2 max-w-[900px] text-[clamp(22px,3vw,30px)] font-medium leading-[1.25] tracking-[-0.025em] text-balance">
        {t.product}
      </h2>

      <p className="max-w-[680px] text-[clamp(17px,1.6vw,21px)] leading-[1.45] text-muted-foreground text-pretty">
        {t.sub}
      </p>

      <div className="mt-2 flex flex-col items-center gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {t.logosLabel}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-[26px] gap-y-4">
          {LOGOS.map((logo) => (
            <img
              key={logo.alt}
              src={`https://commons.wikimedia.org/wiki/Special:FilePath/${logo.file}?width=240`}
              alt={logo.alt}
              title={logo.alt}
              loading="lazy"
              style={{ height: logo.height }}
              className="w-auto opacity-70 grayscale"
            />
          ))}
          <span className="text-[13px] font-medium text-muted-foreground">{t.homeMade}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-[18px]">
        <Link
          href="/calculadora"
          className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
        >
          {t.cta}
        </Link>
        <a href="#ficha" className="text-foreground transition-colors hover:text-muted-foreground">
          {t.secondary}
        </a>
      </div>
    </section>
  );
}
