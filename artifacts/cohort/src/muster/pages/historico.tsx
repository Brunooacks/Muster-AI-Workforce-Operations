import { MusterShell } from "../shell";
import { Badge, DEMO, Disc, F, MES, TipLine, useT, type Snap } from "../fmt";

export default function HistoricoPage() {
  const t = useT();
  const S = DEMO.snaps, a = S[0], c = S[2];
  const m = (s: Snap) => t(...MES[s.mes]);
  const d = (x: number, y: number, inv = false) => { const v = (x - y) / y * 100, g = inv ? v < 0 : v > 0; return <td className={"dlt " + (g ? "up" : "dn")}>{(v > 0 ? "+" : "−") + F.n(Math.abs(v), 1)}%</td>; };
  type K = "validadas" | "custo" | "cpr" | "humano" | "atrito" | "incidentes" | "cobertura";
  const R: [string, K, (v: number) => string, boolean][] = [
    [t("Resultados validados", "Validated results", "Resultados validados"), "validadas", (v) => F.n(v), false],
    [t("Custo do mês", "Monthly cost", "Costo del mes"), "custo", F.brl0, true],
    [t("Custo por resultado", "Cost per result", "Costo por resultado"), "cpr", (v) => F.brl(v), true],
    [t("Humano por resultado", "Human per result", "Humano por resultado"), "humano", (v) => F.brl(v), true],
    [t("Pedidos a humanos (atrito)", "Requests to people (friction)", "Pedidos a personas (fricción)"), "atrito", (v) => F.n(v), true],
    [t("Incidentes", "Incidents", "Incidentes"), "incidentes", (v) => F.n(v), true],
    [t("Cobertura de baseline", "Baseline coverage", "Cobertura de baseline"), "cobertura", (v) => F.n(v, 1) + "%", false],
  ];
  const star = (s: Snap) => m(s) + (s.parcial ? "*" : "");
  return (
    <MusterShell active="historico">
      <main className="page" id="main">
        <div className="eyebrow rise" style={{ ["--i" as string]: 0 }}>{t("Histórico", "History", "Historial")} <span className="mono">· {DEMO.empresa} · {t("3º trimestre/2026", "Q3/2026", "3.er trimestre/2026")}</span></div>
        <div className="hd2 rise" style={{ ["--i" as string]: 1 }}>
          <h1>{t("Trimestre", "Quarter", "Trimestre")}: +{F.n((c.validadas / a.validadas - 1) * 100)}% {t("de resultados.", "in results.", "de resultados.")} <em>{t("Custo por resultado", "Cost per result", "Costo por resultado")} {F.n((1 - c.cpr / a.cpr) * 100)}% {t("menor.", "lower.", "menor.")}</em></h1>
          <div className="covline">{t("Snapshots imutáveis", "Immutable snapshots", "Snapshots inmutables")} · <Badge f="parcial" /> = {t("cobertura de baseline", "baseline coverage", "cobertura de baseline")} &lt; 80%</div>
        </div>
        <div className="snaps">
          {S.map((s, i) => (
            <article key={s.mes} className={"snap rise" + (s.parcial ? " parcial" : "")} style={{ ["--i" as string]: 2 + i * 0.3 }}>
              <h3>{m(s)}/2026 <Badge f={s.parcial ? "parcial" : "medido"} /></h3>
              <dl>
                <dt>{t("Resultados validados", "Validated results", "Resultados validados")}</dt><dd>{F.n(s.validadas)}</dd>
                <dt>{t("Custo", "Cost", "Costo")}</dt><dd>{F.brl0(s.custo)}</dd>
                <dt>{t("Custo por resultado", "Cost per result", "Costo por resultado")}</dt><dd>{F.brl(s.cpr)}</dd>
                <dt>{t("Humano por resultado", "Human per result", "Humano por resultado")}</dt><dd style={s.parcial ? { color: "#a0a0a6" } : undefined}>{s.parcial ? "≈ " : ""}{F.brl(s.humano)}</dd>
                <dt>{t("Cobertura de baseline", "Baseline coverage", "Cobertura de baseline")}</dt><dd>{F.n(s.cobertura, 1)}%</dd>
              </dl>
              <code>{t("fechado", "closed", "cerrado")} {s.fechado} · sha256:{s.hash}</code>
            </article>
          ))}
        </div>
        <section className="panel rise" style={{ ["--i" as string]: 4, marginTop: 14 }}>
          <h3>{t("Comparativo detalhado", "Detailed comparison", "Comparativo detallado")} <small>{S.map(m).join(" → ")}</small></h3>
          <div className="ht"><table>
            <thead><tr><th>{t("Métrica", "Metric", "Métrica")}</th><th>{star(S[0])}</th><th>{star(S[1])}</th><th>Δ</th><th>{star(S[2])}</th><th>Δ</th><th>Δ {t("tri", "qtr", "tri")}</th></tr></thead>
            <tbody>{R.map(([l, k, fm, inv]) => <tr key={k}><td>{l}</td><td>{fm(S[0][k])}</td><td>{fm(S[1][k])}</td>{d(S[1][k], S[0][k], inv)}<td>{fm(S[2][k])}</td>{d(S[2][k], S[1][k], inv)}{d(S[2][k], S[0][k], inv)}</tr>)}</tbody>
          </table><p style={{ font: "400 12px var(--app-font-mono)", color: "var(--mut)", marginTop: 8 }}>* {t("mês parcial", "partial month", "mes parcial")}</p></div>
          <TipLine label={t("Como os snapshots funcionam", "How snapshots work", "Cómo funcionan los snapshots")} text={t("Cada mês é fechado no dia 1 e gravado como snapshot imutável, com hash na trilha de auditoria. Correções entram como nova versão, nunca sobrescrevem. Mês com menos de 80% dos resultados com baseline medido fica marcado como parcial, e a comparação com humano aparece como estimativa.", "Each month closes on day 1 and is stored as an immutable snapshot, hashed in the audit trail. Fixes come in as a new version and never overwrite. A month with under 80% of results on a measured baseline is marked partial, and the human comparison shows as an estimate.", "Cada mes se cierra el día 1 y se guarda como snapshot inmutable, con hash en la pista de auditoría. Las correcciones entran como nueva versión, nunca sobrescriben. Un mes con menos de 80% de resultados con baseline medido queda como parcial y la comparación con humano aparece como estimación.")} />
        </section>
        <section className="panel rise" style={{ ["--i" as string]: 5, marginTop: 14 }}>
          <h3>{t("Por agente", "By agent", "Por agente")} <small>{t("resultados validados · custo por resultado", "validated results · cost per result", "resultados validados · costo por resultado")}</small></h3>
          <div className="ht"><table>
            <thead><tr><th>{t("Agente", "Agent", "Agente")}</th><th>{m(S[0])}</th><th>{m(S[1])}</th><th>{m(S[2])}</th><th>Δ {t("tri", "qtr", "tri")}</th><th>R$/res. {m(S[0])}</th><th>R$/res. {m(S[2])}</th><th>Baseline</th></tr></thead>
            <tbody>{DEMO.agentes.map((ag, i) => { const r = S.map((s) => s.rows[i]); return <tr key={ag.id}><td>{ag.nome}</td><td>{F.n(r[0].v)}</td><td>{F.n(r[1].v)}</td><td>{F.n(r[2].v)}</td>{d(r[2].v, r[0].v)}<td>{F.brl(r[0].c / r[0].v)}</td><td>{F.brl(r[2].c / r[2].v)}</td><td style={{ textAlign: "left" }}><Badge f={ag.bl.fonte} /></td></tr>; })}</tbody>
          </table></div>
        </section>
        <Disc />
      </main>
    </MusterShell>
  );
}
