import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Perfis de cor, na linha dos perfis do Terminal do macOS: a operação fica
 * horas com esta tela aberta, e ambiente de trabalho é preferência pessoal —
 * sala clara, projetor, olho cansado no fim do turno.
 *
 * Cada perfil troca só os tokens de base no `:root`; a interface inteira é
 * construída sobre eles, então nenhum componente precisa saber que mudou.
 */
export const PROFILES = [
  { id: "claro", label: "Claro", hint: "padrão do protótipo aprovado", swatch: "#1d1d1f", bg: "#ffffff" },
  { id: "noite", label: "Noite", hint: "modo escuro, ciano sobre azul-noite", swatch: "#19d3f5", bg: "#06080d" },
] as const;

export type ProfileId = (typeof PROFILES)[number]["id"];

const STORAGE_KEY = "muster:profile";

function aplicar(id: ProfileId) {
  const root = document.documentElement;
  // "claro" é o :root; "noite" liga a classe .dark (tokens do protótipo).
  root.removeAttribute("data-profile");
  root.classList.toggle("dark", id === "noite");
}

export function lerPerfilSalvo(): ProfileId {
  try {
    const salvo = window.localStorage.getItem(STORAGE_KEY) as ProfileId | null;
    return PROFILES.some((p) => p.id === salvo) ? (salvo as ProfileId) : "claro";
  } catch {
    return "claro";
  }
}

/** Aplica antes da primeira pintura, para não piscar o tema errado no boot. */
export function inicializarPerfil(): void {
  aplicar(lerPerfilSalvo());
}

export function ProfileSwitcher({ className }: { className?: string }) {
  const [perfil, setPerfil] = useState<ProfileId>(() => lerPerfilSalvo());
  const atual = PROFILES.find((p) => p.id === perfil) ?? PROFILES[0];

  useEffect(() => {
    aplicar(perfil);
    try {
      window.localStorage.setItem(STORAGE_KEY, perfil);
    } catch {
      /* navegação privada: o perfil vale só para esta sessão */
    }
  }, [perfil]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Perfil de cor"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-card-border bg-card px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <Palette className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span
          className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/20"
          style={{ backgroundColor: atual.swatch }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[15rem]">
        <DropdownMenuLabel className="text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
          Perfil de cor
        </DropdownMenuLabel>
        {PROFILES.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setPerfil(p.id)}
            className={cn("gap-2.5", p.id === perfil && "font-semibold")}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-black/25"
              style={{ background: `linear-gradient(135deg, ${p.swatch} 50%, ${p.bg} 50%)` }}
            />
            <span className="flex flex-col leading-tight">
              <span className="text-sm">{p.label}</span>
              <span className="text-[11px] text-muted-foreground">{p.hint}</span>
            </span>
            {p.id === perfil && <span className="ml-auto text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
