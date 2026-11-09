import { useState } from "react";
import { Link } from "wouter";
import {
  Bot,
  FileCheck2,
  House,
  ListChecks,
  Map as MapIcon,
  MoreHorizontal,
  Settings,
  ShieldAlert,
  UserCircle,
  UserPlus,
  BookOpenCheck,
  X,
} from "lucide-react";
import type { WorkforceScreen } from "@/lib/workforce-routing";
import { SHELL_MAIS, SHELL_MOBILE, shellItemAtivo } from "@/lib/shell-nav";
import { cn } from "@/lib/utils";

const icones: Partial<Record<WorkforceScreen, typeof House>> = {
  today: House,
  portfolio: Bot,
  entregas: ListChecks,
  alerts: ShieldAlert,
  reports: FileCheck2,
  mapa: MapIcon,
  admission: UserPlus,
  accountSettings: Settings,
  profile: UserCircle,
  onboarding: BookOpenCheck,
};

const rotas: Partial<Record<WorkforceScreen, string>> = {
  today: "/comando",
  portfolio: "/agentes",
  entregas: "/entregas",
  alerts: "/pendencias",
};

const rotasMais: Partial<Record<WorkforceScreen, string>> = {
  reports: "/relatorios",
  accountSettings: "/configuracoes",
  admission: "/admissao",
  mapa: "/mapa",
  onboarding: "/guia",
  profile: "/perfil",
};

/** Barra inferior do mobile: 4 itens fixos + "Mais" (referencias §2). */
export function ShellBottomBar({
  screen,
  labMode,
  navigate,
}: {
  screen: WorkforceScreen;
  labMode: boolean;
  navigate: (screen: WorkforceScreen) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ativo = shellItemAtivo(screen);

  function destinoPara(itemScreen: WorkforceScreen): string {
    return rotas[itemScreen] ?? rotasMais[itemScreen] ?? "/comando";
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto grid max-w-[560px] grid-cols-5">
        {SHELL_MOBILE.map((item) => {
          const Icon = icones[item.screen] ?? House;
          const active = ativo?.screen === item.screen;
          const conteudo = (
            <>
              <Icon className="h-[18px] w-[18px]" />
              <span className="mt-1 block text-[10px] leading-none">{item.label}</span>
            </>
          );
          const classes = cn(
            "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-colors",
            active ? "text-primary" : "text-muted-foreground hover:text-foreground",
          );
          return (
            <li key={item.screen}>
              {labMode ? (
                <button type="button" aria-current={active ? "page" : undefined} onClick={() => navigate(item.screen)} className={classes}>
                  {conteudo}
                </button>
              ) : (
                <Link href={destinoPara(item.screen)} aria-current={active ? "page" : undefined} className={classes}>
                  {conteudo}
                </Link>
              )}
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-expanded={aberto}
            aria-label="Mais opções"
            onClick={() => setAberto((valor) => !valor)}
            className={cn(
              "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-colors",
              aberto ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
            <span className="mt-1 block text-[10px] leading-none">Mais</span>
          </button>
        </li>
      </ul>

      {aberto && (
        <div className="border-t border-border bg-background px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Mais opções
            </span>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setAberto(false)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="grid gap-1">
            {SHELL_MAIS.map((item) => {
              const Icon = icones[item.screen] ?? MoreHorizontal;
              const active = ativo?.screen === item.screen;
              const classes = cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              );
              return (
                <li key={`${item.screen}-${item.path}`}>
                  {labMode ? (
                    <button type="button" onClick={() => { navigate(item.screen); setAberto(false); }} className={classes}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  ) : (
                    <Link href={rotasMais[item.screen] ?? item.path} onClick={() => setAberto(false)} className={classes}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
