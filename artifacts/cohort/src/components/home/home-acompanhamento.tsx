import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useLang, type Lang } from "@/lib/i18n";

const STATES = [
  {
    number: "98%",
    head: "Meta de reuniões batida.",
    sub: "das tarefas concluídas no prazo",
    label: "das reuniões agendadas no prazo",
    color: "text-foreground",
  },
  {
    number: "61%",
    head: "Mas o resultado não veio.",
    sub: "das reuniões viraram oportunidade real. Duas passagens de serviço quebradas com o time comercial.",
    label: "das reuniões viraram oportunidade",
    color: "text-destructive",
  },
];

const pt = {
  eyebrow: "Acompanhamento",
  h2: "Concluir a tarefa não é entregar o resultado.",
  sub: "O Muster mede os dois. E avisa quando um esconde o outro.",
  context: "Atlas · agente de prospecção · agosto",
  illustrative: "Dados ilustrativos",
  tabLabels: ["Tarefas concluídas", "Resultado real"],
};

const copy: Record<Lang, typeof pt> = { pt, en: pt, es: pt };

export function HomeAcompanhamento() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;
  const [state, setState] = useState(0);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched) return;
    const id = window.setInterval(() => setState((current) => 1 - current), 4200);
    return () => window.clearInterval(id);
  }, [touched]);

  const current = STATES[state];

  return (
    <section
      id="acompanhamento"
      className="mx-auto flex max-w-[1152px] scroll-mt-20 flex-col items-center gap-12 px-5 py-[clamp(64px,10vw,120px)] text-center"
    >
      <div className="flex max-w-[820px] flex-col gap-3.5">
        <span className="text-[13px] font-medium text-muted-foreground">{t.eyebrow}</span>
        <h2 className="text-[clamp(24px,4.7vw,60px)] font-semibold leading-[1.05] tracking-[-0.04em] text-balance">
          {t.h2}
        </h2>
        <p className="text-[clamp(17px,2vw,20px)] leading-[1.5] text-muted-foreground">{t.sub}</p>
      </div>

      <div className="grid w-full items-center gap-12 rounded-[32px] bg-secondary p-8 text-left sm:p-12 lg:grid-cols-2 lg:p-14">
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap self-start rounded-[24px] bg-black/[.06] p-1">
            {t.tabLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setState(index);
                  setTouched(true);
                }}
                aria-pressed={index === state}
                className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
                  index === state
                    ? "bg-white text-foreground shadow-[0_1px_4px_rgba(0,0,0,.12)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[14px] text-muted-foreground">{t.context}</span>
          <span className="text-[clamp(22px,2.8vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em]">
            {current.head}
          </span>
          <p className="text-[16px] leading-[1.5] text-muted-foreground">{current.sub}</p>
          <Badge variant="illustrative" className="self-start">
            {t.illustrative}
          </Badge>
        </div>

        <div className="flex flex-col items-end gap-2.5 text-right">
          <span
            className={`text-[clamp(72px,14.1vw,180px)] font-semibold leading-[0.85] tracking-[-0.07em] transition-colors duration-500 ${current.color}`}
          >
            {current.number}
          </span>
          <span className="text-[14px] font-medium text-muted-foreground">{current.label}</span>
        </div>
      </div>
    </section>
  );
}
