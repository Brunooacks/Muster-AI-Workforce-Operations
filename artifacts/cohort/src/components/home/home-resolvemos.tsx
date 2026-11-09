import { Badge } from "@/components/ui/badge";
import { useLang, type Lang } from "@/lib/i18n";

const pt = {
  eyebrow: "O que resolvemos",
  h2: "Quatro perguntas que hoje ficam sem resposta.",
  items: [
    {
      n: "01",
      q: "Quantos agentes estão rodando e o que cada um pode fazer?",
      why: "Times diferentes ligaram agentes em sistemas diferentes. Não existe uma lista.",
      fix: "uma ficha por agente, com objetivo e limite.",
    },
    {
      n: "02",
      q: "Eles estão entregando resultado ou só concluindo tarefas?",
      why: "O painel do agente diz 98%. O resultado para o negócio, ninguém mede.",
      fix: "mede tarefa e resultado, e avisa quando divergem.",
    },
    {
      n: "03",
      q: "Quem responde quando um agente erra?",
      why: "Hoje a resposta é “o fornecedor”, “a TI” ou silêncio.",
      fix: "cada agente tem um responsável humano por escrito.",
    },
    {
      n: "04",
      q: "O que você diz ao board?",
      why: "Não há relatório, só prints de painéis que ninguém sabe ler.",
      fix: "um relatório mensal de uma página, com origem dos números.",
    },
  ],
};

const en: typeof pt = {
  eyebrow: "What we solve",
  h2: "Four questions that go unanswered today.",
  items: [
    { n: "01", q: "How many agents are running, and what is each one allowed to do?", why: "Different teams switched on agents in different systems. There is no list.", fix: "one file per agent, with objective and limits." },
    { n: "02", q: "Are they delivering results or just completing tasks?", why: "The agent dashboard says 98%. Nobody measures the business result.", fix: "measures task and result, and flags when they diverge." },
    { n: "03", q: "Who is accountable when an agent gets it wrong?", why: "Today the answer is “the vendor”, “IT” or silence.", fix: "every agent has a named person accountable for it, in writing." },
    { n: "04", q: "What do you tell the board?", why: "There is no report, only dashboard screenshots nobody can read.", fix: "a one-page monthly report, with the source of every number." },
  ],
};
const es: typeof pt = {
  eyebrow: "Lo que resolvemos",
  h2: "Cuatro preguntas que hoy quedan sin respuesta.",
  items: [
    { n: "01", q: "¿Cuántos agentes están en operación y qué puede hacer cada uno?", why: "Distintos equipos activaron agentes en distintos sistemas. No existe una lista.", fix: "una ficha por agente, con objetivo y límites." },
    { n: "02", q: "¿Están entregando resultados o solo completando tareas?", why: "El panel del agente dice 98%. Nadie mide el resultado para el negocio.", fix: "mide tarea y resultado, y avisa cuando divergen." },
    { n: "03", q: "¿Quién responde cuando un agente se equivoca?", why: "Hoy la respuesta es “el proveedor”, “TI” o silencio.", fix: "cada agente tiene un responsable humano por escrito." },
    { n: "04", q: "¿Qué le dice usted al directorio?", why: "No hay informe, solo capturas de paneles que nadie sabe interpretar.", fix: "un informe mensual de una página, con el origen de cada número." },
  ],
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

export function HomeResolvemos() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;

  return (
    <section id="resolvemos" className="mt-[clamp(64px,10vw,120px)] scroll-mt-20 bg-black px-5 py-[clamp(64px,10vw,120px)] text-[#f5f5f7] lg:px-12">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-16">
        <div className="flex max-w-[820px] flex-col gap-4">
          <span className="text-[13px] font-medium text-[#a1a1a6]">{t.eyebrow}</span>
          <h2 className="text-[clamp(24px,4.7vw,60px)] font-semibold leading-[1.05] tracking-[-0.04em] text-balance">
            {t.h2}
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          <Badge variant="illustrative" className="self-start bg-chart-2/15">
            {{ pt: "Dados ilustrativos", en: "Illustrative data", es: "Datos ilustrativos" }[lang]}
          </Badge>
          <div className="grid gap-px overflow-hidden rounded-[20px] border border-[#2a2a2e] bg-[#2a2a2e] sm:grid-cols-2">
            {t.items.map((item) => (
            <div key={item.n} className="flex flex-col gap-3.5 bg-black p-9 lg:p-10">
              <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-[#6e6e73]">
                {item.n}
              </span>
              <span className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
                {item.q}
              </span>
              <span className="text-[16px] leading-[1.5] text-[#a1a1a6]">{item.why}</span>
              <span
                className="mt-auto pt-2.5 text-[15px] font-medium"
                style={{ color: "hsl(var(--chart-1))" }}
              >
                Muster: {item.fix}
              </span>
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
