import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { DEMO, useT } from "./fmt";
import { LangSwitcher } from "@/components/lang-switcher";
import "./proto.css";

/** Telas já entregues nesta fase; as outras mostram "em breve". */
import { MUSTER_SCREEN_PATHS as MUSTER_V2_PATHS } from "@/lib/workforce-routing";

const MARK = (
  <svg className="mark" viewBox="0 0 64 64" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 47 L32 38 L49 47" opacity=".35" /><path d="M15 37 L32 28 L49 37" opacity=".65" /><path d="M15 27 L32 18 L49 27" />
  </svg>
);
const I = (d: string) => <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: d }} />;
const ICON: Record<string, string> = {
  visao: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><circle cx="17" cy="17" r="3.5"/>',
  jornadas: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="7" cy="18" r="2"/><path d="M7 6h5a4 4 0 0 1 0 8H9"/>',
  agentes: '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 7V4M9 12.5v1M15 12.5v1"/>',
  direcionamento: '<path d="M4 12h9M13 12l-4-4M13 12l-4 4"/><path d="M15 6h5v12h-5"/>',
  squads: '<circle cx="8" cy="8" r="3"/><rect x="14" y="5" width="7" height="6" rx="2"/><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5M14 20v-4h7v4"/>',
  board: '<rect x="3.5" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="16.5" y="4" width="4" height="13" rx="1.5"/>',
  entregas: '<path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>',
  historico: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/><path d="M12 8v4l3 2"/>',
  aprendizados: '<path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20h5"/>',
  custos: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
};
type L3 = [string, string, string];
const NAV: [string, L3, string][] = [
  ["visao", ["Visão geral", "Overview", "Visión general"], "/visao-geral"],
  ["jornadas", ["Jornadas", "Journeys", "Jornadas"], "/jornadas"],
  ["agentes", ["Agentes", "Agents", "Agentes"], "/agentes"],
  ["direcionamento", ["Direcionamento", "Routing", "Direccionamiento"], "/direcionamento"],
  ["squads", ["Squads mistos", "Mixed squads", "Squads mixtos"], "/squads"],
  ["board", ["Board", "Board", "Board"], "/board"],
  ["entregas", ["Entregas", "Deliveries", "Entregas"], "/entregas"],
  ["historico", ["Histórico", "History", "Historial"], "/historico"],
  ["aprendizados", ["Aprendizados", "Learnings", "Aprendizajes"], "/aprendizados"],
  ["custos", ["Custos", "Costs", "Costos"], "/custos"],
  ["ajustes", ["Ajustes", "Settings", "Ajustes"], "/ajustes"],
];
const SUB: [L3, string][] = [
  [["Exportar para o board", "Export for the board", "Exportar para el board"], "/exportar"],
  [["Baseline humano", "Human baseline", "Baseline humano"], "/baseline"],
  [["Conectores", "Connectors", "Conectores"], "/conectores"],
  [["Auditoria", "Audit", "Auditoría"], "/auditoria"],
  [["Admitir um agente", "Admit an agent", "Admitir un agente"], "/admissao"],
  [["Onboarding", "Onboarding", "Onboarding"], "/onboarding"],
];
const READY = new Set<string>(MUSTER_V2_PATHS);

export function MusterShell({ active, children }: { active: string; children: ReactNode }) {
  const t = useT();
  const [path] = useLocation();
  const [side, setSide] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; out?: boolean }[]>([]);
  const tipRef = useRef<HTMLDivElement>(null);

  const toast = (msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, msg }]);
    setTimeout(() => setToasts((x) => x.map((y) => (y.id === id ? { ...y, out: true } : y))), 3400);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3720);
  };

  useEffect(() => { setSide(false); window.scrollTo(0, 0); }, [path]);

  /* "i": passa o mouse ou toca para ver a explicação; botões de ação só registram um aviso. */
  useEffect(() => {
    const box = tipRef.current!;
    const show = (b: Element) => {
      box.textContent = b.getAttribute("data-tip"); box.style.display = "block";
      const r = b.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24); box.style.width = w + "px";
      box.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + "px";
      let top = r.bottom + 8; if (top + box.offsetHeight > window.innerHeight - 8) top = r.top - box.offsetHeight - 8; box.style.top = Math.max(8, top) + "px";
    };
    const hide = () => { box.style.display = "none"; };
    const over = (e: Event) => { const b = (e.target as Element).closest?.(".itip"); if (b && matchMedia("(hover:hover)").matches) show(b); };
    const out = (e: Event) => { if ((e.target as Element).closest?.(".itip")) hide(); };
    const click = (e: Event) => {
      const el = e.target as Element;
      const b = el.closest?.(".itip");
      if (b) { e.preventDefault(); e.stopPropagation(); if (box.style.display === "block" && box.textContent === b.getAttribute("data-tip")) hide(); else show(b); return; }
      hide();
      const a = el.closest?.("[data-toast]"); if (a) toast(a.getAttribute("data-toast")!);
    };
    document.addEventListener("mouseover", over); document.addEventListener("mouseout", out); document.addEventListener("click", click);
    window.addEventListener("scroll", hide, { passive: true });
    return () => { document.removeEventListener("mouseover", over); document.removeEventListener("mouseout", out); document.removeEventListener("click", click); window.removeEventListener("scroll", hide); };
  }, []);

  const soon = t("Esta tela chega nas próximas entregas.", "This screen ships in a later delivery.", "Esta pantalla llega en las próximas entregas.");
  const go = (href: string, label: ReactNode, extra?: ReactNode, cur?: boolean) =>
    READY.has(href)
      ? <Link key={href} href={href} aria-current={cur ? "page" : undefined}>{label}{extra}</Link>
      : <a key={href} href="#" aria-current={cur ? "page" : undefined} data-toast={soon} onClick={(e) => e.preventDefault()}>{label}{extra}</a>;

  return (
    <div className="mp">
      <div className="app">
        <aside className={"side" + (side ? " on" : "")} id="side" aria-label={t("Navegação principal", "Main navigation", "Navegación principal")}>
          <Link className="brand" href="/visao-geral" aria-label="Muster Workforce Operations">{MARK}<span className="bn"><b>Muster</b><em>Workforce Operations</em></span></Link>
          <div className="wsw">
            <button className="wsw-b" aria-haspopup="listbox" aria-expanded={wsOpen} onClick={() => setWsOpen(!wsOpen)}>
              <i>LL</i><span><b>{DEMO.empresa}</b><small>{t("Conta empresa", "Company account", "Cuenta empresa")} · {t(DEMO.periodo, "September 2026", "septiembre de 2026")}</small></span>
              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg>
            </button>
            <div className="wsw-m" role="listbox" hidden={!wsOpen}>
              <a role="option" aria-selected="true" href="#" onClick={(e) => { e.preventDefault(); setWsOpen(false); }}><i>LL</i><span><b>{DEMO.empresa}</b><small>{t("Conta empresa", "Company account", "Cuenta empresa")}</small></span><em>{t("atual", "current", "actual")}</em></a>
              <a role="option" href="#" data-toast={t("Conta pessoal: separada da empresa.", "Personal account: kept apart from the company.", "Cuenta personal: separada de la empresa.")} onClick={(e) => e.preventDefault()}><i>EU</i><span><b>{t("Meus bots", "My bots", "Mis bots")}</b><small>{t("Conta pessoal", "Personal account", "Cuenta personal")}</small></span></a>
              <p>{t("Contas separadas: dados pessoais nunca aparecem na conta empresa.", "Separate accounts: personal data never shows in the company account.", "Cuentas separadas: los datos personales nunca aparecen en la cuenta empresa.")}</p>
            </div>
          </div>
          <nav className="nav" aria-label={t("Seções", "Sections", "Secciones")}>
            <small>{t("Acompanhar", "Follow", "Seguir")}</small>
            {NAV.map(([k, l, href]) => go(href, <>{I(ICON[k])}<span>{t(...l)}</span></>, k === "visao" ? <span className="n">{DEMO.decisoes}</span> : null, k === active))}
          </nav>
          <nav className="nav sub" aria-label={t("Atalhos", "Shortcuts", "Atajos")}>
            <small>{t("Governança", "Governance", "Gobernanza")}</small>
            {SUB.map(([l, href]) => go(href, t(...l), null, false))}
          </nav>
          <div className="me"><i>MD</i><div><b>Marina Duarte</b><span>{t("dona · Atendimento", "owner · Support", "dueña · Atención")}</span></div></div>
        </aside>
        <div className="col" id="col">
          <header className="top">
            <button className="burger" aria-label={t("Abrir menu", "Open menu", "Abrir menú")} aria-controls="side" onClick={() => setSide(true)}>{I('<path d="M4 7h16M4 12h16M4 17h10"/>')}</button>
            <Link className="mbrand" href="/visao-geral" aria-label="Muster Workforce Operations">{MARK}<span className="bn"><b>Muster</b><em>Workforce Operations</em></span></Link>
            <button className="search" data-toast={soon}>
              <svg className="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></svg>
              <span>{t("Pergunte sobre seus agentes", "Ask about your agents", "Pregunte sobre sus agentes")}</span><kbd>⌘K</kbd>
            </button>
            <span className="seal" role="note"><i />{t("Dados ilustrativos", "Illustrative data", "Datos ilustrativos")}</span>
            <div className="mp-lang"><LangSwitcher /></div>
          </header>
          <div>{children}</div>
          <footer className="foot"><span>{t("Dados ilustrativos", "Illustrative data", "Datos ilustrativos")} · {DEMO.empresa}</span><span>{t(DEMO.periodo, "September 2026", "septiembre de 2026")}</span></footer>
        </div>
      </div>
      <div className={"scrim" + (side ? " on" : "")} onClick={() => setSide(false)} />
      <div className="toasts" aria-live="polite">{toasts.map((x) => <div key={x.id} className={"toast" + (x.out ? " out" : "")}><i>✓</i><span>{x.msg}</span></div>)}</div>
      <div className="tipbox" role="tooltip" ref={tipRef} style={{ display: "none" }} />
    </div>
  );
}
