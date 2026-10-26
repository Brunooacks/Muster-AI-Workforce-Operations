import { Badge } from "@/components/ui/badge";
import { useLang, localize, type Lang } from "@/lib/i18n";

const COVERAGE_PT = [
  {
    title: "Aberto",
    color: "hsl(var(--chart-1))",
    desc: "O agente conversa com o sistema por conta própria e resolve a tarefa inteira dentro do limite.",
    example: "ex.: 14 de 47 agentes",
  },
  {
    title: "Parcial",
    color: "hsl(var(--chart-2-text))",
    desc: "Ele avança até uma etapa e passa o bastão para uma pessoa — o resto do caminho é humano.",
    example: "ex.: 21 de 47 agentes",
  },
  {
    title: "Fechado",
    color: "hsl(var(--chart-3-text))",
    desc: "Ele só executa o que uma pessoa inicia e aprova. Nada corre sem um responsável acionado.",
    example: "ex.: 12 de 47 agentes",
  },
];

const EDGES_PT = [
  { title: "Gateway e proxy", desc: "A conversa passa por um caminho que você controla — sem depender do fornecedor." },
  { title: "Logs e tickets", desc: "O que o agente fez fica registrado nas ferramentas que o time já usa." },
  { title: "Sem depender do fornecedor", desc: "Se o fornecedor não expõe nada, a coleta continua pelas bordas." },
];

const TR: Partial<Record<Lang, Record<string, string>>> = {
  en: {
  "Aberto": "Open",
  "Parcial": "Partial",
  "Fechado": "Closed",
  "O agente conversa com o sistema por conta própria e resolve a tarefa inteira dentro do limite.": "The agent works with the system on its own and completes the entire task within its limit.",
  "Ele avança até uma etapa e passa o bastão para uma pessoa — o resto do caminho é humano.": "It advances up to a given step and hands over to a person; the rest of the work is done by the team.",
  "Ele só executa o que uma pessoa inicia e aprova. Nada corre sem um responsável acionado.": "It only executes what a person starts and approves. Nothing runs without an accountable person involved.",
  "ex.: 14 de 47 agentes": "e.g. 14 of 47 agents",
  "ex.: 21 de 47 agentes": "e.g. 21 of 47 agents",
  "ex.: 12 de 47 agentes": "e.g. 12 of 47 agents",
  "Gateway e proxy": "Gateway and proxy",
  "A conversa passa por um caminho que você controla — sem depender do fornecedor.": "Traffic flows through a path you control, without relying on the vendor.",
  "Logs e tickets": "Logs and tickets",
  "O que o agente fez fica registrado nas ferramentas que o time já usa.": "What the agent did is recorded in the tools your team already uses.",
  "Sem depender do fornecedor": "Vendor-independent",
  "Se o fornecedor não expõe nada, a coleta continua pelas bordas.": "If the vendor exposes nothing, collection continues at the edges.",
  "login": "login",
  "aprovação": "approval",
  "dado faltante": "missing data"
},
  es: {
  "Aberto": "Abierto",
  "Parcial": "Parcial",
  "Fechado": "Cerrado",
  "O agente conversa com o sistema por conta própria e resolve a tarefa inteira dentro do limite.": "El agente interactúa con el sistema por cuenta propia y resuelve toda la tarea dentro de su límite.",
  "Ele avança até uma etapa e passa o bastão para uma pessoa — o resto do caminho é humano.": "Avanza hasta una etapa y entrega el trabajo a una persona; el resto del camino lo hace el equipo.",
  "Ele só executa o que uma pessoa inicia e aprova. Nada corre sem um responsável acionado.": "Solo ejecuta lo que una persona inicia y aprueba. Nada se ejecuta sin un responsable involucrado.",
  "ex.: 14 de 47 agentes": "ej.: 14 de 47 agentes",
  "ex.: 21 de 47 agentes": "ej.: 21 de 47 agentes",
  "ex.: 12 de 47 agentes": "ej.: 12 de 47 agentes",
  "Gateway e proxy": "Gateway y proxy",
  "A conversa passa por um caminho que você controla — sem depender do fornecedor.": "La conversación pasa por un camino que usted controla, sin depender del proveedor.",
  "Logs e tickets": "Logs y tickets",
  "O que o agente fez fica registrado nas ferramentas que o time já usa.": "Lo que hizo el agente queda registrado en las herramientas que el equipo ya usa.",
  "Sem depender do fornecedor": "Sin depender del proveedor",
  "Se o fornecedor não expõe nada, a coleta continua pelas bordas.": "Si el proveedor no expone nada, la recolección continúa en los bordes.",
  "login": "inicio de sesión",
  "aprovação": "aprobación",
  "dado faltante": "dato faltante"
},
};

const pt = {
  eyebrow: "Agent Ready",
  h2: "Cada agente tem um nível de cobertura: aberto, parcial ou fechado.",
  sub: "Você sabe o que o agente resolve sozinho, onde ele para e quem continua o trabalho.",
  edgesTitle: "Coleta pelas bordas",
  edgesSub: "A cobertura não depende de o fornecedor abrir a caixa preta.",
  frictionTitle: "Fricção da operação",
  frictionDesc:
    "Interrupções humanas a cada passo — login, aprovação, dado faltante — que derrubam a autonomia efetiva do agente.",
  soon: "Em breve",
  illustrative: "Dados ilustrativos",
};

const en: typeof pt = {
  eyebrow: "Agent Ready",
  h2: "Every agent has a coverage level: open, partial or closed.",
  sub: "You know what the agent resolves on its own, where it stops and who continues the work.",
  edgesTitle: "Collection at the edges",
  edgesSub: "Coverage does not depend on the vendor opening the black box.",
  frictionTitle: "Operational friction",
  frictionDesc:
    "Human interruptions at each step (login, approval, missing data) that reduce the agent's effective autonomy.",
  soon: "Coming soon",
  illustrative: "Illustrative data",
};
const es: typeof pt = {
  eyebrow: "Agent Ready",
  h2: "Cada agente tiene un nivel de cobertura: abierto, parcial o cerrado.",
  sub: "Usted sabe qué resuelve el agente por sí solo, dónde se detiene y quién continúa el trabajo.",
  edgesTitle: "Recolección en los bordes",
  edgesSub: "La cobertura no depende de que el proveedor abra la caja negra.",
  frictionTitle: "Fricción de la operación",
  frictionDesc:
    "Interrupciones humanas en cada paso (inicio de sesión, aprobación, dato faltante) que reducen la autonomía efectiva del agente.",
  soon: "Próximamente",
  illustrative: "Datos ilustrativos",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

export function HomeCobertura() {
  const { lang } = useLang();
  const COVERAGE = localize(COVERAGE_PT, TR[lang]);
  const EDGES = localize(EDGES_PT, TR[lang]);
  const t = copy[lang] ?? copy.pt;

  return (
    <section
      id="cobertura"
      className="mx-auto flex max-w-[1152px] scroll-mt-20 flex-col gap-10 px-5 py-[clamp(64px,8vw,96px)]"
    >
      <div className="flex max-w-[860px] flex-col gap-3.5">
        <span className="font-mono text-[13px] font-medium tracking-[0.06em] text-muted-foreground">
          {t.eyebrow}
        </span>
        <h2 className="text-[clamp(24px,3.6vw,44px)] font-semibold leading-[1.08] tracking-[-0.035em] text-balance">
          {t.h2}
        </h2>
        <p className="text-[clamp(17px,1.8vw,20px)] leading-[1.5] text-muted-foreground">
          {t.sub}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {COVERAGE.map((item) => (
          <div key={item.title} className="flex flex-col gap-3 rounded-[24px] bg-secondary p-7 lg:p-8">
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
              style={{ color: item.color, borderColor: item.color }}
            >
              {item.title}
            </span>
            <span className="text-[16px] leading-[1.5] text-foreground">{item.desc}</span>
            <span className="mt-auto pt-2 font-mono text-[12px] text-muted-foreground">
              {item.example}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="illustrative">{t.illustrative}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5 rounded-[24px] border border-black/[.08] bg-background p-7 lg:p-8">
          <div className="flex flex-col gap-1.5">
            <span className="text-[20px] font-semibold tracking-[-0.02em]">{t.edgesTitle}</span>
            <span className="text-[15px] leading-[1.5] text-muted-foreground">{t.edgesSub}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {EDGES.map((edge) => (
              <div key={edge.title} className="flex flex-col gap-1.5 rounded-[16px] bg-secondary p-4">
                <span className="text-[14px] font-semibold text-foreground">{edge.title}</span>
                <span className="text-[13px] leading-[1.45] text-muted-foreground">{edge.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[24px] border border-black/[.08] bg-background p-7 lg:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[20px] font-semibold tracking-[-0.02em]">{t.frictionTitle}</span>
            <Badge variant="soon">{t.soon}</Badge>
          </div>
          <span className="text-[15px] leading-[1.5] text-muted-foreground">{t.frictionDesc}</span>
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {localize(["login", "aprovação", "dado faltante"], TR[lang]).map((item) => (
              <span
                key={item}
                className="rounded-full border border-black/[.1] px-3 py-1 text-[13px] text-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
