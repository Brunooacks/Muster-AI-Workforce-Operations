import { Badge } from "@/components/ui/badge";
import { useLang, type Lang } from "@/lib/i18n";

const BOARD_STATS = [
  { value: "92%", label: "Propósito", delta: "+4", positive: true },
  { value: "86%", label: "Saúde", delta: "+2", positive: true },
  { value: "94%", label: "Prova", delta: "+7", positive: true },
  { value: "78%", label: "Governança", delta: "−3", positive: false },
];

const pt = {
  leftEyebrow: "Decisão com dono",
  leftTitle: "O Muster recomenda. Uma pessoa decide.",
  leftSub: "Cada recomendação chega com prova, prazo e um nome.",
  cardLabel: "PARA MARINA ALVES · ATÉ 30/08",
  cardTitle: "Ampliar o limite da Sofia para R$ 1.000 em reembolsos de baixo risco.",
  evidence: "Prova: 1.284 atendimentos · 0 fora da política · 96% de qualidade",
  approve: "Aprovar",
  adjust: "Ajustar",
  reject: "Rejeitar",
  boardEyebrow: "Para o board",
  boardTitle: "Um relatório por mês. Em uma página.",
  boardSub: "O que mudou, por quê, o que está em risco e quem cuida.",
  soon: "Em breve",
  illustrative: "Dados ilustrativos",
};

const en: typeof pt = {
  leftEyebrow: "Decisions with accountability",
  leftTitle: "Muster recommends. A person decides.",
  leftSub: "Every recommendation comes with evidence, a deadline and a name.",
  cardLabel: "FOR MARINA ALVES · BY 08/30",
  cardTitle: "Raise Sofia's limit to R$ 1,000 for low-risk refunds.",
  evidence: "Evidence: 1,284 cases · 0 outside policy · 96% quality",
  approve: "Approve",
  adjust: "Adjust",
  reject: "Reject",
  boardEyebrow: "For the board",
  boardTitle: "One report a month. On one page.",
  boardSub: "What changed, why, what is at risk and who owns it.",
  soon: "Coming soon",
  illustrative: "Illustrative data",
};
const es: typeof pt = {
  leftEyebrow: "Decisión con responsable",
  leftTitle: "Muster recomienda. Una persona decide.",
  leftSub: "Cada recomendación llega con prueba, plazo y un nombre.",
  cardLabel: "PARA MARINA ALVES · HASTA 30/08",
  cardTitle: "Ampliar el límite de Sofia a R$ 1.000 en reembolsos de bajo riesgo.",
  evidence: "Prueba: 1.284 atenciones · 0 fuera de política · 96% de calidad",
  approve: "Aprobar",
  adjust: "Ajustar",
  reject: "Rechazar",
  boardEyebrow: "Para el directorio",
  boardTitle: "Un informe al mes. En una página.",
  boardSub: "Qué cambió, por qué, qué está en riesgo y quién se encarga.",
  soon: "Próximamente",
  illustrative: "Datos ilustrativos",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

export function HomeDecisao() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;

  return (
    <section className="mx-auto grid max-w-[1280px] gap-5 px-5 pb-[clamp(64px,10vw,120px)] lg:grid-cols-2 lg:px-12">
      <div
        id="decisao"
        className="flex scroll-mt-20 flex-col gap-7 rounded-[32px] bg-secondary p-8 sm:p-12 lg:p-14"
      >
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-medium text-muted-foreground">{t.leftEyebrow}</span>
          <h3 className="text-[clamp(22px,3.1vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em]">
            {t.leftTitle}
          </h3>
          <p className="text-[17px] leading-[1.5] text-muted-foreground">{t.leftSub}</p>
        </div>

        <div className="mt-auto flex flex-col gap-3.5 rounded-[20px] bg-background p-6 shadow-[0_10px_40px_-20px_rgba(0,0,0,.2)]">
          <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground">
            {t.cardLabel}
          </span>
          <span className="text-[19px] font-medium leading-[1.35] text-foreground">
            {t.cardTitle}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            {t.evidence}
            <Badge variant="illustrative">{t.illustrative}</Badge>
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-foreground px-[18px] py-2.5 text-[14px] font-medium text-background">
              {t.approve}
            </span>
            <span className="rounded-full bg-secondary px-[18px] py-2.5 text-[14px] font-medium text-foreground">
              {t.adjust}
            </span>
            <span className="px-3 py-2.5 text-[14px] font-medium text-muted-foreground">
              {t.reject}
            </span>
          </div>
        </div>
      </div>

      <div
        id="board"
        className="flex scroll-mt-20 flex-col gap-7 rounded-[32px] bg-foreground p-8 text-[#f5f5f7] sm:p-12 lg:p-14"
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[#a1a1a6]">{t.boardEyebrow}</span>
            <Badge variant="soon" className="border-chart-2/60 text-chart-2">
              {t.soon}
            </Badge>
          </div>
          <h3 className="text-[clamp(22px,3.1vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em]">
            {t.boardTitle}
          </h3>
          <p className="text-[17px] leading-[1.5] text-[#a1a1a6]">{t.boardSub}</p>
        </div>

        <div className="mt-auto flex flex-col gap-5">
          <Badge variant="illustrative" className="self-start border-chart-2/60 bg-chart-2/15 text-chart-2">
            {t.illustrative}
          </Badge>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BOARD_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <span className="text-[clamp(24px,3.8vw,48px)] font-semibold leading-none tracking-[-0.04em]">
                  {stat.value}
                </span>
                <span className="text-[14px] text-[#a1a1a6]">
                  {stat.label}{" "}
                  <span
                    className="font-medium"
                    style={{
                      color: stat.positive ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))",
                    }}
                  >
                    {stat.delta}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
