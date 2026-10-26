import { Link, useParams } from "wouter";
import { MusterShell } from "../shell";
import { AG, DEMO, Disc, F, Tip, useT, type Agent } from "../fmt";

type L3 = [string, string, string];
/** Propósito de cada agente: a atividade repetitiva que ele assume e o que fica com as pessoas. Dados ilustrativos. */
const PROP: Record<string, [L3, L3]> = {
  sofia: [["Responder dúvidas frequentes de nível 1", "Answer tier-1 frequent questions", "Responder dudas frecuentes de nivel 1"], ["casos complexos e retenção", "complex cases and retention", "casos complejos y retención"]],
  atlas: [["Montar as rotas do dia", "Build the day's routes", "Armar las rutas del día"], ["roteiros especiais e ocorrências", "special routes and occurrences", "rutas especiales e incidencias"]],
  fiscal: [["Emitir NF-e padrão", "Issue standard e-invoices", "Emitir facturas electrónicas estándar"], ["exceções fiscais", "tax exceptions", "excepciones fiscales"]],
  cobranca: [["Executar a régua de cobrança", "Run the collections cadence", "Ejecutar la regla de cobranza"], ["negociação com clientes-chave", "key-account negotiation", "negociación con clientes clave"]],
  cadastro: [["Validar cadastros", "Check registrations", "Validar registros"], ["casos com divergência", "mismatched cases", "casos con divergencia"]],
  triagem: [["Triar notas recebidas", "Triage incoming invoices", "Clasificar facturas recibidas"], ["notas fora do padrão", "non-standard invoices", "facturas fuera de estándar"]],
  helena: [["Atender suporte de TI nível 1", "Handle tier-1 IT support", "Atender soporte de TI nivel 1"], ["incidentes e acessos críticos", "incidents and critical access", "incidentes y accesos críticos"]],
  code: [["Abrir PRs de manutenção", "Open maintenance PRs", "Abrir PRs de mantenimiento"], ["arquitetura e revisão de PR", "architecture and PR review", "arquitectura y revisión de PR"]],
};

const R = { display: "grid", gridTemplateColumns: "minmax(110px,38%) 1fr", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: 14, lineHeight: 1.4 } as const;
export function fichaFaixa(a: Agent) { const r = a.custoPorResultado / a.custoHumanoUnit, q = a.qualidade - a.baseline; return r > 1 ? "vermelho" : (r > 0.7 || q < 0) ? "amarelo" : "verde"; }

export default function FichaAgentePage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const a = AG[id ?? ""] ?? AG.atlas;
  const [prop, fica] = PROP[a.id] ?? PROP.atlas;
  const fx = fichaFaixa(a);
  const devolvidas = a.entregas - a.validadas;
  const custoRel = a.custoPorResultado / a.custoHumanoUnit * 100;
  const horas = a.validadas * a.bl.horasProd / a.bl.n;
  const FX: Record<string, string> = { verde: t("dentro da faixa", "within range", "dentro del rango"), amarelo: t("atenção", "attention", "atención"), vermelho: t("fora da faixa", "out of range", "fuera del rango") };
  const ok = (b: boolean) => <span className={"faixa " + (b ? "verde" : "vermelho")}>{b ? t("atinge", "meets", "cumple") : t("não atinge", "misses", "no cumple")}</span>;
  const metas: [string, string, string, boolean][] = [
    [t("Custo por resultado vs equipe", "Cost per result vs team", "Costo por resultado vs equipo"), t("até 50% (meta 40%)", "up to 50% (target 40%)", "hasta 50% (meta 40%)"), F.pct(custoRel), custoRel <= 50],
    [t("Qualidade vs baseline humano", "Quality vs human baseline", "Calidad vs baseline humano"), `≥ ${a.baseline}`, `${a.qualidade}`, a.qualidade >= a.baseline],
    [t("Retrabalho (resgate pela equipe)", "Rework (team rescue)", "Retrabajo (rescate por el equipo)"), t("até 10%", "up to 10%", "hasta 10%"), F.pct(a.resgatePct), a.resgatePct <= 10],
    [t("Incidentes no mês", "Incidents this month", "Incidentes en el mes"), "0", `${a.incidentes}`, a.incidentes === 0],
  ];
  const acao: [string, string] = fx === "vermelho"
    ? [t("Devolver a atividade para a equipe", "Return the activity to the team", "Devolver la actividad al equipo"), t(`Custa ${F.brl(a.custoPorResultado)} por resultado contra ${F.brl(a.custoHumanoUnit)} da equipe. A equipe faz melhor e mais barato.`, `It costs ${F.brl(a.custoPorResultado)} per result against ${F.brl(a.custoHumanoUnit)} for the team. The team does it better and cheaper.`, `Cuesta ${F.brl(a.custoPorResultado)} por resultado frente a ${F.brl(a.custoHumanoUnit)} del equipo. El equipo lo hace mejor y más barato.`)]
    : fx === "amarelo"
    ? [t("Ajustar antes de ampliar", "Adjust before expanding", "Ajustar antes de ampliar"), t("Uma meta está fora da faixa. Revise com o responsável antes de dar mais volume.", "One goal is out of range. Review with the owner before adding volume.", "Una meta está fuera del rango. Revise con el responsable antes de dar más volumen.")]
    : [t("Ampliar o volume com o mesmo responsável", "Expand volume with the same owner", "Ampliar el volumen con el mismo responsable"), t(`Dentro de todas as faixas. Libera ${F.n(horas)} h/mês da equipe para ${fica[0]}.`, `Within every range. Frees ${F.n(horas)} h/month of the team for ${fica[1]}.`, `Dentro de todos los rangos. Libera ${F.n(horas)} h/mes del equipo para ${fica[2]}.`)];
  const reg = t("Registrado. O responsável recebe a proposta para decidir.", "Recorded. The owner receives the proposal to decide.", "Registrado. El responsable recibe la propuesta para decidir.");
  return (
    <MusterShell active="agentes">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}><Link href="/squads">{t("Squads mistos", "Mixed squads", "Squads mixtos")}</Link> <span className="mono">· {t("Ficha do agente", "Agent file", "Ficha del agente")} · {DEMO.empresa} · {t("setembro/2026", "September/2026", "septiembre/2026")}</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}>
          <h1>{a.nome}: {t(...prop).toLowerCase()}. <em>{t(`A equipe fica com ${fica[0]}.`, `The team keeps ${fica[1]}.`, `El equipo se queda con ${fica[2]}.`)}</em></h1>
          <div className="covline">{t("Membro do squad", "Squad member", "Miembro del squad")} {a.squad} · {t("responsável", "owner", "responsable")} {a.dono} · {t("compatível com", "compatible with", "compatible con")} {a.plataforma} · <span className={"faixa " + fx}>{FX[fx]}</span></div>
        </div>
        <div className="kpis rise" style={{ ["--i" as string]: 2 }}>
          <div className="kpi"><small>{t("Validadas", "Validated", "Validadas")}</small><span className="v">{F.n(a.validadas)}</span><p>{t("de", "of", "de")} {F.n(a.entregas)} {t("entregas no mês", "deliveries this month", "entregas en el mes")}</p></div>
          <div className="kpi"><small>{t("Devolvidas à equipe", "Returned to the team", "Devueltas al equipo")}</small><span className="v">{F.n(devolvidas)}</span><p>{F.pct(devolvidas / a.entregas * 100, 1)} {t("precisaram de uma pessoa", "needed a person", "necesitaron una persona")}</p></div>
          <div className="kpi"><small>{t("Custo por resultado", "Cost per result", "Costo por resultado")}</small><span className="v">{F.brl(a.custoPorResultado)}</span><p>{t("equipe", "team", "equipo")} {F.brl(a.custoHumanoUnit)}</p></div>
          <div className="kpi"><small>{t("Horas devolvidas", "Hours freed", "Horas liberadas")}</small><span className="v">{F.n(horas)}<sub>h/{t("mês", "month", "mes")}</sub></span><p>{t("para trabalho de julgamento", "for judgment work", "para trabajo de criterio")}</p></div>
        </div>
        <div className="g2" style={{ marginTop: 14 }}>
          <section className="panel rise" style={{ ["--i" as string]: 3 }}>
            <h3>{t("Ficha", "File", "Ficha")} <small>{t("quem responde por este agente", "who answers for this agent", "quién responde por este agente")}</small></h3>
            <div>
              <div style={R}><span style={{ color: "var(--mut)" }}>{t("Responsável", "Owner", "Responsable")}</span><span><b>{a.dono}</b> · {a.time}</span></div>
              <div style={R}><span style={{ color: "var(--mut)" }}>{t("Propósito", "Purpose", "Propósito")}</span><span>{t(...prop)}</span></div>
              <div style={R}><span style={{ color: "var(--mut)" }}>{t("Fica com a equipe", "Stays with the team", "Queda con el equipo")}</span><span>{t(...fica)}</span></div>
              <div style={R}><span style={{ color: "var(--mut)" }}>{t("Função", "Role", "Función")}</span><span>{a.funcao}</span></div>
              <div style={R}><span style={{ color: "var(--mut)" }}>{t("Baseline humano", "Human baseline", "Baseline humano")}</span><span>{a.bl.papel} · {a.bl.origem} <Tip text={t(`Base ${a.bl.versao}, congelada em ${a.bl.congelado}. É a régua de custo e qualidade da equipe para a mesma atividade.`, `Baseline ${a.bl.versao}, frozen on ${a.bl.congelado}. It is the team's cost and quality standard for the same activity.`, `Base ${a.bl.versao}, congelada el ${a.bl.congelado}. Es la medida de costo y calidad del equipo para la misma actividad.`)} /></span></div>
            </div>
          </section>
          <section className="panel rise" style={{ ["--i" as string]: 4 }}>
            <h3>{t("Metas e faixas aceitáveis", "Goals and acceptable ranges", "Metas y rangos aceptables")} <small>{t("resultado vs equipe", "result vs team", "resultado vs equipo")}</small></h3>
            <div>{metas.map((m) => <div key={m[0]} style={R}><span>{m[0]}<br /><small style={{ color: "var(--mut)" }}>{t("faixa", "range", "rango")}: {m[1]}</small></span><span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}><b style={{ fontVariantNumeric: "tabular-nums" }}>{m[2]}</b>{ok(m[3])}</span></div>)}</div>
          </section>
        </div>
        <section className="panel rise" style={{ ["--i" as string]: 5, marginTop: 14 }}>
          <h3>{t("Ação sugerida", "Suggested action", "Acción sugerida")} <small>{t("a decisão é do responsável", "the owner decides", "la decisión es del responsable")}</small></h3>
          <p style={{ font: "600 18px/1.3 var(--app-font-sans)" }}>{acao[0]}</p>
          <p style={{ color: "var(--mut)", margin: "6px 0 14px" }}>{acao[1]}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn sm" data-toast={reg}>{t("Aprovar ação", "Approve action", "Aprobar acción")}</button>
            <button className="btn sm soft" data-toast={t("Registrado. A atividade volta para a equipe no próximo ciclo; o agente fica pausado.", "Recorded. The activity returns to the team next cycle; the agent is paused.", "Registrado. La actividad vuelve al equipo en el próximo ciclo; el agente queda en pausa.")}>{t("Devolver para a equipe", "Return to the team", "Devolver al equipo")}</button>
            <Link className="btn sm ghost" href="/board">{t("Ver no board", "View on board", "Ver en el board")}</Link>
          </div>
        </section>
        <Disc />
      </main>
    </MusterShell>
  );
}
