import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGS, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Globe dropdown — PT / EN / ES. Persisted via LangProvider. */
export function LangSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Idioma / Language / Idioma"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-card-border bg-card px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
        {current.code}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={cn("gap-2 text-sm", l.code === lang && "font-semibold text-primary")}
          >
            <span>{l.flag}</span>
            {l.label}
            {l.code === lang && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
