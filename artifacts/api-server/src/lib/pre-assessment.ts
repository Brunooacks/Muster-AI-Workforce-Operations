import type { LayerKey, AutonomyLevel } from "@workspace/db";
import { METRIC_CATALOG, type CatalogMetric } from "./metric-catalog";
import type { AgentDraft, DraftMetric } from "./analyze";

/**
 * Pre-assessment (R4) — understands an agent's repository WITHOUT any AI key:
 * pure heuristics over the concatenated source (fetch-source output format,
 * "===== path =====" file separators). Produces the same AgentDraft shape as
 * the AI analyzer, with a per-field confidence map, so the admission UI reuses
 * the exact same review screen. When an AI key is configured, analyze.ts runs
 * on top and refines this draft.
 */

export interface PreAssessment {
  draft: AgentDraft;
  /** 0-100 per top-level field — what the heuristic is sure about. */
  fieldConfidence: Record<string, number>;
  /** Detected stack/platform, e.g. "langchain". */
  platform: string | null;
  /** Raw signals for auditability, e.g. ["dep:langchain", "readme:kpi-table"]. */
  signals: string[];
}

const STACK_SIGNALS: Array<{ pattern: RegExp; platform: string; label: string }> = [
  { pattern: /"@langchain\/|"langchain"|from ["']@langchain/, platform: "langchain", label: "dep:langchain" },
  { pattern: /"@anthropic-ai\/sdk"|from ["']@anthropic-ai\/sdk/, platform: "anthropic-claude", label: "dep:anthropic" },
  { pattern: /copilot.extension|Copilot Extension|copilot_extensions/i, platform: "github-copilot", label: "sig:copilot-extension" },
  { pattern: /"crewai"|import crewai/, platform: "crewai", label: "dep:crewai" },
  { pattern: /"openai"|from ["']openai/, platform: "openai", label: "dep:openai" },
];

const AUTONOMY_SIGNALS: Array<{ pattern: RegExp; level: AutonomyLevel; label: string }> = [
  { pattern: /escala(r|m|mento)? para humano|escalate.*human|human.in.the.loop|notificam? um humano/i, level: "escalates", label: "sig:escalates-human" },
  { pattern: /sugest(ão|ões) apenas|recomenda(ção|ções)|decis(ão|ões).*(humana|editorial)|advisory|não.autoritativo/i, level: "restricted", label: "sig:advisory-only" },
];

/** Split fetch-source concatenated content back into (path, body) files. */
function splitFiles(content: string): Array<{ path: string; body: string }> {
  const files: Array<{ path: string; body: string }> = [];
  const re = /^={3,}\s*(.+?)\s*={3,}$/gm;
  let match: RegExpExecArray | null;
  let last: { path: string; start: number } | null = null;
  while ((match = re.exec(content)) !== null) {
    if (last) files.push({ path: last.path, body: content.slice(last.start, match.index) });
    last = { path: match[1]!, start: match.index + match[0].length };
  }
  if (last) files.push({ path: last.path, body: content.slice(last.start) });
  return files.length > 0 ? files : [{ path: "source", body: content }];
}

/** Pull "- item" / "· item" bullets under a heading whose text matches `heading`. */
function bulletsUnder(readme: string, heading: RegExp): string[] {
  const lines = readme.split("\n");
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,4}\s/.test(line)) {
      inSection = heading.test(line);
      continue;
    }
    if (inSection) {
      const m = line.match(/^\s*[-*·]\s+(.+)$/);
      if (m) out.push(m[1]!.replace(/\*\*/g, "").trim());
    }
  }
  return out;
}

function sectionText(readme: string, heading: RegExp): string {
  const lines = readme.split("\n");
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,4}\s/.test(line)) {
      inSection = heading.test(line);
      continue;
    }
    if (inSection && line.trim()) out.push(line.trim());
  }
  return out.join(" ").slice(0, 400);
}

/** Parse "| Camada | Métrica | Meta |" KPI tables from READMEs. */
const LAYER_PT: Record<string, LayerKey> = {
  eficácia: "efficacy",
  eficacia: "efficacy",
  eficiência: "efficiency",
  eficiencia: "efficiency",
  adoção: "adoption",
  adocao: "adoption",
  governança: "governance",
  governanca: "governance",
  valor: "value",
};

function kpiTableRows(readme: string): DraftMetric[] {
  const rows: DraftMetric[] = [];
  for (const line of readme.split("\n")) {
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    const layer = LAYER_PT[cells[0]!.toLowerCase()];
    if (!layer) continue;
    rows.push({
      layer,
      label: cells[1]!,
      unit: guessUnit(cells[2]!),
      target: cells[2]!,
      rationale: "Extraído da tabela de KPIs do repositório.",
    });
  }
  return rows;
}

function guessUnit(target: string): string {
  if (/%/.test(target)) return "%";
  if (/R\$\s*[\d.,]+\s*(mil|k)/i.test(target)) return "R$ mil";
  if (/R\$/.test(target)) return "R$";
  if (/\bmin\b/.test(target)) return "min";
  if (/\bs\b/.test(target)) return "s";
  if (/\/\s*dia|\bdia\b/.test(target)) return "/dia";
  if (/\bh\b/.test(target)) return "h";
  if (/^0$/.test(target.trim())) return "neg.";
  return "";
}

/** Fill missing layers with the closest catalog metric for the platform. */
function fillFromCatalog(existing: DraftMetric[]): DraftMetric[] {
  const present = new Set(existing.map((m) => m.layer));
  const filled = [...existing];
  const techVertical = METRIC_CATALOG.find((v) => v.key === "tecnologia");
  const opsVertical = METRIC_CATALOG.find((v) => v.key === "operacoes");
  const pool: CatalogMetric[] = [...(techVertical?.metrics ?? []), ...(opsVertical?.metrics ?? [])];
  for (const layer of ["efficacy", "efficiency", "adoption", "governance", "value"] as LayerKey[]) {
    if (present.has(layer)) continue;
    const candidate = pool.find((m) => m.layer === layer);
    if (candidate) {
      filled.push({
        layer,
        label: candidate.label,
        unit: candidate.unit,
        target: candidate.target,
        rationale: `Sugerida do catálogo (${candidate.key}) — camada sem métrica declarada no repositório.`,
      });
    }
  }
  return filled;
}

export function preAssess(content: string, nameHint?: string): PreAssessment {
  const files = splitFiles(content);
  const signals: string[] = [];

  // Platform detection over the whole bundle.
  let platform: string | null = null;
  for (const s of STACK_SIGNALS) {
    if (s.pattern.test(content)) {
      signals.push(s.label);
      platform = platform ?? s.platform;
    }
  }

  // Prefer the deepest README that looks like an agent dossier (has KPI table).
  const readmes = files.filter((f) => /readme\.md$/i.test(f.path));
  const dossier =
    readmes.find((r) => /\|\s*Camada\s*\|/i.test(r.body) || /## KPIs/i.test(r.body)) ??
    readmes[0] ?? { path: "", body: "" };
  if (dossier.path) signals.push(`readme:${dossier.path}`);

  // Name/role from the README H1 or package.json description.
  // Split title on em/en dash only — ASCII hyphens are part of slug names
  // like "brand-guardian-copilot".
  const h1 = dossier.body.match(/^#\s+(.+)$/m)?.[1] ?? "";
  const h1Name = h1.split(/[—–]/)[0]?.trim().replace(/`/g, "") ?? "";
  const h1Role = h1.split(/[—–]/).slice(1).join(" — ").trim();
  const pkgDesc = content.match(/"description":\s*"([^"]{10,200})"/)?.[1] ?? "";

  const shouldDo = bulletsUnder(dossier.body, /papel|role|o que (este agente )?faz/i).slice(0, 6);
  const shouldNotDo = bulletsUnder(dossier.body, /não deve|nao deve|should not|limites/i).slice(0, 6);
  if (shouldDo.length > 0) signals.push("readme:papel");
  if (shouldNotDo.length > 0) signals.push("readme:nao-deve");

  // Autonomy.
  let autonomyLevel: AutonomyLevel = "escalates";
  for (const a of AUTONOMY_SIGNALS) {
    if (a.pattern.test(dossier.body)) {
      autonomyLevel = a.level;
      signals.push(a.label);
      break;
    }
  }

  // Business case.
  const baseline = sectionText(dossier.body, /business case|caso de neg/i);
  const paybackMatch = dossier.body.match(/payback[^:\n]*:?\s*\*{0,2}([^\n*]+)/i)?.[1]?.trim() ?? "";

  // Metrics: README KPI table first, catalog fills the gaps (R2 integration).
  const tableMetrics = kpiTableRows(dossier.body);
  if (tableMetrics.length > 0) signals.push("readme:kpi-table");
  const proposedMetrics = fillFromCatalog(tableMetrics).slice(0, 10);

  const name = (nameHint || h1Name || "Agente sem nome").slice(0, 60);
  const role = (h1Role || pkgDesc.split(/[.—]/)[0] || "Agente de IA").slice(0, 80);

  const draft: AgentDraft = {
    name,
    role,
    tagline: pkgDesc.slice(0, 120) || `${role} descoberto via pré-assessment`,
    bio: (pkgDesc || sectionText(dossier.body, /^#\s/) || `${name} — ${role}.`).slice(0, 400),
    shouldDo: shouldDo.length > 0 ? shouldDo : [role],
    shouldNotDo,
    autonomyLevel,
    autonomyNotes: "",
    limits: [],
    businessCase: {
      baseline: baseline.slice(0, 200),
      targetPayback: paybackMatch.slice(0, 60),
      description: baseline.slice(0, 300),
    },
    proposedMetrics,
    summary:
      `Pré-assessment heurístico (sem IA): stack ${platform ?? "não identificada"}, ` +
      `${tableMetrics.length} métricas extraídas do repositório e ` +
      `${proposedMetrics.length - tableMetrics.length} sugeridas do catálogo. ` +
      `Revise os campos de baixa confiança antes de admitir.`,
    confidence: Math.min(
      92,
      30 +
        (platform ? 15 : 0) +
        (tableMetrics.length > 0 ? 25 : 0) +
        (shouldDo.length > 0 ? 12 : 0) +
        (shouldNotDo.length > 0 ? 10 : 0),
    ),
  };

  const fieldConfidence: Record<string, number> = {
    name: h1Name ? 85 : nameHint ? 70 : 30,
    role: h1Role ? 80 : pkgDesc ? 55 : 30,
    shouldDo: shouldDo.length > 0 ? 80 : 25,
    shouldNotDo: shouldNotDo.length > 0 ? 80 : 20,
    autonomyLevel: signals.some((s) => s.startsWith("sig:")) ? 75 : 40,
    businessCase: baseline ? 65 : 20,
    proposedMetrics: tableMetrics.length > 0 ? 85 : 45,
  };

  return { draft, fieldConfidence, platform, signals };
}
