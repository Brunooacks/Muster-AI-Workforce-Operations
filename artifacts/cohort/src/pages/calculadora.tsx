import { useMemo, useState } from "react";
import { Link } from "wouter";
import { HomeNav } from "@/components/home/home-nav";
import { HomeFechamento } from "@/components/home/home-fechamento";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLang, type Lang } from "@/lib/i18n";
import {
  calcular,
  validar,
  formatBRL,
  formatNumero,
  parseEntrada,
  ENTRADAS_PADRAO,
  type CampoEntrada,
} from "@/lib/calculadora";

const pt = {
  eyebrow: "Grátis · sem login",
  h1a: "Calculadora de Custo",
  h1b: "por Resultado.",
  sub: "Ponha seus números e veja quanto custa cada resultado aceito — com agente e com time humano. O cálculo roda aqui no seu navegador; nada é enviado.",
  ilustrativo: "Dados ilustrativos",
  ilustrativoHint: "Os valores iniciais são exemplos. Troque pelos seus.",
  inputsTitle: "Seus números",
  campos: {
    agentes: "Agentes em produção",
    tarefas: "Tarefas por mês",
    aceitacao: "Tarefas aceitas",
    gastoMensal: "Gasto mensal com agentes",
    custoHora: "Custo-hora do time",
    minutosPorTarefa: "Tempo médio por tarefa",
    custoPorCaso: "Custo humano por caso",
  } as Record<CampoEntrada, string>,
  dicas: {
    agentes: "quantos estão rodando hoje",
    tarefas: "volume que os agentes processam",
    aceitacao: "o que virou resultado aceito",
    gastoMensal: "modelos, infra e licenças",
    custoHora: "salário + encargos ÷ horas",
    minutosPorTarefa: "tempo de um humano na mesma tarefa",
    custoPorCaso: "opcional: 0 = usar custo-hora × tempo",
  } as Record<CampoEntrada, string>,
  sufixos: { aceitacao: "%", minutosPorTarefa: "min" } as Partial<Record<CampoEntrada, string>>,
  prefixos: { gastoMensal: "R$", custoHora: "R$", custoPorCaso: "R$" } as Partial<Record<CampoEntrada, string>>,
  resultTitle: "Custo por resultado validado",
  resultAgente: "com agente no Muster",
  resultHumano: "no time humano",
  deltaBarato: (p: string) => `${p}% mais barato por resultado`,
  deltaCaro: (p: string) => `${p}% mais caro por resultado`,
  mediaAgente: (valor: string) => `Gasto médio por agente: ${valor} por mês`,
  stats: {
    resultados: "Resultados validados por mês",
    humanoMes: "Custo humano estimado por mês",
    economia: "Economia mensal com o agente",
    negativa: "acima do custo humano",
  },
  semDados: "Preencha os campos para calcular o custo por resultado.",
  formulaTitle: "Como calculamos",
  formula: [
    "resultados validados = tarefas × aceitação",
    "custo por resultado (agente) = gasto mensal ÷ resultados validados",
    "custo humano mensal = tarefas × minutos ÷ 60 × custo-hora",
    "custo humano mensal = tarefas × custo por caso (se informado)",
    "custo por resultado (humano) = custo humano mensal ÷ resultados validados",
  ],
  formulaNote:
    "Os dois lados gastam em todas as tarefas e só a aceitação conta como resultado: aceitação baixa pesa nos dois. O custo humano usa o tempo médio por tarefa que você informou.",
  cta: "Iniciar avaliação",
  semLogin: "Sem cartão. Sem instalação.",
};

const en: typeof pt = {
  eyebrow: "Free · no sign-in",
  h1a: "Cost per Result",
  h1b: "Calculator.",
  sub: "Enter your numbers and see what each accepted result costs, with an agent and with a human team. The calculation runs in your browser; nothing is sent.",
  ilustrativo: "Illustrative data",
  ilustrativoHint: "The initial values are examples. Replace them with your own.",
  inputsTitle: "Your numbers",
  campos: {
    agentes: "Agents in production",
    tarefas: "Tasks per month",
    aceitacao: "Accepted tasks",
    gastoMensal: "Monthly agent spend",
    custoHora: "Team hourly cost",
    minutosPorTarefa: "Average time per task",
    custoPorCaso: "Human cost per case",
  } as Record<CampoEntrada, string>,
  dicas: {
    agentes: "how many are running today",
    tarefas: "volume the agents process",
    aceitacao: "what became an accepted result",
    gastoMensal: "models, infrastructure and licenses",
    custoHora: "salary + charges ÷ hours",
    minutosPorTarefa: "time a person takes on the same task",
    custoPorCaso: "optional: 0 = use hourly cost × time",
  } as Record<CampoEntrada, string>,
  sufixos: { aceitacao: "%", minutosPorTarefa: "min" } as Partial<Record<CampoEntrada, string>>,
  prefixos: { gastoMensal: "R$", custoHora: "R$", custoPorCaso: "R$" } as Partial<Record<CampoEntrada, string>>,
  resultTitle: "Cost per validated result",
  resultAgente: "with an agent on Muster",
  resultHumano: "with the human team",
  deltaBarato: (p: string) => `${p}% lower cost per result`,
  deltaCaro: (p: string) => `${p}% higher cost per result`,
  mediaAgente: (valor: string) => `Average spend per agent: ${valor} per month`,
  stats: {
    resultados: "Validated results per month",
    humanoMes: "Estimated human cost per month",
    economia: "Monthly savings with the agent",
    negativa: "above the human cost",
  },
  semDados: "Fill in the fields to calculate the cost per result.",
  formulaTitle: "How we calculate",
  formula: [
    "validated results = tasks × acceptance",
    "cost per result (agent) = monthly spend ÷ validated results",
    "monthly human cost = tasks × minutes ÷ 60 × hourly cost",
    "monthly human cost = tasks × cost per case (if provided)",
    "cost per result (human) = monthly human cost ÷ validated results",
  ],
  formulaNote:
    "Both sides spend on every task and only accepted work counts as a result, so low acceptance weighs on both. The human cost uses the average time per task you entered.",
  cta: "Start evaluation",
  semLogin: "No card. No installation.",
};
const es: typeof pt = {
  eyebrow: "Gratis · sin inicio de sesión",
  h1a: "Calculadora de Costo",
  h1b: "por Resultado.",
  sub: "Ingrese sus números y vea cuánto cuesta cada resultado aceptado, con agente y con equipo humano. El cálculo se ejecuta en su navegador; no se envía nada.",
  ilustrativo: "Datos ilustrativos",
  ilustrativoHint: "Los valores iniciales son ejemplos. Reemplácelos por los suyos.",
  inputsTitle: "Sus números",
  campos: {
    agentes: "Agentes en producción",
    tarefas: "Tareas por mes",
    aceitacao: "Tareas aceptadas",
    gastoMensal: "Gasto mensual en agentes",
    custoHora: "Costo por hora del equipo",
    minutosPorTarefa: "Tiempo medio por tarea",
    custoPorCaso: "Costo humano por caso",
  } as Record<CampoEntrada, string>,
  dicas: {
    agentes: "cuántos están operando hoy",
    tarefas: "volumen que procesan los agentes",
    aceitacao: "lo que se convirtió en resultado aceptado",
    gastoMensal: "modelos, infraestructura y licencias",
    custoHora: "salario + cargas ÷ horas",
    minutosPorTarefa: "tiempo de una persona en la misma tarea",
    custoPorCaso: "opcional: 0 = usar costo por hora × tiempo",
  } as Record<CampoEntrada, string>,
  sufixos: { aceitacao: "%", minutosPorTarefa: "min" } as Partial<Record<CampoEntrada, string>>,
  prefixos: { gastoMensal: "R$", custoHora: "R$", custoPorCaso: "R$" } as Partial<Record<CampoEntrada, string>>,
  resultTitle: "Costo por resultado validado",
  resultAgente: "con agente en Muster",
  resultHumano: "en el equipo humano",
  deltaBarato: (p: string) => `${p}% menos costo por resultado`,
  deltaCaro: (p: string) => `${p}% más costo por resultado`,
  mediaAgente: (valor: string) => `Gasto medio por agente: ${valor} al mes`,
  stats: {
    resultados: "Resultados validados por mes",
    humanoMes: "Costo humano estimado por mes",
    economia: "Ahorro mensual con el agente",
    negativa: "por encima del costo humano",
  },
  semDados: "Complete los campos para calcular el costo por resultado.",
  formulaTitle: "Cómo calculamos",
  formula: [
    "resultados validados = tareas × aceptación",
    "costo por resultado (agente) = gasto mensual ÷ resultados validados",
    "costo humano mensual = tareas × minutos ÷ 60 × costo por hora",
    "costo humano mensual = tareas × costo por caso (si se informa)",
    "costo por resultado (humano) = costo humano mensual ÷ resultados validados",
  ],
  formulaNote:
    "Ambos lados gastan en todas las tareas y solo lo aceptado cuenta como resultado: una aceptación baja pesa en ambos. El costo humano usa el tiempo medio por tarea que usted informó.",
  cta: "Iniciar evaluación",
  semLogin: "Sin tarjeta. Sin instalación.",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

const CAMPOS: CampoEntrada[] = ["agentes", "tarefas", "aceitacao", "gastoMensal", "custoHora", "minutosPorTarefa", "custoPorCaso"];

function iniciais(): Record<CampoEntrada, string> {
  return Object.fromEntries(CAMPOS.map((campo) => [campo, String(ENTRADAS_PADRAO[campo])])) as Record<
    CampoEntrada,
    string
  >;
}

export default function CalculadoraPage() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;
  const [bruto, setBruto] = useState<Record<CampoEntrada, string>>(iniciais);

  const entradas = useMemo(
    () => Object.fromEntries(CAMPOS.map((c) => [c, parseEntrada(bruto[c])])) as Record<CampoEntrada, number>,
    [bruto],
  );
  const erros = validar(entradas);
  const r = calcular(entradas);
  const semResultado =
    Object.keys(erros).length > 0 ||
    r.custoPorResultadoAgente === null ||
    r.custoPorResultadoHumano === null;

  const humano = r.custoPorResultadoHumano ?? 0;
  const delta =
    semResultado || humano <= 0
      ? null
      : ((humano - (r.custoPorResultadoAgente ?? 0)) / humano) * 100;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <HomeNav />
      <main id="top" className="scroll-mt-20">
        <section className="mx-auto flex max-w-[1280px] scroll-mt-20 flex-col items-center gap-4 px-5 pt-20 text-center lg:px-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {t.eyebrow}
          </span>
          <h1 className="max-w-[900px] text-[clamp(36px,6.4vw,76px)] font-semibold leading-[0.98] tracking-[-0.05em] text-balance">
            {t.h1a} <span className="text-muted-foreground">{t.h1b}</span>
          </h1>
          <p className="max-w-[640px] text-[clamp(17px,1.6vw,21px)] leading-[1.45] text-muted-foreground text-pretty">
            {t.sub}
          </p>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-6 px-5 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
          <div className="flex flex-col gap-5 rounded-[24px] border border-black/[.08] bg-card p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{t.inputsTitle}</h2>
              <Badge variant="illustrative">{t.ilustrativo}</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CAMPOS.map((campo) => {
                const erro = erros[campo];
                return (
                  <label key={campo} className="flex flex-col gap-1.5" htmlFor={`calc-${campo}`}>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t.campos[campo]}
                    </span>
                    <span className="flex items-center gap-2">
                      {t.prefixos[campo] && (
                        <span className="text-[15px] font-medium text-muted-foreground">{t.prefixos[campo]}</span>
                      )}
                      <Input
                        id={`calc-${campo}`}
                        inputMode="decimal"
                        value={bruto[campo]}
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={`calc-${campo}-erro`}
                        onChange={(e) => setBruto((atual) => ({ ...atual, [campo]: e.target.value }))}
                        className={`h-11 rounded-xl text-[16px] ${erro ? "border-destructive" : ""}`}
                      />
                      {t.sufixos[campo] && (
                        <span className="text-[15px] font-medium text-muted-foreground">{t.sufixos[campo]}</span>
                      )}
                    </span>
                    <span
                      id={`calc-${campo}-erro`}
                      className={`text-[12px] ${erro ? "text-destructive-text" : "text-muted-foreground"}`}
                    >
                      {erro ?? t.dicas[campo]}
                    </span>
                  </label>
                );
              })}
            </div>

            <p className="text-[13px] text-muted-foreground">{t.ilustrativoHint}</p>
          </div>

          <div className="flex flex-col gap-6 rounded-[24px] bg-foreground p-6 text-background lg:p-8">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-background/60">
                {t.resultTitle}
              </span>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <span className="text-[clamp(46px,7vw,76px)] font-semibold leading-none tracking-[-0.05em]">
                  {semResultado ? "—" : formatBRL(r.custoPorResultadoAgente ?? 0)}
                </span>
              </div>
              <span className="text-[15px] text-background/70">{t.resultAgente}</span>
              {delta !== null && delta >= 0 && (
                <span className="self-start rounded-full bg-accent px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-accent-foreground">
                  {t.deltaBarato(formatNumero(delta))}
                </span>
              )}
              {delta !== null && delta < 0 && (
                <span className="self-start rounded-full bg-destructive px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-destructive-foreground">
                  {t.deltaCaro(formatNumero(-delta))}
                </span>
              )}
              <span className="text-[17px] font-medium">
                {t.resultHumano}:{" "}
                {semResultado ? "—" : formatBRL(r.custoPorResultadoHumano ?? 0)}
              </span>
              {!semResultado && r.custoMedioPorAgente !== null && (
                <span className="text-[14px] text-background/70">{t.mediaAgente(formatBRL(r.custoMedioPorAgente, false))}</span>
              )}
              {semResultado && <span className="text-[14px] text-background/70">{t.semDados}</span>}
            </div>

            <dl className="grid gap-px overflow-hidden rounded-[16px] bg-background/15 sm:grid-cols-3">
              <div className="flex flex-col gap-1 bg-foreground p-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-background/60">
                  {t.stats.resultados}
                </dt>
                <dd className="text-[22px] font-semibold tracking-[-0.02em]">
                  {semResultado ? "—" : formatNumero(r.resultadosValidados)}
                </dd>
              </div>
              <div className="flex flex-col gap-1 bg-foreground p-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-background/60">
                  {t.stats.humanoMes}
                </dt>
                <dd className="text-[22px] font-semibold tracking-[-0.02em]">
                  {semResultado ? "—" : formatBRL(r.custoHumanoMensal, false)}
                </dd>
              </div>
              <div className="flex flex-col gap-1 bg-foreground p-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-background/60">
                  {t.stats.economia}
                </dt>
                <dd className="text-[22px] font-semibold tracking-[-0.02em]">
                  {semResultado || r.economiaMensal === null ? "—" : formatBRL(r.economiaMensal, false)}
                  {!semResultado && r.economiaMensal !== null && r.economiaMensal < 0 && (
                    <span className="block text-[12px] font-normal text-background/70">{t.stats.negativa}</span>
                  )}
                </dd>
              </div>
            </dl>

            <Link
              href="/sign-up"
              className="mt-auto inline-flex justify-center rounded-full bg-background px-6 py-3 text-[16px] font-medium text-foreground transition-opacity hover:opacity-90"
            >
              {t.cta}
            </Link>
            <span className="text-center text-[13px] text-background/60">{t.semLogin}</span>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-5 py-14 lg:px-12">
          <div className="rounded-[24px] border border-black/[.08] bg-secondary p-6 lg:p-8">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{t.formulaTitle}</h2>
            <ul className="mt-4 flex flex-col gap-2 font-mono text-[13px] leading-[1.6] text-foreground">
              {t.formula.map((linha) => (
                <li key={linha} className="flex gap-2">
                  <span className="text-muted-foreground">›</span>
                  <span>{linha}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-[760px] text-[14px] leading-[1.5] text-muted-foreground">{t.formulaNote}</p>
          </div>
        </section>
      </main>

      <HomeFechamento />
    </div>
  );
}
