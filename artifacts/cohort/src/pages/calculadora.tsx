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
  } as Record<CampoEntrada, string>,
  dicas: {
    agentes: "quantos estão rodando hoje",
    tarefas: "volume que os agentes processam",
    aceitacao: "o que virou resultado aceito",
    gastoMensal: "modelos, infra e licenças",
    custoHora: "salário + encargos ÷ horas",
    minutosPorTarefa: "tempo de um humano na mesma tarefa",
  } as Record<CampoEntrada, string>,
  sufixos: { aceitacao: "%", minutosPorTarefa: "min" } as Partial<Record<CampoEntrada, string>>,
  prefixos: { gastoMensal: "R$", custoHora: "R$" } as Partial<Record<CampoEntrada, string>>,
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
    "custo por resultado (humano) = custo humano mensal ÷ resultados validados",
  ],
  formulaNote:
    "Os dois lados gastam em todas as tarefas e só a aceitação conta como resultado: aceitação baixa pesa nos dois. O custo humano usa o tempo médio por tarefa que você informou.",
  cta: "Iniciar avaliação",
  semLogin: "Sem cartão. Sem instalação.",
};

const copy: Record<Lang, typeof pt> = { pt, en: pt, es: pt };

const CAMPOS: CampoEntrada[] = ["agentes", "tarefas", "aceitacao", "gastoMensal", "custoHora", "minutosPorTarefa"];

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
