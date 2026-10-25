import type { ReactNode } from "react";
import raw from "./demo/lumen.json";
import { useLang, type Lang } from "@/lib/i18n";

/* Dados ilustrativos da conta empresa fictícia do protótipo aprovado. */
export type Baseline = { papel: string; horas: number; fator: number; horasProd: number; custoHora: number; custoMes: number; n: number; fonte: "medido" | "declarado"; origem: string; congelado: string; versao: string };
export type Agent = { id: string; nome: string; funcao: string; dono: string; time: string; projeto: string; plataforma: string; entregas: number; validadas: number; custoMes: number; custoPorResultado: number; custoHumanoUnit: number; qualidade: number; baseline: number; resgatePct: number; quadrante: string; status: "ok" | "atenção" | "crítico"; atrito: number; incidentes: number; squad: string; bl: Baseline };
export type Snap = { mes: string; validadas: number; custo: number; cpr: number; humano: number; incidentes: number; atrito: number; cobertura: number; parcial: boolean; hash: string; fechado: string; rows: { id: string; v: number; c: number; inc: number }[] };
export type Demo = { empresa: string; periodo: string; decisoes: number; economiaDesligarTriagem: number; projetos: string[]; agentes: Agent[]; cov: number; snaps: Snap[]; jornada: { perdaFiscal: number; perdaTotal: number; perdaFiscalPct: number } };
export const DEMO = raw as unknown as Demo;
export const AG: Record<string, Agent> = Object.fromEntries(DEMO.agentes.map((a) => [a.id, a]));

function fix(v: number, d: number) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
export const F = {
  n: (v: number, d = 0) => fix(v, d),
  brl: (v: number, d = 2) => "R$ " + fix(v, d),
  brl0: (v: number) => "R$ " + fix(v, 0),
  pct: (v: number, d = 0) => fix(v, d) + "%",
};

/** Texto nos três idiomas: t("pt", "en", "es"). */
export function useT() {
  const { lang } = useLang();
  return (pt: string, en: string, es: string) => ({ pt, en, es } as Record<Lang, string>)[lang] ?? pt;
}

const BADGE: Record<string, [string, string, string]> = { medido: ["medido", "measured", "medido"], declarado: ["declarado", "declared", "declarado"], parcial: ["parcial", "partial", "parcial"] };
export function Badge({ f }: { f: string }) {
  const t = useT();
  const b = BADGE[f] ?? [f, f, f];
  return <span className={"bl-b " + f}>{t(...b)}</span>;
}

export function Tip({ text }: { text: string }) {
  return <button type="button" className="itip" aria-label="i" data-tip={text}>i</button>;
}

export function TipLine({ label, text }: { label: string; text: string }) {
  return <span className="itip-l">{label} <Tip text={text} /></span>;
}

export function Spark({ vals }: { vals: number[] }) {
  const w = 120, h = 34, mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => [i * (w - 8) / (vals.length - 1) + 4, h - 5 - (v - mn) / r * (h - 10)]);
  return (
    <svg className="spk" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.5 : 2.2} />)}
    </svg>
  );
}

export function Disc({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <footer className="disc">
      <p>{t("Dados ilustrativos e fictícios; não são resultados reais. Baseline humano em horas produtivas (70% de 168 h, editável).",
        "Illustrative, fictitious data; not real results. Human baseline in productive hours (70% of 168 h, editable).",
        "Datos ilustrativos y ficticios; no son resultados reales. Baseline humano en horas productivas (70% de 168 h, editable).")}</p>
      {children}
    </footer>
  );
}

export const MES: Record<string, [string, string, string]> = { jul: ["jul", "Jul", "jul"], ago: ["ago", "Aug", "ago"], set: ["set", "Sep", "sep"] };
export const STATUS: Record<string, [string, string, string]> = { ok: ["ok", "ok", "ok"], "atenção": ["atenção", "attention", "atención"], "crítico": ["crítico", "critical", "crítico"] };
