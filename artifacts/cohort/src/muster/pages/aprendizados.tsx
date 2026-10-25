import { useState } from "react";
import { Link } from "wouter";
import { MusterShell } from "../shell";
import { Disc, Tip, useT } from "../fmt";

type T3 = [string, string, string];
type Row = [string, string, string, string, string];
const AGT: Row[] = [["Cadastro", "R$ 0,78", "93%", "0.1 h", "−11,6%"], ["Cobrança", "R$ 1,83", "91%", "0.9 h", "−9,3%"], ["Helena", "R$ 2,06", "88%", "0.7 h", "−9,2%"], ["Atlas", "R$ 2,38", "93%", "0.2 h", "−11,6%"], ["Sofia", "R$ 3,10", "94%", "0.4 h", "−9,3%"], ["Agente Fiscal", "R$ 4,88", "72%", "1.6 h", "−13,9%"], ["Forja", "R$ 8,10", "83%", "9.5 h", "−11,6%"], ["Triagem-NF", "R$ 11,32", "58%", "3.8 h", "−13,8%"]];
const JOR: [T3, string, string, string, string][] = [[["Atendimento → Resolução", "Support → Resolution", "Atención → Resolución"], "R$ 4,10", "88%", "0,8 h", "−9,0%"], [["Pedido → Faturamento", "Order → Billing", "Pedido → Facturación"], "R$ 9,84", "71%", "4,2 h", "−14,0%"], [["Nota recebida → Pagamento", "Invoice received → Payment", "Factura recibida → Pago"], "R$ 12,70", "58%", "2,1 d", "−3,0%"]];
const SQD: [T3, string, string, string, string][] = [[["Last mile", "Last mile", "Last mile"], "R$ 31,40", "93%", "0,9 d", "−38,8%"], [["Pós-venda", "After-sales", "Posventa"], "R$ 41,70", "91%", "0,8 d", "−30,9%"], [["Faturamento", "Billing", "Facturación"], "R$ 50,54", "89%", "2,1 d", "−38,1%"], [["Plataforma", "Platform", "Plataforma"], "R$ 452,99", "83%", "5,1 d", "−18,6%"]];
type L = { ag: string; inc: T3; cau: T3; mud: T3; efe: T3; href: string };
const LC: L[] = [
  { ag: "Agente Fiscal", inc: ["NF-e rejeitadas no lote CFOP 6102", "NF-e rejected in batch CFOP 6102", "NF-e rechazadas en el lote CFOP 6102"], cau: ["Tabela de alíquota desatualizada na instrução", "Outdated tax-rate table in the instruction", "Tabla de alícuotas desactualizada en la instrucción"], mud: ["Instrução passa a consultar a tabela vigente", "Instruction now checks the current table", "La instrucción consulta la tabla vigente"], efe: ["Rejeição caiu de 9,1% para 3,4%", "Rejection fell from 9.1% to 3.4%", "El rechazo bajó de 9,1% a 3,4%"], href: "" },
  { ag: "Forja", inc: ["PRs reabertos por falta de teste", "PRs reopened for missing tests", "PRs reabiertos por falta de pruebas"], cau: ["Instrução não pedia testes", "Instruction did not ask for tests", "La instrucción no pedía pruebas"], mud: ["Checklist de testes antes de abrir o PR", "Test checklist before opening the PR", "Checklist de pruebas antes de abrir el PR"], efe: ["Resgate caiu de 26% para 17%", "Rescue fell from 26% to 17%", "El rescate bajó de 26% a 17%"], href: "/board" },
  { ag: "Sofia", inc: ["Transferências desnecessárias para a equipe", "Unneeded handoffs to the team", "Transferencias innecesarias al equipo"], cau: ["Regra de transferência ampla demais", "Handoff rule too broad", "Regla de transferencia demasiado amplia"], mud: ["Ponto de aprovação só para reembolso acima de R$ 500", "Approval step only for refunds above R$ 500", "Aprobación solo para reembolsos sobre R$ 500"], efe: ["Transferência caiu de 15% para 9%", "Handoffs fell from 15% to 9%", "La transferencia bajó de 15% a 9%"], href: "" },
  { ag: "Triagem-NF", inc: ["Notas sem registro auditável", "Invoices with no auditable record", "Facturas sin registro auditable"], cau: ["Plataforma não expõe o que o agente fez", "Platform does not expose what the agent did", "La plataforma no expone lo que hizo el agente"], mud: ["Atividade proposta para voltar à equipe", "Activity proposed to return to the team", "Actividad propuesta para volver al equipo"], efe: ["Em decisão · economia prevista R$ 2.419/mês", "Pending decision · expected saving R$ 2,419/mo", "En decisión · ahorro previsto R$ 2.419/mes"], href: "/direcionamento" },
];
const BP: [T3, string, string][] = [
  [["Ponto de aprovação humana em lote de risco", "Human approval step on risky batches", "Aprobación humana en lotes de riesgo"], "Agente Fiscal", "Cobrança, Triagem-NF"],
  [["Checklist de testes na instrução", "Test checklist in the instruction", "Checklist de pruebas en la instrucción"], "Forja", "Helena"],
  [["IA rápida para etapas simples", "Fast AI for simple steps", "IA rápida para etapas simples"], "Cadastro", "Helena, Sofia"],
];

export default function AprendizadosPage() {
  const t = useT();
  const [k, setK] = useState<"agentes" | "jornadas" | "squads">("agentes");
  const soon = t("Esta tela chega nas próximas entregas.", "This screen ships in a later delivery.", "Esta pantalla llega en las próximas entregas.");
  const cost = t("custo", "cost", "costo");
  const rows: [string, string, string, string, string, string][] =
    k === "agentes" ? AGT.map((r) => [r[0], ...r.slice(1, 4), r[4], ""] as never) : (k === "jornadas" ? JOR : SQD).map((r) => [t(...r[0]), r[1], r[2], r[3], r[4], k === "jornadas" ? "" : "/squads"] as never);
  const col = k === "agentes" ? t("Agente", "Agent", "Agente") : k === "jornadas" ? t("Processo", "Process", "Proceso") : "Squad";
  const lnk = (n: string, href: string) => href ? <Link href={href}>{n}</Link> : <a href="#" data-toast={soon} onClick={(e) => e.preventDefault()}>{n}</a>;
  const dias = (c: string) => c.endsWith(" d") ? c.replace(" d", " " + t("dias", "days", "días")) : c;
  return (
    <MusterShell active="aprendizados">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}>{t("Aprendizados", "Learnings", "Aprendizajes")} <span className="mono">· Lumen Logística S.A. · {t("3º trimestre/2026", "Q3/2026", "3.er trimestre/2026")}</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}>
          <h1>{t("Melhor custo: Cadastro.", "Best cost: Cadastro.", "Mejor costo: Cadastro.")} <em>{t("4 lições no trimestre.", "4 lessons this quarter.", "4 lecciones en el trimestre.")}</em></h1>
          <div className="covline">{t("Comparação interna · sem benchmark de mercado", "Internal comparison · no market benchmark", "Comparación interna · sin benchmark de mercado")} <Tip text={t("Os rankings comparam só agentes, processos e squads da própria conta, com a mesma regra de aceite. Não usamos dados de outras empresas.", "Rankings compare only this account's agents, processes and squads, under the same acceptance rule. We never use other companies' data.", "Los rankings comparan solo agentes, procesos y squads de la propia cuenta, con la misma regla de aceptación. No usamos datos de otras empresas.")} /></div>
        </div>
        <section className="panel rise" style={{ ["--i" as string]: 2, marginTop: 24 }}>
          <h3>{t("Ranking do trimestre", "Quarter ranking", "Ranking del trimestre")} <small>{t("jul → set", "Jul → Sep", "jul → sep")}</small></h3>
          <div className="tabs2">
            {([["agentes", t("Agentes", "Agents", "Agentes"), 8], ["jornadas", t("Processos", "Processes", "Procesos"), 3], ["squads", "Squads", 4]] as const).map(([key, l, n]) => (
              <button key={key} className="chip" aria-pressed={k === key} onClick={() => setK(key)}>{l} <b>{n}</b></button>
            ))}
          </div>
          <div className="wt"><table>
            <thead><tr><th>#</th><th>{col}</th><th className="r">{t("Custo/res. validado", "Cost/validated result", "Costo/res. validado")}</th><th className="r">{t("Aceitação", "Acceptance", "Aceptación")}</th><th className="r">{t("Ciclo", "Cycle", "Ciclo")}</th><th className="r">{t("Melhora no tri", "Quarter gain", "Mejora en el tri")}</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={r[0]}><td>{i + 1}</td><td>{lnk(r[0], r[5])}</td><td className="r">{r[1]}</td><td className="r">{r[2]}</td><td className="r">{dias(r[3])}</td><td className="r" style={{ color: "#0f7a5f" }}>{r[4]} {cost}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="sec rise" style={{ ["--i" as string]: 3, paddingTop: 40 }}>
          <div className="sec-h" style={{ marginBottom: 18 }}><h2>{t("Lições aprendidas", "Lessons learned", "Lecciones aprendidas")}</h2></div>
          <div className="lc">{LC.map((l) => (
            <article key={l.ag}>
              <h3 style={{ font: "600 16px var(--app-font-sans)" }}>{l.ag}</h3>
              <dl>
                <dt>{t("Incidente", "Incident", "Incidente")}</dt><dd>{t(...l.inc)}</dd>
                <dt>{t("Causa", "Cause", "Causa")}</dt><dd>{t(...l.cau)}</dd>
                <dt>{t("Mudança", "Change", "Cambio")}</dt><dd>{t(...l.mud)}</dd>
                <dt>{t("Efeito", "Effect", "Efecto")}</dt><dd><b>{t(...l.efe)}</b></dd>
              </dl>
              {l.href ? <Link className="subt" href={l.href}>{t("Ver evidência →", "View evidence →", "Ver evidencia →")}</Link> : <a className="subt" href="#" data-toast={soon} onClick={(e) => e.preventDefault()}>{t("Ver evidência →", "View evidence →", "Ver evidencia →")}</a>}
            </article>
          ))}</div>
        </section>
        <section className="sec rise" style={{ ["--i" as string]: 4, paddingTop: 40 }}>
          <div className="sec-h" style={{ marginBottom: 18 }}><h2>{t("Boas práticas", "Good practices", "Buenas prácticas")}</h2></div>
          <ol className="rk panel">{BP.map(([n, o, a], i) => (
            <li key={o}><b className="n">0{i + 1}</b><span><b>{t(...n)}</b><br /><span style={{ color: "var(--mut)", fontSize: 13 }}>{t("Origem", "Source", "Origen")}: {o} · {t("Aplicável em", "Applies to", "Aplicable en")}: {a}</span></span><span /><button className="btn sm" data-toast={t("Prática proposta: o dono do agente aprova antes de valer.", "Practice proposed: the agent owner approves it first.", "Práctica propuesta: el dueño del agente la aprueba antes.")}>{t("Aplicar em outro agente", "Apply to another agent", "Aplicar en otro agente")}</button></li>
          ))}</ol>
        </section>
        <Disc />
      </main>
    </MusterShell>
  );
}
