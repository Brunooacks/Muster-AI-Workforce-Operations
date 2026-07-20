import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang, type Lang } from "@/lib/i18n";

/* ── Eyebrow: tiny uppercase tracked microlabel ───────────── */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── PageHeading: editorial serif title + eyebrow + subtitle ── */
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight leading-[1.05] text-foreground">
          {title}
        </h1>
        {subtitle && <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* ── StatCard: outline icon + eyebrow + big serif number ────── */
export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  tone = "neutral",
}: {
  icon?: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  tone?: "neutral" | "up" | "down" | "warn";
}) {
  const deltaTone =
    tone === "up"
      ? "text-chart-1"
      : tone === "down"
        ? "text-chart-3"
        : tone === "warn"
          ? "text-chart-2"
          : "text-muted-foreground";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />}
      </div>
      <div className="font-serif text-[2.25rem] font-medium leading-none tracking-tight">{value}</div>
      {delta && <div className={cn("text-xs font-medium", deltaTone)}>{delta}</div>}
    </div>
  );
}

/* ── Pill / status badges ───────────────────────────────────── */
type Tone = "sage" | "ochre" | "terracotta" | "red" | "blue" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  sage: "bg-chart-1/15 text-chart-1",
  ochre: "bg-chart-2/20 text-chart-2",
  terracotta: "bg-chart-3/15 text-chart-3",
  red: "bg-chart-4/15 text-chart-4",
  blue: "bg-chart-5/15 text-chart-5",
  muted: "bg-muted text-muted-foreground",
};

export function Pill({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.07em]",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: "sage",
  flagged: "terracotta",
  observation: "ochre",
  retiring: "blue",
  retired: "muted",
};

const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  pt: {
    active: "Ativo",
    flagged: "Em alerta",
    observation: "Probation",
    retiring: "Recalibrando",
    retired: "Aposentado",
  },
  en: {
    active: "Active",
    flagged: "Flagged",
    observation: "Probation",
    retiring: "Recalibrating",
    retired: "Retired",
  },
  es: {
    active: "Activo",
    flagged: "En alerta",
    observation: "Probation",
    retiring: "Recalibrando",
    retired: "Retirado",
  },
};

/** Lang-aware status label for non-component call sites. */
export function statusLabel(status: string, lang: Lang): string {
  return STATUS_LABEL[lang][status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const { lang } = useLang();
  const tone = STATUS_TONE[status] ?? ("muted" as Tone);
  return <Pill tone={tone}>{statusLabel(status, lang)}</Pill>;
}

const VERDICT_TONE: Record<string, Tone> = {
  promote: "sage",
  mentor: "ochre",
  retire: "terracotta",
  observation: "blue",
};

const VERDICT_LABEL: Record<Lang, Record<string, string>> = {
  pt: {
    promote: "Promover",
    mentor: "Mentorar",
    retire: "Aposentar",
    observation: "Observar",
  },
  en: {
    promote: "Promote",
    mentor: "Mentor",
    retire: "Retire",
    observation: "Observe",
  },
  es: {
    promote: "Ascender",
    mentor: "Mentoría",
    retire: "Retirar",
    observation: "Observar",
  },
};

/** Lang-aware verdict label for non-component call sites. */
export function verdictLabel(verdict: string, lang: Lang): string {
  return VERDICT_LABEL[lang][verdict] ?? verdict;
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  const { lang } = useLang();
  const tone = VERDICT_TONE[verdict] ?? ("muted" as Tone);
  return <Pill tone={tone}>{verdictLabel(verdict, lang)}</Pill>;
}

const SEVERITY_TONE: Record<string, Tone> = {
  critical: "red",
  high: "terracotta",
  medium: "ochre",
  antecedent: "blue",
  stable: "sage",
};

const SEVERITY_LABEL: Record<Lang, Record<string, string>> = {
  pt: {
    critical: "Crítica",
    high: "Alta",
    medium: "Média",
    antecedent: "Antecedente",
    stable: "Estável",
  },
  en: {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    antecedent: "Antecedent",
    stable: "Stable",
  },
  es: {
    critical: "Crítica",
    high: "Alta",
    medium: "Media",
    antecedent: "Antecedente",
    stable: "Estable",
  },
};

/** Lang-aware severity label for non-component call sites. */
export function severityLabel(severity: string, lang: Lang): string {
  return SEVERITY_LABEL[lang][severity] ?? severity;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const { lang } = useLang();
  const tone = SEVERITY_TONE[severity] ?? ("muted" as Tone);
  return <Pill tone={tone}>{severityLabel(severity, lang)}</Pill>;
}

/* ── FilterChip: pill toggle with optional count ────────────── */
export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tabular-nums", active ? "text-primary-foreground/70" : "text-muted-foreground/60")}>
          · {count}
        </span>
      )}
    </button>
  );
}

/* ── Avatar disc with initial, colored by hashed name ───────── */
const DISC_TONES = [
  "bg-chart-1/20 text-chart-1",
  "bg-chart-2/25 text-chart-2",
  "bg-chart-3/20 text-chart-3",
  "bg-chart-5/20 text-chart-5",
  "bg-primary/15 text-primary",
];

export function AgentDisc({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = (name?.trim()?.charAt(0) || "?").toUpperCase();
  let hash = 0;
  for (let i = 0; i < (name?.length ?? 0); i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const tone = DISC_TONES[hash % DISC_TONES.length];
  const sizeClass =
    size === "lg"
      ? "h-16 w-16 text-2xl"
      : size === "sm"
        ? "h-8 w-8 text-xs"
        : "h-10 w-10 text-sm";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-serif font-medium",
        sizeClass,
        tone,
        className,
      )}
    >
      {initial}
    </div>
  );
}
