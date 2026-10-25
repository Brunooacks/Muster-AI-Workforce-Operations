import { useLang, type Lang } from "@/lib/i18n";

const GARTNER_URL =
  "https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027";

const pt = {
  eyebrow: "O que o mercado já sabe",
  h2: "Os agentes vão decidir mais. Quatro em cada dez projetos vão ser cancelados.",
  cards: [
    {
      lead: "ao menos",
      number: "15%",
      negative: false,
      title: "das decisões do dia a dia serão de agentes de IA até 2028.",
      detail: "Em 2024, zero.",
      source: "Gartner, jun/2025",
    },
    {
      lead: "",
      number: "33%",
      negative: false,
      title: "dos softwares corporativos terão agentes embutidos até 2028.",
      detail: "Em 2024, menos de 1%.",
      source: "Gartner, jun/2025",
    },
    {
      lead: "",
      number: "40%+",
      negative: true,
      title: "dos projetos com agentes serão cancelados até 2027.",
      detail: "Custo alto, valor pouco claro, controle fraco.",
      source: "Gartner, jun/2025",
    },
  ],
  disclaimer:
    "Gartner é marca registrada da Gartner, Inc. Previsões de comunicados públicos (jun/2025). Não há endosso do Muster.",
};

const copy: Record<Lang, typeof pt> = { pt, en: pt, es: pt };

export function HomeMercado() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;

  return (
    <section className="mx-auto flex max-w-[1280px] scroll-mt-20 flex-col items-center gap-10 px-5 pt-[clamp(64px,10vw,120px)] text-center lg:px-12">
      <div className="flex max-w-[860px] flex-col gap-3.5">
        <span className="text-[13px] font-medium text-muted-foreground">{t.eyebrow}</span>
        <h2 className="text-[clamp(24px,4.4vw,56px)] font-semibold leading-[1.05] tracking-[-0.04em] text-balance">
          {t.h2}
        </h2>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.cards.map((card) => (
          <div
            key={card.number}
            className="flex flex-col gap-3 rounded-[24px] bg-secondary p-9 text-left lg:p-10"
          >
            <a
              href={GARTNER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit flex-col items-start transition-opacity hover:opacity-75"
              aria-label={`${card.number} — fonte: Gartner (abre em nova aba)`}
            >
              {card.lead && (
                <span className="mb-1 font-mono text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                  {card.lead}
                </span>
              )}
              <span
                className={`text-[clamp(36px,6.3vw,80px)] font-semibold leading-[0.9] tracking-[-0.06em] ${
                  card.negative ? "text-destructive-text" : "text-foreground"
                }`}
              >
                {card.number}
              </span>
            </a>
            <span className="text-[20px] font-medium leading-[1.3] tracking-[-0.015em] text-foreground">
              {card.title}
            </span>
            <span className="text-[15px] leading-[1.5] text-muted-foreground">{card.detail}</span>
            <span className="mt-auto pt-3 font-mono text-[12px] text-muted-foreground">
              {card.source}
            </span>
          </div>
        ))}
      </div>

      <p className="max-w-[760px] text-[13px] leading-[1.5] text-muted-foreground">
        {t.disclaimer}
      </p>
    </section>
  );
}
