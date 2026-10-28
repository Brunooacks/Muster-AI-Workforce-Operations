import { useState } from "react";
import { Link } from "wouter";
import { useLang, localize, type Lang } from "@/lib/i18n";

type Plan = {
  name: string;
  who: string;
  monthly: string;
  yearly: string;
  monthlyNote: string;
  yearlyNote: string;
  pitch: string;
  items: string[];
  cta: string;
  extra: string;
  dark: boolean;
};

const PLANS_PT: Plan[] = [
  {
    name: "Startups",
    who: "Até 2 anos de CNPJ ou até R$ 4,8 mi/ano e 20 pessoas",
    monthly: "Grátis ou R$ 199",
    yearly: "Grátis ou R$ 1.990",
    monthlyNote: "por mês · preço válido por 24 meses",
    yearlyNote: "por ano · 2 meses grátis",
    pitch: "Para provar valor desde o primeiro agente.",
    items: [
      "Grátis: 2 agentes e 30 dias de histórico",
      "Startup: 5 agentes e 90 dias de histórico",
      "Relatório mensal de entregas (plano pago)",
      "Agente adicional: R$ 39/mês",
      "Suporte por comunidade e e-mail",
    ],
    cta: "Começar grátis",
    extra: "Sem cartão.",
    dark: false,
  },
  {
    name: "Pequenas e Médias Empresas",
    who: "Até R$ 300 mi/ano ou 500 pessoas",
    monthly: "R$ 690",
    yearly: "R$ 6.900",
    monthlyNote: "por mês",
    yearlyNote: "por ano · 2 meses grátis",
    pitch: "Para quem já tem agentes em produção.",
    items: [
      "Até 25 agentes e 15 usuários",
      "12 meses de histórico",
      "Relatório mensal de entregas",
      "Agente adicional: R$ 29/mês",
      "Suporte por e-mail em 1 dia útil",
    ],
    cta: "Testar 14 dias grátis",
    extra: "Sem cartão.",
    dark: true,
  },
  {
    name: "Grandes Empresas",
    who: "Acima disso, ou quem precisa de contrato, SSO ou SLA",
    monthly: "a partir de R$ 2.990",
    yearly: "contrato anual",
    monthlyNote: "por mês, sob contrato",
    yearlyNote: "a partir de R$ 2.990/mês",
    pitch: "Para operações em escala, com SLA e auditoria.",
    items: [
      "A partir de 50 agentes, usuários ilimitados",
      "24 a 36 meses de histórico",
      "Relatório mensal + auditoria trimestral",
      "Agente adicional: a partir de R$ 19/mês",
      "Canal dedicado com SLA",
    ],
    cta: "Falar com a equipe",
    extra: "Piloto de 30 dias por R$ 990, abatido no contrato anual.",
    dark: false,
  },
];

const TR: Partial<Record<Lang, Record<string, string>>> = {
  en: {
  "Até 2 anos de CNPJ ou até R$ 4,8 mi/ano e 20 pessoas": "Company up to 2 years old, or up to R$ 4.8M/year and 20 people",
  "Grátis ou R$ 199": "Free or R$ 199",
  "Grátis ou R$ 1.990": "Free or R$ 1,990",
  "por mês · preço válido por 24 meses": "per month · price valid for 24 months",
  "por ano · 2 meses grátis": "per year · 2 months free",
  "Para provar valor desde o primeiro agente.": "To prove value from the first agent.",
  "Grátis: 2 agentes e 30 dias de histórico": "Free: 2 agents and 30 days of history",
  "Startup: 5 agentes e 90 dias de histórico": "Startup: 5 agents and 90 days of history",
  "Relatório mensal de entregas (plano pago)": "Monthly delivery report (paid plan)",
  "Agente adicional: R$ 39/mês": "Additional agent: R$ 39/month",
  "Suporte por comunidade e e-mail": "Community and email support",
  "Começar grátis": "Start for free",
  "Sem cartão.": "No card required.",
  "Pequenas e Médias Empresas": "Small and Mid-sized Companies",
  "Até R$ 300 mi/ano ou 500 pessoas": "Up to R$ 300M/year or 500 people",
  "R$ 6.900": "R$ 6,900",
  "por mês": "per month",
  "Para quem já tem agentes em produção.": "For companies that already run agents in production.",
  "Até 25 agentes e 15 usuários": "Up to 25 agents and 15 users",
  "12 meses de histórico": "12 months of history",
  "Relatório mensal de entregas": "Monthly delivery report",
  "Agente adicional: R$ 29/mês": "Additional agent: R$ 29/month",
  "Suporte por e-mail em 1 dia útil": "Email support within 1 business day",
  "Testar 14 dias grátis": "Try free for 14 days",
  "Grandes Empresas": "Enterprise",
  "Acima disso, ou quem precisa de contrato, SSO ou SLA": "Above that, or if you need a contract, SSO or SLA",
  "a partir de R$ 2.990": "from R$ 2,990",
  "contrato anual": "annual contract",
  "por mês, sob contrato": "per month, under contract",
  "a partir de R$ 2.990/mês": "from R$ 2,990/month",
  "Para operações em escala, com SLA e auditoria.": "For operations at scale, with SLA and audit.",
  "A partir de 50 agentes, usuários ilimitados": "From 50 agents, unlimited users",
  "24 a 36 meses de histórico": "24 to 36 months of history",
  "Relatório mensal + auditoria trimestral": "Monthly report + quarterly audit",
  "Agente adicional: a partir de R$ 19/mês": "Additional agent: from R$ 19/month",
  "Canal dedicado com SLA": "Dedicated channel with SLA",
  "Falar com a equipe": "Talk to our team",
  "Piloto de 30 dias por R$ 990, abatido no contrato anual.": "30-day pilot for R$ 990, credited toward the annual contract."
},
  es: {
  "Até 2 anos de CNPJ ou até R$ 4,8 mi/ano e 20 pessoas": "Empresa de hasta 2 años, o hasta R$ 4,8 M/año y 20 personas",
  "Grátis ou R$ 199": "Gratis o R$ 199",
  "Grátis ou R$ 1.990": "Gratis o R$ 1.990",
  "por mês · preço válido por 24 meses": "por mes · precio válido por 24 meses",
  "por ano · 2 meses grátis": "por año · 2 meses gratis",
  "Para provar valor desde o primeiro agente.": "Para demostrar valor desde el primer agente.",
  "Grátis: 2 agentes e 30 dias de histórico": "Gratis: 2 agentes y 30 días de historial",
  "Startup: 5 agentes e 90 dias de histórico": "Startup: 5 agentes y 90 días de historial",
  "Relatório mensal de entregas (plano pago)": "Informe mensual de entregas (plan pago)",
  "Agente adicional: R$ 39/mês": "Agente adicional: R$ 39/mes",
  "Suporte por comunidade e e-mail": "Soporte por comunidad y correo",
  "Começar grátis": "Comenzar gratis",
  "Sem cartão.": "Sin tarjeta.",
  "Pequenas e Médias Empresas": "Pequeñas y Medianas Empresas",
  "Até R$ 300 mi/ano ou 500 pessoas": "Hasta R$ 300 M/año o 500 personas",
  "R$ 6.900": "R$ 6.900",
  "por mês": "por mes",
  "Para quem já tem agentes em produção.": "Para quienes ya tienen agentes en producción.",
  "Até 25 agentes e 15 usuários": "Hasta 25 agentes y 15 usuarios",
  "12 meses de histórico": "12 meses de historial",
  "Relatório mensal de entregas": "Informe mensual de entregas",
  "Agente adicional: R$ 29/mês": "Agente adicional: R$ 29/mes",
  "Suporte por e-mail em 1 dia útil": "Soporte por correo en 1 día hábil",
  "Testar 14 dias grátis": "Probar 14 días gratis",
  "Grandes Empresas": "Grandes Empresas",
  "Acima disso, ou quem precisa de contrato, SSO ou SLA": "Por encima de eso, o si necesita contrato, SSO o SLA",
  "a partir de R$ 2.990": "desde R$ 2.990",
  "contrato anual": "contrato anual",
  "por mês, sob contrato": "por mes, bajo contrato",
  "a partir de R$ 2.990/mês": "desde R$ 2.990/mes",
  "Para operações em escala, com SLA e auditoria.": "Para operaciones a escala, con SLA y auditoría.",
  "A partir de 50 agentes, usuários ilimitados": "Desde 50 agentes, usuarios ilimitados",
  "24 a 36 meses de histórico": "24 a 36 meses de historial",
  "Relatório mensal + auditoria trimestral": "Informe mensual + auditoría trimestral",
  "Agente adicional: a partir de R$ 19/mês": "Agente adicional: desde R$ 19/mes",
  "Canal dedicado com SLA": "Canal dedicado con SLA",
  "Falar com a equipe": "Hablar con el equipo",
  "Piloto de 30 dias por R$ 990, abatido no contrato anual.": "Piloto de 30 días por R$ 990, descontado del contrato anual."
},
};

const pt = {
  eyebrow: "Preços",
  h2: "Preço fixo por empresa. Sem cobrança por usuário.",
  sub: "Três planos, por porte de empresa. Agentes adicionais quando precisar.",
  tabs: ["Mensal", "Anual · 2 meses grátis"],
  pending: "Preços pendentes de decisão",
  footnote:
    "Sem cobrança surpresa: aviso aos 80% do limite; acima de 100%, 30 dias de coleta antes de você escolher. Auditoria avulsa: R$ 490 (inclusa em Grandes Empresas).",
};

const en: typeof pt = {
  eyebrow: "Pricing",
  h2: "Flat price per company. No per-user fees.",
  sub: "Three plans, by company size. Additional agents when you need them.",
  tabs: ["Monthly", "Annual · 2 months free"],
  pending: "Pricing pending decision",
  footnote:
    "No surprise charges: notice at 80% of the limit; above 100%, 30 days of collection before you choose. One-off audit: R$ 490 (included in Enterprise).",
};
const es: typeof pt = {
  eyebrow: "Precios",
  h2: "Precio fijo por empresa. Sin cobro por usuario.",
  sub: "Tres planes, según el tamaño de la empresa. Agentes adicionales cuando los necesite.",
  tabs: ["Mensual", "Anual · 2 meses gratis"],
  pending: "Precios pendientes de decisión",
  footnote:
    "Sin cobros inesperados: aviso al 80% del límite; por encima del 100%, 30 días de recolección antes de que usted elija. Auditoría puntual: R$ 490 (incluida en Grandes Empresas).",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

export function HomePrecos() {
  const { lang } = useLang();
  const PLANS = localize(PLANS_PT, TR[lang]);
  const t = copy[lang] ?? copy.pt;
  const [annual, setAnnual] = useState(false);

  return (
    <section
      id="precos"
      className="mx-auto flex max-w-[1280px] scroll-mt-20 flex-col items-center gap-10 px-5 pt-[clamp(64px,10vw,120px)] text-center lg:px-12"
    >
      <div className="flex max-w-[860px] flex-col gap-3.5">
        <span className="text-[13px] font-medium text-muted-foreground">{t.eyebrow}</span>
        <h2 className="text-[clamp(28px,4.4vw,56px)] font-semibold leading-[1.05] tracking-[-0.04em] text-balance">
          {t.h2}
        </h2>
        <p className="text-[clamp(16px,1.6vw,19px)] leading-[1.5] text-muted-foreground">{t.sub}</p>
        <span className="mx-auto mt-1 inline-flex items-center gap-2 rounded-full border border-chart-2 bg-chart-2/10 px-4 py-1.5 text-[13px] font-medium text-[hsl(var(--chart-2-text))]">
          {t.pending}
        </span>
      </div>

      <div className="flex flex-wrap justify-center rounded-[24px] bg-black/[.06] p-1">
        {t.tabs.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setAnnual(index === 1)}
            aria-pressed={(index === 1) === annual}
            className={`rounded-full px-[18px] py-2 text-[14px] font-medium transition-all ${
              (index === 1) === annual
                ? "bg-white text-foreground shadow-[0_1px_4px_rgba(0,0,0,.12)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`flex flex-col gap-[18px] rounded-[24px] p-8 text-left ${
              plan.dark
                ? "border border-foreground bg-foreground text-[#f5f5f7]"
                : "border border-black/[.06] bg-secondary text-foreground"
            }`}
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-[20px] font-semibold tracking-[-0.02em]">{plan.name}</span>
              <span className="text-[14px] leading-[1.4] opacity-70">{plan.who}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[clamp(32px,3.6vw,48px)] font-semibold leading-none tracking-[-0.045em]">
                {annual ? plan.yearly : plan.monthly}
              </span>
              <span className="text-[13px] opacity-70">
                {annual ? plan.yearlyNote : plan.monthlyNote}
              </span>
            </div>

            <p className="text-[15px] leading-[1.5] opacity-85">{plan.pitch}</p>

            <div
              className={`flex flex-col gap-[9px] border-t pt-4 text-[14px] leading-[1.4] ${
                plan.dark ? "border-white/[.14]" : "border-black/[.1]"
              }`}
            >
              {plan.items.map((item) => (
                <span key={item} className="flex gap-2">
                  <span style={{ color: plan.dark ? "#19d3f5" : "hsl(var(--cyan-text))" }}>
                    ✓
                  </span>
                  <span>{item}</span>
                </span>
              ))}
            </div>

            <Link
              href="/sign-up"
              className={`mt-auto block rounded-full px-[18px] py-3 text-center text-[14px] font-semibold transition-opacity hover:opacity-90 ${
                plan.dark ? "bg-[#19d3f5] text-foreground" : "bg-foreground text-background"
              }`}
            >
              {plan.cta}
            </Link>
            <span className="text-center text-[12px] leading-[1.4] opacity-60">{plan.extra}</span>
          </div>
        ))}
      </div>

      <p className="max-w-[820px] text-[14px] leading-[1.6] text-muted-foreground">{t.footnote}</p>
    </section>
  );
}
