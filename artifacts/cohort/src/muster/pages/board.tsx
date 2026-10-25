import { useState } from "react";
import { MusterShell } from "../shell";
import { Disc, TipLine, useT } from "../fmt";

type T3 = [string, string, string];
type Card = { id: string; src: "Jira" | "Linear" | "GitHub"; tit: T3; ags: string[]; pes?: [string, string]; custo: string; ev: number; warn?: T3 };
const COLS: [string, T3, Card[]][] = [
  ["fazer", ["A fazer", "To do", "Por hacer"], [
    { id: "PLAT-81", src: "Linear", tit: ["Senha do proxy expira em 3 dias", "Proxy password expires in 3 days", "La contraseña del proxy vence en 3 días"], ags: ["Helena"], pes: ["RC", "Rafael Carvalho"], custo: "—", ev: 0 },
    { id: "FIN-485", src: "Jira", tit: ["Emitir NF-e de devolução PED-55210", "Issue return NF-e PED-55210", "Emitir NF-e de devolución PED-55210"], ags: ["Agente Fiscal", "Cobrança"], pes: ["CM", "Carla Mendes"], custo: "—", ev: 0 },
  ]],
  ["andamento", ["Em andamento", "In progress", "En curso"], [
    { id: "FIN-479", src: "Jira", tit: ["Conciliar boletos vencidos de setembro", "Reconcile overdue September slips", "Conciliar boletos vencidos de septiembre"], ags: ["Cobrança"], pes: ["JN", "Júlia Neves"], custo: "R$ 1,12", ev: 2 },
    { id: "PLAT-77", src: "Linear", tit: ["Migrar fila de e-mails para o worker novo", "Move the email queue to the new worker", "Migrar la cola de e-mails al worker nuevo"], ags: ["Forja"], pes: ["RC", "Rafael Carvalho"], custo: "R$ 6,30", ev: 1 },
    { id: "#1290", src: "GitHub", tit: ["PR: cache de consulta de CEP", "PR: ZIP lookup cache", "PR: caché de consulta de CEP"], ags: ["Forja"], custo: "R$ 2,20", ev: 2 },
  ]],
  ["precisa", ["Precisa de humano", "Needs a person", "Necesita a una persona"], [
    { id: "FIN-482", src: "Jira", tit: ["Rejeição SEFAZ em lote · CFOP 6102", "SEFAZ batch rejection · CFOP 6102", "Rechazo SEFAZ en lote · CFOP 6102"], ags: ["Agente Fiscal"], pes: ["AP", "Ana Prado"], custo: "R$ 3,84", ev: 3, warn: ["aprovação do aprovador", "approver sign-off", "aprobación del aprobador"] },
    { id: "FIN-470", src: "Jira", tit: ["Triagem de 120 notas recebidas", "Triage of 120 received invoices", "Triaje de 120 facturas recibidas"], ags: ["Triagem-NF"], pes: ["PS", "Paulo Siqueira"], custo: "R$ 11,32", ev: 0, warn: ["sem registro: evidência ausente", "no record: evidence missing", "sin registro: evidencia ausente"] },
  ]],
  ["validacao", ["Em validação", "In validation", "En validación"], [
    { id: "CAD-219", src: "Linear", tit: ["Validar 38 cadastros com CNPJ baixado", "Validate 38 records with closed CNPJ", "Validar 38 registros con CNPJ dado de baja"], ags: ["Cadastro"], pes: ["PS", "Paulo Siqueira"], custo: "R$ 0,42", ev: 4 },
    { id: "#1284", src: "GitHub", tit: ["PR: corrige timezone do relatório de SLA", "PR: fix SLA report timezone", "PR: corrige zona horaria del informe de SLA"], ags: ["Forja"], pes: ["RC", "Rafael Carvalho"], custo: "R$ 4,10", ev: 5 },
  ]],
  ["feito", ["Validado", "Validated", "Validado"], [
    { id: "OPS-903", src: "Jira", tit: ["Reotimizar rotas da zona sul após bloqueio", "Re-optimize south-zone routes after a closure", "Reoptimizar rutas de la zona sur tras un bloqueo"], ags: ["Atlas"], pes: ["DR", "Diego Ramos"], custo: "R$ 0,88", ev: 6 },
    { id: "PV-1180", src: "Jira", tit: ["Responder reclamações sobre atraso (lote 12)", "Answer delay complaints (batch 12)", "Responder reclamos por retraso (lote 12)"], ags: ["Sofia"], pes: ["MD", "Marina Duarte"], custo: "R$ 2,95", ev: 4 },
  ]],
];
const ALL = COLS.flatMap((c) => c[2]);

export default function BoardPage() {
  const t = useT();
  const [s, setS] = useState<"todas" | Card["src"]>("todas");
  const n = (x: string) => ALL.filter((c) => x === "todas" || c.src === x).length;
  const vis = COLS.map(([k, l, cs]) => [k, l, cs.filter((c) => s === "todas" || c.src === s)] as const);
  const waiting = vis.find((c) => c[0] === "precisa")![2].length;
  return (
    <MusterShell active="board">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}>Board <span className="mono">· Lumen Logística S.A.</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}>
          <h1>{n(s)} {t("cartões com agentes.", "cards with agents.", "tarjetas con agentes.")} <em>{waiting} {t("esperando uma pessoa.", "waiting for a person.", "esperando a una persona.")}</em></h1>
          <div className="covline">Jira (MCP) · Linear (MCP) · GitHub (plugin) · {t("sincronizado há 2 min", "synced 2 min ago", "sincronizado hace 2 min")}</div>
        </div>
        <div className="flt2 rise" style={{ ["--i" as string]: 2 }}>
          {(["todas", "Jira", "Linear", "GitHub"] as const).map((x) => (
            <button key={x} className="chip" aria-pressed={s === x} onClick={() => setS(x)}>{x === "todas" ? t("Todas as fontes", "All sources", "Todas las fuentes") : x} <b>{n(x)}</b></button>
          ))}
        </div>
        <div className="bd rise" style={{ ["--i" as string]: 3 }}>
          {vis.map(([k, l, cs]) => (
            <section key={k} className={"bcol " + k}>
              <h3>{t(...l)} <small>{cs.length}</small></h3>
              {cs.map((c) => (
                <article key={c.id} className="bcard">
                  <div className="t1"><span>{c.id}</span><span className="src">{c.src}</span></div>
                  <h4>{t(...c.tit)}</h4>
                  <div className="who">{c.ags.map((a) => <span key={a} className="ag"><i>{a[0]}</i>{a}</span>)}{c.pes && <span><i>{c.pes[0]}</i>{c.pes[1]}</span>}</div>
                  {c.warn && <div className="warn">⚠ {t(...c.warn)}</div>}
                  <div className="t2"><span>{t("agente", "agent", "agente")} <b>{c.custo}</b></span><span>{c.ev ? <><b>{c.ev}</b> {t("evidências", "evidence", "evidencias")}</> : t("sem evidência", "no evidence", "sin evidencia")}</span></div>
                </article>
              ))}
            </section>
          ))}
        </div>
        <TipLine label={t("De onde vêm os cartões", "Where the cards come from", "De dónde vienen las tarjetas")} text={t("Os cartões são as issues e PRs dos seus boards no Jira, Linear e GitHub, lidos em modo somente leitura pelos servidores MCP oficiais ou por plugin. O Muster acrescenta a cada cartão quem trabalhou (pessoa e agente), o custo do agente e as evidências na trilha. A coluna “Precisa de humano” reúne o que está parado esperando uma pessoa.", "Cards are the issues and PRs on your Jira, Linear and GitHub boards, read-only through the official MCP servers or a plugin. Muster adds who worked on each (person and agent), the agent's cost and the evidence in the trail. “Needs a person” gathers what is stuck waiting for someone.", "Las tarjetas son las issues y PRs de sus boards en Jira, Linear y GitHub, leídas en modo solo lectura por los servidores MCP oficiales o por plugin. Muster agrega a cada tarjeta quién trabajó (persona y agente), el costo del agente y las evidencias en la pista. La columna “Necesita a una persona” reúne lo que está detenido esperando a alguien.")} />
        <Disc />
      </main>
    </MusterShell>
  );
}
