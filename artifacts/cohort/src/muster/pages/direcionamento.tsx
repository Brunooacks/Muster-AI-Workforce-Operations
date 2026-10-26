import { Link } from "wouter";
import { MusterShell } from "../shell";
import { AG, DEMO, Disc, F, MES, Tip, useT, type Agent } from "../fmt";

type L3 = [string, string, string];
/* atividade, repetitividade %, volume/mês, agente | null (equipe), lugar certo?, custo da equipe/res. quando não há agente */
const AT: [L3, number, number, string | null, 0 | 1, number?][] = [
  [["Validação de cadastro", "Registration check", "Validación de registro"], 92, 2040, "cadastro", 1],
  [["Roteirização diária", "Daily routing", "Ruteo diario"], 88, 2310, "atlas", 1],
  [["Régua de cobrança", "Collections cadence", "Regla de cobranza"], 90, 1388, "cobranca", 1],
  [["Emissão de NF-e", "E-invoice issuing", "Emisión de factura electrónica"], 85, 1960, "fiscal", 1],
  [["Atendimento nível 1", "Tier-1 support", "Atención nivel 1"], 74, 1284, "sofia", 1],
  [["Suporte de TI nível 1", "Tier-1 IT support", "Soporte de TI nivel 1"], 70, 910, "helena", 1],
  [["PRs de manutenção", "Maintenance PRs", "PRs de mantenimiento"], 55, 146, "code", 1],
  [["Triagem de notas recebidas", "Incoming invoice triage", "Clasificación de facturas recibidas"], 80, 640, "triagem", 0],
  [["Conferência de lote fiscal", "Tax batch check", "Revisión de lote fiscal"], 89, 820, null, 0, 5.4],
  [["Negociação com clientes-chave", "Key-account negotiation", "Negociación con clientes clave"], 15, 120, null, 1, 48],
  [["Fechamento contábil", "Accounting close", "Cierre contable"], 30, 12, null, 1, 610],
];
export function faixa(a: Agent) { const r = a.custoPorResultado / a.custoHumanoUnit, q = a.qualidade - a.baseline; return r > 1 ? "vermelho" : (r > 0.7 || q < 0) ? "amarelo" : "verde"; }
const horasDe = (a: Agent) => a.validadas * a.bl.horasProd / a.bl.n;

export default function DirecionamentoPage() {
  const t = useT();
  let horas = 0, roteadas = 0;
  AT.forEach((x) => { if (x[3]) { roteadas++; horas += horasDe(AG[x[3]]); } });
  const reds = AT.filter((x) => x[3] && faixa(AG[x[3]]) === "vermelho").length;
  const verdes = AT.filter((x) => x[3] && faixa(AG[x[3]]) === "verde").length;
  const ativ = t("atividade", "activity", "actividad");
  const FX: Record<string, string> = { verde: t("verde", "green", "verde"), amarelo: t("amarelo", "yellow", "amarillo"), vermelho: t("vermelho", "red", "rojo"), cinza: "—" };
  const S = DEMO.snaps, pts = S.map((s) => s.cpr / s.humano * 100), w = 340, h = 200, y = (v: number) => h - 24 - (v - 20) / 40 * (h - 44);
  const AC: [string, string, number, string][] = [
    [t("Devolver para a equipe", "Return to the team", "Devolver al equipo"), t("Triagem de notas recebidas", "Incoming invoice triage", "Clasificación de facturas recibidas"), 2419, t("Custa R$ 11,32 por resultado contra R$ 4,80 da equipe e não deixa registro auditável.", "Costs R$ 11.32 per result vs R$ 4.80 for the team and leaves no auditable record.", "Cuesta R$ 11,32 por resultado contra R$ 4,80 del equipo y no deja registro auditable.")],
    [t("Incluir ponto de aprovação humana", "Add a human approval step", "Incluir punto de aprobación humana"), t("Emissão de NF-e · lote CFOP 6102", "E-invoice issuing · CFOP 6102 batch", "Emisión de factura · lote CFOP 6102"), 1960, t("27% das notas voltam para correção. Um aprovador no lote 6102 evita a perda no repasse para a Cobrança.", "27% of invoices come back for fixes. An approver on batch 6102 avoids the loss at the hand-off to Collections.", "27% de las facturas vuelven a corrección. Un aprobador en el lote 6102 evita la pérdida en el traspaso a Cobranza.")],
    [t("Ajustar instrução", "Adjust instructions", "Ajustar instrucción"), t("PRs de manutenção (Forja)", "Maintenance PRs (Forja)", "PRs de mantenimiento (Forja)"), 610, t("17% de resgate. Instrução com padrão de testes do repositório reduz retrabalho na revisão.", "17% rescue rate. Instructions with the repo's test pattern cut rework in review.", "17% de rescate. Instrucciones con el patrón de pruebas del repositorio reducen retrabajo en la revisión.")],
    [t("Trocar a IA usada", "Switch the AI used", "Cambiar la IA usada"), t("Suporte de TI nível 1 (Helena)", "Tier-1 IT support (Helena)", "Soporte de TI nivel 1 (Helena)"), 380, t("Etapas simples usam a IA avançada. Trocar para a IA rápida mantém a qualidade com menos consumo.", "Simple steps use the advanced AI. Switching to the fast AI keeps quality with less usage.", "Pasos simples usan la IA avanzada. Cambiar a la IA rápida mantiene la calidad con menos consumo.")],
  ];
  const proposed = t("Proposta registrada (protótipo)", "Proposal logged (illustrative)", "Propuesta registrada (ilustrativo)");
  return (
    <MusterShell active="direcionamento">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}>{t("Direcionamento", "Routing", "Direccionamiento")} <span className="mono">· {DEMO.empresa} · {t(DEMO.periodo, "September 2026", "septiembre de 2026")}</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}>
          <h1>{roteadas} {t("atividades com agentes.", "activities with agents.", "actividades con agentes.")} <em>{F.n(horas)} {t("h/mês de volta à equipe.", "h/month back to the team.", "h/mes de vuelta al equipo.")}</em></h1>
          <div className="covline">{t("Repetitivo vai para agentes · julgamento fica com a equipe", "Repetitive work goes to agents · judgment stays with the team", "Lo repetitivo va a agentes · el criterio queda con el equipo")} <Tip text={t("O objetivo é tirar da equipe o trabalho trivial e repetitivo, não substituir pessoas. Quando um agente custa mais que a equipe para a mesma atividade, a sugestão é devolver a atividade para a equipe.", "The goal is to take trivial, repetitive work off the team, not to replace people. When an agent costs more than the team for the same activity, the suggestion is to return it to the team.", "El objetivo es quitar al equipo el trabajo trivial y repetitivo, no reemplazar personas. Cuando un agente cuesta más que el equipo para la misma actividad, la sugerencia es devolverla al equipo.")} /></div>
        </div>
        <div className="kpis">
          {([
            [t("Horas liberadas", "Hours freed", "Horas liberadas"), <>{F.n(horas)}<sub>{t("h/mês", "h/month", "h/mes")}</sub></>, `≈ ${F.n(horas / 117.6, 1)} ${t("pessoas em trabalho de julgamento.", "people on judgment work.", "personas en trabajo de criterio.")}`],
            [t("Na faixa verde", "In the green band", "En la franja verde"), <>{verdes}<sub>{t("de", "of", "de")} {roteadas}</sub></>, t("Mais baratas, mesma qualidade.", "Cheaper, same quality.", "Más baratas, misma calidad.")],
            [t("Em prejuízo", "Losing money", "En pérdida"), <>{reds}<sub>{ativ}</sub></>, t("Sugestão: devolver para a equipe.", "Suggestion: return to the team.", "Sugerencia: devolver al equipo.")],
            [t("Candidatas a agente", "Agent candidates", "Candidatas a agente"), <>1<sub>{ativ}</sub></>, t("Conferência de lote fiscal, 89% repetitiva.", "Tax batch check, 89% repetitive.", "Revisión de lote fiscal, 89% repetitiva.")],
          ] as const).map((k, i) => <div className="kpi" key={i}><small>{k[0]}</small><span className="v">{k[1]}</span><p>{k[2]}</p></div>)}
        </div>
        <section className="panel rise" style={{ ["--i" as string]: 4, marginTop: 14 }}>
          <h3>{t("Atividades e onde estão", "Activities and where they sit", "Actividades y dónde están")} <small>{t("faixa vs custo da equipe", "band vs team cost", "franja vs costo del equipo")} <Tip text={t("Verde: agente custa até 70% da equipe por resultado, com qualidade igual ou melhor. Amarelo: entre 70% e 100%, ou qualidade abaixo da referência da equipe. Vermelho: custa mais que a equipe, é prejuízo. Repetitividade = parcela das ocorrências que seguem o mesmo padrão, medida no histórico do Jira e do Linear.", "Green: agent costs up to 70% of the team per result, with equal or better quality. Yellow: 70% to 100%, or quality below the team benchmark. Red: costs more than the team, a loss. Repetitiveness = share of cases that follow the same pattern, measured in Jira and Linear history.", "Verde: el agente cuesta hasta 70% del equipo por resultado, con calidad igual o mejor. Amarillo: entre 70% y 100%, o calidad bajo la referencia del equipo. Rojo: cuesta más que el equipo, es pérdida. Repetitividad = parte de los casos que siguen el mismo patrón, medida en el historial de Jira y Linear.")} /></small></h3>
          <div className="wt"><table>
            <thead><tr><th>{t("Atividade", "Activity", "Actividad")}</th><th>{t("Repetitiva", "Repetitive", "Repetitiva")}</th><th className="r">{t("Volume", "Volume", "Volumen")}</th><th>{t("Hoje com", "Today with", "Hoy con")}</th><th className="r">{t("Custo/res.", "Cost/res.", "Costo/res.")}</th><th className="r">{t("Equipe/res.", "Team/res.", "Equipo/res.")}</th><th className="r">{t("Qualidade", "Quality", "Calidad")}</th><th className="r">{t("h liberadas", "h freed", "h liberadas")}</th><th>{t("Faixa", "Band", "Franja")}</th><th>{t("Lugar certo?", "Right place?", "¿Lugar correcto?")}</th></tr></thead>
            <tbody>{AT.map((x) => { const a = x[3] ? AG[x[3]] : null, fx = a ? faixa(a) : "cinza";
              const certo = a ? (fx === "vermelho" ? <b style={{ color: "#c8492b" }}>{t("Devolver para a equipe", "Return to the team", "Devolver al equipo")}</b> : t("Sim", "Yes", "Sí")) : (x[4] ? t("Sim, exige julgamento", "Yes, needs judgment", "Sí, exige criterio") : <b>{t("Levar para agente", "Move to an agent", "Llevar a un agente")}</b>);
              return (<tr key={x[0][0]}><td>{t(...x[0])}</td><td><span className="rep"><i style={{ width: x[1] + "%" }} /></span>{x[1]}%</td><td className="r">{F.n(x[2])}</td><td>{a ? <Link href={`/agentes/${a.id}/ficha`}>{`${t("Agente", "Agent", "Agente")} · ${a.nome}`}</Link> : t("Equipe", "Team", "Equipo")}</td><td className="r">{a ? F.brl(a.custoPorResultado) : "—"}</td><td className="r">{F.brl(a ? a.custoHumanoUnit : x[5]!)}</td><td className="r">{a ? `${a.qualidade} vs ${a.baseline}` : "—"}</td><td className="r">{a ? F.n(horasDe(a)) : "—"}</td><td><span className={"faixa " + fx}>{FX[fx]}</span></td><td>{certo}</td></tr>); })}</tbody>
          </table></div>
        </section>
        <div className="g2">
          <section className="panel rise" style={{ ["--i" as string]: 5 }}>
            <h3>{t("Custo vs equipe, mês a mês", "Cost vs team, month by month", "Costo vs equipo, mes a mes")} <small>{t("meta 40% ± 10 p.p.", "target 40% ± 10 points", "meta 40% ± 10 puntos")} <Tip text={t("Custo do agente por resultado validado dividido pelo custo da equipe por resultado (referência da equipe). A faixa cinza é a tolerância em torno da meta.", "Agent cost per validated result divided by team cost per result (team benchmark). The grey band is the tolerance around the target.", "Costo del agente por resultado validado dividido por el costo del equipo por resultado (referência da equipe). La franja gris es la tolerancia alrededor de la meta.")} /></small></h3>
            <div className="trend">
              <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t("Custo do agente como % da equipe", "Agent cost as % of team", "Costo del agente como % del equipo")}>
                <rect x="40" y={y(50)} width={w - 60} height={y(30) - y(50)} fill="var(--band, #efeff2)" />
                <line x1="40" x2={w - 20} y1={y(40)} y2={y(40)} stroke="#9a9aa0" strokeDasharray="4 4" />
                {[20, 30, 40, 50, 60].map((v) => <text key={v} x="32" y={y(v) + 4} textAnchor="end" fontSize="11" fill="#8a8a8f" fontFamily="IBM Plex Mono">{v}%</text>)}
                <polyline fill="none" stroke="currentColor" strokeWidth="2.2" points={pts.map((v, i) => `${80 + i * 115},${y(v)}`).join(" ")} />
                {pts.map((v, i) => <g key={i}><circle cx={80 + i * 115} cy={y(v)} r="5" fill="currentColor" /><text x={80 + i * 115} y={y(v) - 12} textAnchor="middle" fontSize="13" fontWeight="600" fontFamily="Geist" fill="currentColor">{F.n(v)}%</text><text x={80 + i * 115} y={h - 4} textAnchor="middle" fontSize="11" fill="#8a8a8f" fontFamily="IBM Plex Mono">{t(...MES[S[i].mes])}</text></g>)}
              </svg>
            </div>
          </section>
          <section className="panel rise" style={{ ["--i" as string]: 6 }}>
            <h3>{t("Ações de melhoria", "Improvement actions", "Acciones de mejora")} <small>{t("por impacto/mês", "by impact/month", "por impacto/mes")}</small></h3>
            <ol className="rk">{AC.map((a, i) => <li key={i}><b className="n">0{i + 1}</b><span><b>{a[0]}</b> <Tip text={a[3]} /><br /><span style={{ color: "var(--mut)", fontSize: 13 }}>{a[1]}</span></span><span className="imp">{F.brl0(a[2])}</span><button className="btn sm soft" data-toast={proposed}>{t("Propor", "Propose", "Proponer")}</button></li>)}</ol>
          </section>
        </div>
        <Disc />
      </main>
    </MusterShell>
  );
}
