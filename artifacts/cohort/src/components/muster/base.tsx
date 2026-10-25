import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UI_COPY } from "./ui-copy";

/**
 * Ícone "i": abre ao passar o mouse e ao tocar (celular). Explicações,
 * premissas e fontes ficam aqui, fora da primeira camada da tela.
 */
export function InfoTip({ children, className }: { children: ReactNode; className?: string }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={UI_COPY[lang].moreInfo}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2",
          className,
        )}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-xs leading-relaxed" side="top">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export type KpiTone = "neutral" | "good" | "warn" | "bad";

const toneClass: Record<KpiTone, string> = {
  neutral: "text-foreground",
  good: "text-foreground",
  warn: "text-[hsl(var(--chart-2))]",
  bad: "text-[hsl(var(--chart-3))]",
};

/**
 * KPI grande (padrão do protótipo): rótulo mono em caixa alta, valor grande,
 * variação opcional e, no máximo, uma linha curta embaixo.
 */
export function Kpi({
  label,
  value,
  unit,
  delta,
  line,
  info,
  tone = "neutral",
  estimated = false,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: { text: string; up: boolean };
  line?: string;
  info?: ReactNode;
  tone?: KpiTone;
  /** Comparação sobre baseline declarado: aparece em cinza, como estimativa. */
  estimated?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[22px] bg-card px-5 pb-4 pt-5 ring-1 ring-border" data-testid="kpi">
      <div className="flex items-center gap-1.5">
        <small className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</small>
        {info ? <InfoTip>{info}</InfoTip> : null}
      </div>
      <div
        className={cn(
          "whitespace-nowrap text-[clamp(30px,3.2vw,42px)] font-semibold leading-none tracking-[-0.04em] tabular-nums",
          estimated ? "text-muted-foreground" : toneClass[tone],
        )}
      >
        {value}
        {unit ? <sub className="ml-1 align-baseline text-[0.42em] tracking-normal text-muted-foreground">{unit}</sub> : null}
      </div>
      {delta ? (
        <div className={cn("font-mono text-[12.5px] font-medium", delta.up ? "text-[#0f7a5f] dark:text-[hsl(var(--chart-1))]" : "text-[hsl(var(--chart-3))]")}>{delta.text}</div>
      ) : null}
      {line ? <p className="mt-auto truncate border-t border-border pt-2 text-[13.5px] leading-snug text-muted-foreground">{line}</p> : null}
    </div>
  );
}

/** Aviso discreto no rodapé da tela (premissas, fontes, ressalvas). */
export function FooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground" role="note">
      {children}
    </p>
  );
}

/** Selo "Dados ilustrativos" enquanto não houver dado real na conta. */
export function IllustrativeBadge() {
  const { lang } = useLang();
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
      {UI_COPY[lang].illustrative}
    </span>
  );
}

/** Selo do baseline humano: declarado (estimativa) ou medido. */
export function BaselineSeal({ source }: { source: "declared" | "measured" }) {
  const { lang } = useLang();
  const label = {
    pt: { declared: "declarado", measured: "medido" },
    en: { declared: "declared", measured: "measured" },
    es: { declared: "declarado", measured: "medido" },
  }[lang][source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        "font-mono",
        source === "measured"
          ? "bg-[hsl(var(--chart-1)/0.14)] text-[#0f7a5f] dark:text-[hsl(var(--chart-1))]"
          : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** Cabeçalho de tela: título curto, selo ilustrativo e "i" opcional. */
export function ScreenHeader({ title, subtitle, info, actions }: { title: string; subtitle?: string; info?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[clamp(30px,4vw,44px)] font-semibold leading-[1.05] tracking-[-0.035em]">{title}</h1>
          {info ? <InfoTip>{info}</InfoTip> : null}
          <IllustrativeBadge />
        </div>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

const bandClass = {
  green: "bg-[hsl(var(--chart-1)/0.14)] text-[#0f7a5f] dark:text-[hsl(var(--chart-1))]",
  yellow: "bg-[hsl(var(--chart-2)/0.18)] text-[#8a5a00] dark:text-[hsl(var(--chart-2))]",
  red: "bg-[hsl(var(--chart-3)/0.14)] text-[hsl(var(--chart-3))]",
} as const;

export function BandPill({ band, label }: { band: keyof typeof bandClass; label: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", bandClass[band])}>{label}</span>;
}

/** Barra horizontal simples (0..1). */
export function Meter({ value, tone = "neutral" }: { value: number; tone?: KpiTone }) {
  const color = { neutral: "bg-foreground", good: "bg-[hsl(var(--chart-1))]", warn: "bg-[hsl(var(--chart-2))]", bad: "bg-[hsl(var(--chart-3))]" }[tone];
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Section({ title, info, children, className }: { title: string; info?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-[22px] bg-card px-5 pb-3.5 pt-5 ring-1 ring-border", className)}>
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-base font-semibold leading-tight">{title}</h3>
        {info ? <InfoTip>{info}</InfoTip> : null}
      </div>
      {children}
    </section>
  );
}
