import { useState } from "react";
import { MusterShell } from "../shell";
import { Badge, DEMO, Disc, F, TipLine, useT } from "../fmt";
const ROLE: Record<string, [string, string]> = {
  "Analista de atendimento": ["Customer service analyst", "Analista de atención"],
  "Analista de roteirização": ["Routing analyst", "Analista de ruteo"],
  "Analista fiscal": ["Tax analyst", "Analista fiscal"],
  "Analista de cobrança": ["Collections analyst", "Analista de cobranzas"],
  "Assistente de cadastro": ["Records assistant", "Asistente de registros"],
  "Assistente de contas a pagar": ["Accounts payable assistant", "Asistente de cuentas por pagar"],
  "Analista de service desk": ["Service desk analyst", "Analista de service desk"],
  "Dev pleno": ["Mid-level developer", "Desarrollador semi-senior"],
};
const per = (s: string, t: (pt: string, en: string, es: string) => string) => t(s, ROLE[s]?.[0] ?? s, ROLE[s]?.[1] ?? s).replace("histórico", t("histórico", "history", "historial")).replace("jan–jun", t("jan–jun", "Jan–Jun", "ene–jun"));

export default function BaselinePage() {
  const t = useT();
  const A = DEMO.agentes, cov = DEMO.cov, ok = cov >= 80;
  const nm = A.filter((a) => a.bl.fonte === "medido").length;
  const [id, setId] = useState(A[0].id);
  const a = A.find((x) => x.id === id)!, b = a.bl;
  const [f, setF] = useState({ papel: b.papel, horas: b.horas, fator: Math.round(b.fator * 100), custoHora: b.custoHora, n: b.n, fonte: b.fonte, origem: b.origem });
  const pick = (v: string) => { const x = A.find((y) => y.id === v)!.bl; setId(v); setF({ papel: x.papel, horas: x.horas, fator: Math.round(x.fator * 100), custoHora: x.custoHora, n: x.n, fonte: x.fonte, origem: x.origem }); };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === "number" ? +e.target.value : e.target.value });
  const h = f.horas * f.fator / 100, c = h * f.custoHora, n = f.n || 1;
  const declarados = A.filter((x) => x.bl.fonte !== "medido").map((x) => x.nome).join(", ");
  const destaque = t("ROI em destaque", "ROI highlighted", "ROI destacado");
  return (
    <MusterShell active="ajustes">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}>{t("Baseline humano", "Human baseline", "Baseline humano")} <span className="mono">· {DEMO.empresa}</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}><h1>{nm} {t("de", "of", "de")} {A.length} {t("baselines medidos.", "baselines measured.", "baselines medidos.")} <em>{ok ? destaque + "." : t("ROI ainda é estimativa.", "ROI is still an estimate.", "El ROI aún es estimación.")}</em></h1></div>
        <section className="panel rise" style={{ ["--i" as string]: 2, marginTop: 24 }}>
          <h3>{t("Cobertura de baseline", "Baseline coverage", "Cobertura de baseline")} <small>{t("meta: 80% dos resultados com baseline medido", "target: 80% of results on a measured baseline", "meta: 80% de resultados con baseline medido")}</small></h3>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}><span className="kpi" style={{ boxShadow: "none", padding: 0 }}><span className="v">{F.n(cov, 1)}%</span></span><span style={{ color: "var(--mut)", fontSize: 14 }}>{ok ? t("acima da meta", "above target", "sobre la meta") : `${t("faltam", "missing", "faltan")} ${F.n(80 - cov, 1)} pp · ${declarados}`}</span></div>
          <div className="covbar"><i style={{ width: cov + "%" }} /><u title="80%" /></div>
          <div style={{ display: "flex", justifyContent: "space-between", font: "400 11px var(--app-font-mono)", color: "var(--mut)" }}><span>0%</span><span style={{ marginLeft: "auto", marginRight: "18%" }}>80% · {destaque}</span><span>100%</span></div>
        </section>
        <section className="panel rise" style={{ ["--i" as string]: 3, marginTop: 14 }}>
          <h3>{t("Cadastrar ou revisar baseline", "Add or review a baseline", "Registrar o revisar baseline")} <small><Badge f={b.fonte} /> {b.versao} · {t("congelado em", "frozen on", "congelado el")} {b.congelado}</small></h3>
          <div className="blform">
            <label>{t("Agente", "Agent", "Agente")}<select value={id} onChange={(e) => pick(e.target.value)}>{A.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
            <label>{t("Papel humano equivalente", "Equivalent human role", "Rol humano equivalente")}<input value={f.papel} onChange={set("papel")} /></label>
            <label>{t("Horas no mês", "Hours per month", "Horas al mes")}<input type="number" value={f.horas} onChange={set("horas")} /></label>
            <label>{t("% produtivo", "% productive", "% productivo")}<input type="number" value={f.fator} onChange={set("fator")} /></label>
            <label>{t("Custo por hora (R$, com encargos)", "Cost per hour (R$, with charges)", "Costo por hora (R$, con cargas)")}<input type="number" value={f.custoHora} onChange={set("custoHora")} /></label>
            <label>{t("Resultados por mês (N)", "Results per month (N)", "Resultados por mes (N)")}<input type="number" value={f.n} onChange={set("n")} /></label>
            <label>{t("Fonte", "Source", "Fuente")}<select value={f.fonte} onChange={set("fonte")}><option value="declarado">{t("Declarado", "Declared", "Declarado")}</option><option value="medido">{t("Medido (histórico importado)", "Measured (imported history)", "Medido (historial importado)")}</option></select></label>
            <label>{t("Origem", "Origin", "Origen")}<input value={f.origem} onChange={set("origem")} /></label>
          </div>
          <div className="blout">
            <span><b>{F.n(h, 1)} h</b>{t("horas produtivas", "productive hours", "horas productivas")}</span>
            <span><b>{F.brl0(c)}</b>{t("custo humano/mês", "human cost/month", "costo humano/mes")}</span>
            <span><b>{F.brl(c / n)}</b>{t("por resultado", "per result", "por resultado")}</span>
            <span><b>{F.n(n / h, 1)}</b>{t("resultados/hora", "results/hour", "resultados/hora")}</span>
          </div>
          <TipLine label={t("Por que horas produtivas e não 168 h", "Why productive hours and not 168 h", "Por qué horas productivas y no 168 h")} text={t("168 h é a carga bruta. Férias, reuniões e pausas tiram cerca de 30%. Usar 168 h inflaria o ROI do agente. O padrão é 70%, editável. Baseline declarado fica congelado com data e vira medido quando o conector importa o histórico de antes do agente (Jira, Linear, Zendesk) ou após 30 dias de operação em paralelo.", "168 h is the gross load. Vacations, meetings and breaks take about 30%. Using 168 h would inflate the agent's ROI. The default is 70%, editable. A declared baseline is frozen with a date and becomes measured when a connector imports pre-agent history (Jira, Linear, Zendesk) or after 30 days running in parallel.", "168 h es la carga bruta. Vacaciones, reuniones y pausas quitan cerca de 30%. Usar 168 h inflaría el ROI del agente. El estándar es 70%, editable. El baseline declarado queda congelado con fecha y pasa a medido cuando el conector importa el historial previo al agente (Jira, Linear, Zendesk) o tras 30 días de operación en paralelo.")} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" data-toast={t("Baseline salvo como nova versão (protótipo)", "Baseline saved as a new version (illustrative)", "Baseline guardado como nueva versión (ilustrativo)")}>{t("Salvar nova versão", "Save new version", "Guardar nueva versión")}</button>
            <button className="btn soft" data-toast={t("Importação abre em Conectores.", "Import opens in Connectors.", "La importación abre en Conectores.")}>{t("Importar histórico (Jira/Linear)", "Import history (Jira/Linear)", "Importar historial (Jira/Linear)")}</button>
          </div>
        </section>
        <section className="panel rise" style={{ ["--i" as string]: 4, marginTop: 14 }}>
          <h3>{t("Todos os baselines", "All baselines", "Todos los baselines")} <small>{t("congelados e versionados", "frozen and versioned", "congelados y versionados")}</small></h3>
          <div className="wt"><table>
            <thead><tr><th>{t("Agente", "Agent", "Agente")}</th><th>{t("Papel", "Role", "Rol")}</th><th className="r">{t("h prod.", "prod. h", "h prod.")}</th><th className="r">R$/h</th><th className="r">N/{t("mês", "mo", "mes")}</th><th className="r">{t("R$/res. humano", "R$/res. human", "R$/res. humano")}</th><th>{t("Fonte", "Source", "Fuente")}</th><th>{t("Origem", "Origin", "Origen")}</th></tr></thead>
            <tbody>{A.map((x) => <tr key={x.id}><td>{x.nome}</td><td>{per(x.bl.papel, t)}</td><td className="r">{F.n(x.bl.horasProd, 1)}</td><td className="r">{F.n(x.bl.custoHora)}</td><td className="r">{F.n(x.bl.n)}</td><td className="r">{F.brl(x.custoHumanoUnit)}</td><td><Badge f={x.bl.fonte} /></td><td style={{ color: "var(--mut)", fontSize: 13 }}>{per(x.bl.origem, t)}</td></tr>)}</tbody>
          </table></div>
        </section>
        <Disc />
      </main>
    </MusterShell>
  );
}
