import { Link } from "wouter";
import { MusterShell } from "../shell";
import { AG, Badge, DEMO, Disc, F, MES, STATUS, Spark, Tip, TipLine, useT } from "../fmt";

export default function VisaoGeralPage() {
  const t = useT();
  const S = DEMO.snaps, s = S[2], p = S[1], A = DEMO.agentes, cov = DEMO.cov, ok = cov >= 80;
  const ord: Record<string, number> = { "crítico": 0, "atenção": 1, ok: 2 };
  const worst = A.slice().sort((x, y) => (ord[x.status] - ord[y.status]) || ((y.custoPorResultado / y.custoHumanoUnit) - (x.custoPorResultado / x.custoHumanoUnit)));
  const w0 = worst[0];
  const mes = t("setembro", "September", "septiembre");
  const vsAgo = t("vs ago", "vs Aug", "vs ago");
  const dl = (a: number, b: number, inv = false) => { const d = (a - b) / b * 100, good = inv ? d < 0 : d > 0; return <span className={"d " + (good ? "up" : "dn")}>{(d > 0 ? "+" : "−") + F.n(Math.abs(d), 0)}% {vsAgo}</span>; };
  const sp = (k: "custo" | "validadas" | "cpr" | "atrito") => <Spark vals={S.map((x) => x[k])} />;
  const entregas = A.reduce((n, a) => n + a.entregas, 0);
  const K = [
    [t("Custo do mês", "Monthly cost", "Costo del mes"), F.brl0(s.custo), dl(s.custo, p.custo, true), sp("custo"), `Agente Fiscal = ${F.pct(6890 / s.custo * 100)} ${t("do custo.", "of cost.", "del costo.")}`],
    [t("Resultados validados", "Validated results", "Resultados validados"), F.n(s.validadas), dl(s.validadas, p.validadas), sp("validadas"), `${F.pct(s.validadas / entregas * 100)} ${t("das entregas aceitas.", "of deliveries accepted.", "de las entregas aceptadas.")}`],
    [t("Custo por resultado validado", "Cost per validated result", "Costo por resultado validado"), F.brl(s.cpr), dl(s.cpr, p.cpr, true), sp("cpr"), `${t("Humano", "Human", "Humano")}: ${F.brl(s.humano)} ${t("por resultado.", "per result.", "por resultado.")}`],
    [t("Atrito e incidentes", "Friction and incidents", "Fricción e incidentes"), <>{F.n(s.atrito)}<sub>{t("pedidos", "requests", "pedidos")}</sub> {s.incidentes}<sub>inc.</sub></>, dl(s.atrito + s.incidentes, p.atrito + p.incidentes, true), sp("atrito"), `${w0.nome}: ${F.pct(w0.atrito / s.atrito * 100)} ${t("dos pedidos a humanos.", "of requests to people.", "de los pedidos a personas.")}`],
  ] as const;
  const roi = (s.humano * s.validadas - s.custo) / s.custo * 100;
  const mx = Math.max(...S.map((x) => x.validadas));
  const pending = worst.filter((a) => a.status !== "ok").length;
  const actT = w0.status === "crítico"
    ? t(`Devolver o trabalho de ${w0.nome} para a equipe`, `Return ${w0.nome}'s work to the team`, `Devolver el trabajo de ${w0.nome} al equipo`)
    : t(`Corrigir ${w0.nome}`, `Fix ${w0.nome}`, `Corregir ${w0.nome}`);
  const econ = w0.custoMes - w0.validadas * w0.custoHumanoUnit > 0 ? w0.custoMes - w0.validadas * w0.custoHumanoUnit : w0.custoMes * 0.4;
  const noSave = t("Ação registrada (protótipo, nada foi gravado)", "Action logged (illustrative, nothing was saved)", "Acción registrada (ilustrativo, nada se guardó)");
  const tri = AG.triagem, fis = AG.fiscal, sof = AG.sofia, jp = DEMO.jornada;
  const dec = [
    { tipo: "Desligar", tag: t("Devolver para a equipe", "Return to the team", "Devolver al equipo"), ag: tri,
      h: t("Devolver a triagem de notas à equipe do Financeiro.", "Return invoice triage to the Finance team.", "Devolver la clasificación de facturas al equipo de Finanzas."),
      ev: `${F.n(tri.validadas)} / ${F.n(tri.entregas)} (${F.pct(tri.validadas / tri.entregas * 100)}) · ${t("qualidade", "quality", "calidad")} ${tri.qualidade} ${t("vs referência", "vs benchmark", "vs referencia")} ${tri.baseline} · ${F.brl(tri.custoPorResultado)} vs ${F.brl(tri.custoHumanoUnit)} ${t("de um humano", "for a person", "de una persona")} · ${t("economia de", "saves", "ahorro de")} ${F.brl0(DEMO.economiaDesligarTriagem)}/${t("mês", "month", "mes")}.`,
      ok: t("Devolver para a equipe", "Return to the team", "Devolver al equipo") },
    { tipo: "Corrigir", tag: t("Corrigir", "Fix", "Corregir"), ag: fis,
      h: t(`Aprovar o plano de correção do ${fis.nome} no repasse para a Cobrança.`, `Approve the fix plan for ${fis.nome} at the hand-off to Collections.`, `Aprobar el plan de corrección de ${fis.nome} en el traspaso a Cobranza.`),
      ev: `${t("Qualidade", "Quality", "Calidad")} ${fis.qualidade} ${t("vs referência", "vs benchmark", "vs referencia")} ${fis.baseline} · ${fis.resgatePct}% ${t("resgatadas por humanos", "rescued by people", "rescatadas por personas")} · ${jp.perdaFiscal} / ${jp.perdaTotal} (${jp.perdaFiscalPct}%).`,
      ok: t("Aprovar plano", "Approve plan", "Aprobar plan") },
    { tipo: "Ampliar", tag: t("Ampliar", "Expand", "Ampliar"), ag: sof,
      h: t(`Ampliar o escopo da ${sof.nome} para mais tipos de atendimento de baixo risco.`, `Expand ${sof.nome}'s scope to more low-risk support types.`, `Ampliar el alcance de ${sof.nome} a más tipos de atención de bajo riesgo.`),
      ev: `${F.n(sof.validadas)} ${t("resultados validados", "validated results", "resultados validados")} · ${t("qualidade", "quality", "calidad")} ${sof.qualidade} ${t("vs referência", "vs benchmark", "vs referencia")} ${sof.baseline} · ${F.brl(sof.custoPorResultado)} vs ${F.brl(sof.custoHumanoUnit)} · ${t("resgate humano em", "human rescue in", "rescate humano en")} ${sof.resgatePct}%.`,
      ok: t("Ampliar escopo", "Expand scope", "Ampliar alcance") },
  ];

  return (
    <MusterShell active="visao">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}>{t("Visão geral", "Overview", "Visión general")} <span className="mono">· {DEMO.empresa} · {t(DEMO.periodo, "September 2026", "septiembre de 2026")}</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}>
          <h1>{A.length} {t("agentes em", "agents in", "agentes en")} {mes}. <em>{pending} {t("pedem ação.", "need action.", "piden acción.")}</em></h1>
          <div className="covline">{t("Cobertura da referência", "Benchmark coverage", "Cobertura da referência")} <b>{F.n(cov, 1)}%</b> <Badge f={ok ? "medido" : "declarado"} /> <Link href="/baseline">{t("referência da equipe →", "team benchmark →", "referência da equipe →")}</Link></div>
        </div>
        <div className="flt2 rise" style={{ ["--i" as string]: 2 }}>
          <select aria-label={t("Recorte", "Scope", "Recorte")}><option>{t("Empresa inteira", "Whole company", "Empresa completa")}</option><option>{t("Área", "Area", "Área")}: Financeiro</option><option>Squad: Faturamento</option><option>{t("Dono", "Accountable", "Dueño")}: Carla Mendes</option><option>{t("Meus agentes", "My agents", "Mis agentes")}</option></select>
          <select aria-label={t("Projeto", "Project", "Proyecto")}><option>{t("Todos os projetos", "All projects", "Todos los proyectos")}</option>{DEMO.projetos.map((x) => <option key={x}>{x}</option>)}</select>
          <span className="lgpd">{t("Pessoas: por equipe", "People: by team", "Personas: por equipo")}</span>
        </div>
        <div className="kpis">
          {K.map((k, i) => <div className="kpi rise" key={i} style={{ ["--i" as string]: 3 + i * 0.3 }}><small>{k[0]}</small><span className="v">{k[1]}</span>{k[2]}{k[3]}<p>{k[4]}</p></div>)}
        </div>
        <Link className={"roi rise" + (ok ? "" : " est")} style={{ ["--i" as string]: 4 }} href="/baseline">
          <div><small className="mono" style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7 }}>{t("ROI vs humano", "ROI vs human", "ROI vs humano")}</small><div className="v">{ok ? "" : "≈ "}{F.n(roi, 0)}%</div></div>
          <span>{ok ? `${t("Economia de", "Savings of", "Ahorro de")} ${F.brl0(s.humano * s.validadas - s.custo)} ${t("no mês.", "this month.", "en el mes.")}` : t("Estimativa: referência medida abaixo de 80%.", "Estimate: measured benchmark below 80%.", "Estimación: referência medida por debajo de 80%.")}</span>
          <Badge f={ok ? "medido" : "declarado"} />
        </Link>
        <div className="g2">
          <section className="panel rise" style={{ ["--i" as string]: 5 }}>
            <h3>{t("Trimestre, mês a mês", "Quarter, month by month", "Trimestre, mes a mes")} <small><Link href="/historico">{t("detalhar →", "details →", "detallar →")}</Link></small></h3>
            <div className="bars">
              {S.map((x) => <div key={x.mes} className={"b" + (x.parcial ? " parc" : "")}><b>{F.n(x.validadas)}</b><i style={{ height: Math.round(x.validadas / mx * 110) }} /><span>{t(...MES[x.mes])}{x.parcial ? " · " + t("parcial", "partial", "parcial") : ""}</span><span>{F.brl(x.cpr)}/res.</span></div>)}
            </div>
            <TipLine label={t("Barra hachurada = mês parcial", "Hatched bar = partial month", "Barra rayada = mes parcial")} text={t("Mês com menos de 80% dos resultados com referência medida. O snapshot é imutável e mostra o que se sabia no fechamento.", "Month with under 80% of results on a measured benchmark. The snapshot is immutable and shows what was known at close.", "Mes con menos de 80% de resultados con referencia medida. El snapshot es inmutable y muestra lo que se sabía al cierre.")} />
          </section>
          <section className="panel rise" style={{ ["--i" as string]: 6 }}>
            <h3>{t("Agentes, pior primeiro", "Agents, worst first", "Agentes, peor primero")} <small>{A.length} {t("agentes", "agents", "agentes")}</small></h3>
            <div className="wt"><table>
              <thead><tr><th>{t("Agente", "Agent", "Agente")}</th><th>{t("Dono", "Accountable", "Dueño")}</th><th>Status</th><th className="r">{t("Custo/res.", "Cost/res.", "Costo/res.")}</th><th className="r">{t("vs humano", "vs human", "vs humano")}</th><th className="r">{t("Volume", "Volume", "Volumen")}</th><th className="r">{t("Atrito", "Friction", "Fricción")}</th><th>{t("Referência", "Benchmark", "Referencia")}</th></tr></thead>
              <tbody>{worst.map((a) => { const r = a.custoPorResultado / a.custoHumanoUnit, med = a.bl.fonte === "medido"; return (
                <tr key={a.id}><td><a href="#" onClick={(e) => e.preventDefault()}>{a.nome}</a></td><td>{a.dono}</td><td><span className={"st " + a.status}>{t(...STATUS[a.status])}</span></td><td className="r">{F.brl(a.custoPorResultado)}</td><td className={"r" + (med ? "" : " grey")}>{med ? "" : "≈ "}{F.pct(r * 100)}</td><td className="r">{F.n(a.validadas)}</td><td className="r">{a.atrito}</td><td><Badge f={a.bl.fonte} /></td></tr>); })}</tbody>
            </table></div>
          </section>
        </div>
        <div className="act1 rise" style={{ ["--i" as string]: 7 }}>
          <span className="k">{t("Ação sugerida", "Suggested action", "Acción sugerida")}</span>
          <h3>{actT}. {t("Economia de", "Saves", "Ahorro de")} {F.brl0(econ)}/{t("mês", "month", "mes")}.</h3>
          <div className="row"><button className="btn" data-toast={noSave}>{t("Aprovar", "Approve", "Aprobar")}</button><button className="btn soft" data-toast={noSave}>{t("Por quê?", "Why?", "¿Por qué?")}</button></div>
        </div>
        <section className="sec">
          <div className="sec-h">
            <span className="step">{t("Ação · 02", "Action · 02", "Acción · 02")}</span>
            <h2>{t("Três decisões esperam por uma pessoa.", "Three decisions are waiting for a person.", "Tres decisiones esperan a una persona.")} <Tip text={t("O Muster recomenda com base em dados. Quem responde pelo agente decide.", "Muster recommends with evidence. The person accountable for the agent decides.", "Muster recomienda con base en datos. Quien responde por el agente decide.")} /></h2>
          </div>
          <div className="dq">
            {dec.map((d, i) => (
              <article className="dec rise" key={d.tipo} style={{ ["--i" as string]: i + 1 }}>
                <span className="ix mono">0{i + 1}</span>
                <div className="body">
                  <div className="kick"><span className={"tag v-" + d.tipo}><i />{d.tag}</span><span>{t("Para", "For", "Para")} {d.ag.dono} · {t("até 30/10", "by 10/30", "hasta 30/10")}</span></div>
                  <h3>{d.h} <Tip text={d.ev} /></h3>
                </div>
                <div className="act">
                  <div className="row"><button className="btn" data-toast={noSave}>{d.ok}</button><button className="btn soft" data-toast={noSave}>{t("Ajustar", "Adjust", "Ajustar")}</button></div>
                  <div className="row"><button className="btn ghost sm" data-toast={noSave}>{t("Por quê?", "Why?", "¿Por qué?")}</button><button className="btn ghost sm" data-toast={noSave}>{t("Rejeitar", "Reject", "Rechazar")}</button></div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <Disc />
      </main>
    </MusterShell>
  );
}
