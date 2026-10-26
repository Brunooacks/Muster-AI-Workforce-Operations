import { Link } from "wouter";
import { MusterShell } from "../shell";
import { AG, Disc, F, TipLine, useT } from "../fmt";
const ID = Object.fromEntries(Object.values(AG).map((a) => [a.nome, a.id]));

type T3 = [string, string, string];
type Sq = { nome: T3; lider: string; fonte: string; ent: [number, number]; custo: [number, number]; ciclo: [number, number]; pessoas: number; papel: T3; ctb: [string, number][] };
const C = ["#b6b6bb", "#1d1d1f", "hsl(var(--chart-1))", "hsl(var(--chart-5))"];
const SQ: Sq[] = [
  { nome: ["Faturamento", "Billing", "Facturación"], lider: "Carla Mendes", fonte: "Jira · FIN", ent: [1470, 1180], custo: [50.54, 81.69], ciclo: [2.1, 3.9], pessoas: 4, papel: ["revisão, exceções, clientes-chave", "review, exceptions, key accounts", "revisión, excepciones, clientes clave"], ctb: [["", 22], ["Cadastro", 31], ["Agente Fiscal", 27], ["Cobrança", 20]] },
  { nome: ["Plataforma", "Platform", "Plataforma"], lider: "Rafael Carvalho", fonte: "Linear · PLAT + GitHub", ent: [268, 212], custo: [452.99, 556.6], ciclo: [5.1, 6.4], pessoas: 5, papel: ["arquitetura, revisão de PR, incidentes", "architecture, PR review, incidents", "arquitectura, revisión de PR, incidentes"], ctb: [["", 61], ["Forja", 18], ["Helena", 21]] },
  { nome: ["Last mile", "Last mile", "Last mile"], lider: "Diego Ramos", fonte: "Jira · OPS", ent: [2290, 1720], custo: [31.4, 51.28], ciclo: [0.9, 1.6], pessoas: 6, papel: ["roteiros especiais, ocorrências", "special routes, occurrences", "rutas especiales, incidencias"], ctb: [["", 38], ["Atlas", 62]] },
  { nome: ["Pós-venda", "After-sales", "Posventa"], lider: "Marina Duarte", fonte: "Zendesk", ent: [1650, 1310], custo: [41.7, 60.38], ciclo: [0.8, 1.2], pessoas: 7, papel: ["casos complexos, retenção", "complex cases, retention", "casos complejos, retención"], ctb: [["", 33], ["Sofia", 67]] },
];
const pct = (a: number, b: number) => { const v = Math.round((a / b - 1) * 100); return (v > 0 ? "+" : "−") + Math.abs(v) + "%"; };

export default function SquadsPage() {
  const t = useT();
  const pess = t("Pessoas", "People", "Personas");
  return (
    <MusterShell active="squads">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}>{t("Squads mistos", "Mixed squads", "Squads mixtos")} <span className="mono">· Lumen Logística S.A. · {t("setembro/2026", "September/2026", "septiembre/2026")}</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}>
          <h1>{t("4 squads mistos: +28% de entregas.", "4 mixed squads: +28% deliveries.", "4 squads mixtos: +28% de entregas.")} <em>{t("Custo por entrega 31% menor.", "Cost per delivery 31% lower.", "Costo por entrega 31% menor.")}</em></h1>
          <div className="covline">{t("Pessoas + agentes · medido por squad, nunca por pessoa", "People + agents · measured per squad, never per person", "Personas + agentes · medido por squad, nunca por persona")}</div>
        </div>
        <div className="kpis">
          <div className="kpi"><small>{t("Entregas/mês", "Deliveries/month", "Entregas/mes")}</small><span className="v">5.678</span><p>{t("antes", "before", "antes")} 4.422</p></div>
          <div className="kpi"><small>{t("Custo por entrega", "Cost per delivery", "Costo por entrega")}</small><span className="v">R$ 59,25</span><p>{t("antes", "before", "antes")} R$ 86,32</p></div>
          <div className="kpi"><small>{t("Ciclo mediano", "Median cycle", "Ciclo mediano")}</small><span className="v">2,2<sub>{t("dias", "days", "días")}</sub></span><p>{t("antes 3,3 dias", "before 3.3 days", "antes 3,3 días")}</p></div>
          <div className="kpi"><small>{t("Composição", "Composition", "Composición")}</small><span className="v">22<sub>{t("pessoas", "people", "personas")}</sub> 7<sub>{t("agentes", "agents", "agentes")}</sub></span><p>{t("em 4 squads", "in 4 squads", "en 4 squads")}</p></div>
        </div>
        <div className="sqs" style={{ marginTop: 14 }}>
          {SQ.map((s) => (
            <article className="sq" key={s.nome[0]}>
              <h3>{t(...s.nome)} <small>{t("líder", "lead", "líder")} {s.lider} · {s.fonte}</small></h3>
              <div className="ba">
                <div><small>{t("Entregas/mês", "Deliveries/month", "Entregas/mes")}</small><b>{F.n(s.ent[0])}</b> <em className="up">{pct(...s.ent)}</em><s>{F.n(s.ent[1])}</s></div>
                <div><small>{t("Custo/entrega", "Cost/delivery", "Costo/entrega")}</small><b>{F.brl(s.custo[0])}</b> <em className="up">{pct(...s.custo)}</em><s>{F.brl(s.custo[1])}</s></div>
                <div><small>{t("Ciclo (dias)", "Cycle (days)", "Ciclo (días)")}</small><b>{F.n(s.ciclo[0], 1)}</b> <em className="up">{pct(...s.ciclo)}</em><s>{F.n(s.ciclo[1], 1)}</s></div>
              </div>
              <div>
                <small style={{ font: "500 10.5px var(--app-font-mono)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--faint)" }}>{t("Contribuição nas entregas", "Share of deliveries", "Contribución en las entregas")}</small>
                <div className="ctb" style={{ marginTop: 8 }}>{s.ctb.map(([n, v], i) => <i key={i} style={{ width: v + "%", background: C[i] }} title={n || `${pess} (${s.pessoas})`} />)}</div>
                <div className="ctl" style={{ marginTop: 8 }}>{s.ctb.map(([n, v], i) => <span key={i} style={{ ["--cc" as string]: C[i] }}>{n && ID[n] ? <Link href={`/agentes/${ID[n]}/ficha`}>{n} {v}%</Link> : `${pess} (${s.pessoas}) ${v}% · ${t(...s.papel)}`}</span>)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link className="btn sm soft" href="/board">{t("Ver board do squad", "View squad board", "Ver board del squad")}</Link>
                <button className="btn sm ghost" data-toast={t("O recorte individual só abre com consentimento registrado de cada pessoa (LGPD).", "The per-person view only opens with each person's recorded consent (LGPD).", "La vista individual solo se abre con el consentimiento registrado de cada persona (LGPD).")}>{t("Ver por pessoa · requer consentimento", "View per person · needs consent", "Ver por persona · requiere consentimiento")}</button>
              </div>
            </article>
          ))}
        </div>
        <TipLine label={t("Como medimos um squad misto", "How we measure a mixed squad", "Cómo medimos un squad mixto")} text={t("Entregas e tempo de ciclo vêm das issues fechadas no Jira ou no Linear. “Antes” é a média dos 6 meses anteriores à entrada do primeiro agente, importada pelo conector. A contribuição é a parcela das entregas em que a pessoa ou o agente foi responsável. Pessoas aparecem somadas; o recorte individual depende de consentimento (LGPD) e não gera nota pessoal.", "Deliveries and cycle time come from issues closed in Jira or Linear. “Before” is the average of the 6 months before the first agent joined, imported by the connector. Share is the portion of deliveries a person or agent owned. People are shown summed; a per-person view needs consent (LGPD) and never yields a personal score.", "Entregas y tiempo de ciclo vienen de las issues cerradas en Jira o Linear. “Antes” es el promedio de los 6 meses previos a la entrada del primer agente, importado por el conector. La contribución es la parte de las entregas a cargo de la persona o del agente. Las personas aparecen sumadas; la vista individual depende de consentimiento (LGPD) y no genera nota personal.")} />
        <Disc />
      </main>
    </MusterShell>
  );
}
