import { Link, useLocation } from "wouter";
import { MusterMark } from "@/components/logo";
import { LangSwitcher } from "@/components/lang-switcher";
import { useLang, type Lang } from "@/lib/i18n";

const pt = {
  links: [
    { label: "Como funciona", href: "#ficha" },
    { label: "Acompanhamento", href: "#acompanhamento" },
    { label: "Decisão", href: "#decisao" },
    { label: "Board", href: "#board" },
    { label: "Integrações", href: "#integracoes" },
  ],
  signIn: "Entrar",
  cta: "Iniciar avaliação",
};

const en: typeof pt = {
  links: [
    { label: "How it works", href: "#ficha" },
    { label: "Monitoring", href: "#acompanhamento" },
    { label: "Decision", href: "#decisao" },
    { label: "Board", href: "#board" },
    { label: "Integrations", href: "#integracoes" },
  ],
  signIn: "Sign in",
  cta: "Start evaluation",
};
const es: typeof pt = {
  links: [
    { label: "Cómo funciona", href: "#ficha" },
    { label: "Seguimiento", href: "#acompanhamento" },
    { label: "Decisión", href: "#decisao" },
    { label: "Directorio", href: "#board" },
    { label: "Integraciones", href: "#integracoes" },
  ],
  signIn: "Iniciar sesión",
  cta: "Iniciar evaluación",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function HomeNav() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;
  const [location] = useLocation();
  const emHome = location === "/" || location === "";
  const ancora = (hash: string) => (emHome ? hash : `${base}/${hash}`);

  return (
    <header className="sticky top-0 z-50 border-b border-black/[.06] bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-[52px] max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2 lg:px-12">
        <a href={ancora("#top")} className="flex items-center gap-2 text-foreground">
          <MusterMark className="h-[22px] w-[22px]" />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">Muster</span>
        </a>

        <nav className="hidden items-center gap-4 text-[13px] text-foreground md:flex lg:gap-8" aria-label="Seções">
          {t.links.map((link) => (
            <a
              key={link.label}
              href={ancora(link.href)}
              className="transition-colors hover:text-muted-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 lg:gap-4">
          <LangSwitcher />
          <Link
            href="/sign-in"
            className="text-[13px] text-foreground transition-colors hover:text-muted-foreground"
          >
            {t.signIn}
          </Link>
          <Link
            href="/calculadora"
            className="rounded-full bg-foreground px-3.5 py-[7px] text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            {t.cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
