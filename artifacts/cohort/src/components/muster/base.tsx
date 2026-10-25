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
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

/** KPI grande com, no máximo, uma linha curta embaixo. */
export function Kpi({
  label,
  value,
  line,
  info,
  tone = "neutral",
  estimated = false,
}: {
  label: string;
  value: string;
  line?: string;
  info?: ReactNode;
  tone?: KpiTone;
  /** Comparação sobre baseline declarado: aparece em cinza, como estimativa. */
  estimated?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4" data-testid="kpi">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {info ? <InfoTip>{info}</InfoTip> : null}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl",
          estimated ? "text-muted-foreground" : toneClass[tone],
        )}
      >
        {value}
      </div>
      {line ? <p className="mt-1 truncate text-xs text-muted-foreground">{line}</p> : null}
    </div>
  );
}

/** Aviso discreto no rodapé da tela (premissas, fontes, ressalvas). */
export function FooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground" role="note">
      {children}
    </p>
  );
}

/** Selo "Dados ilustrativos" enquanto não houver dado real na conta. */
export function IllustrativeBadge() {
  const { lang } = useLang();
  return (
    <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">
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
        source === "measured"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
