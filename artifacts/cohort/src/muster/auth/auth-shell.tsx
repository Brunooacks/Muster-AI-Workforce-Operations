import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { MusterMark } from "@/components/logo";
import { LangSwitcher } from "@/components/lang-switcher";
import { useLang } from "@/lib/i18n";
import { AUTH_COPY } from "./auth-copy";

const PROFILE_KEY = "muster:profile";

function ThemeToggle() {
  const { lang } = useLang();
  const t = AUTH_COPY[lang];
  const [noite, setNoite] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", noite);
    try {
      window.localStorage.setItem(PROFILE_KEY, noite ? "noite" : "claro");
    } catch {
      /* navegação privada */
    }
  }, [noite]);
  const label = noite ? t.themeLight : t.themeNight;
  return (
    <button
      type="button"
      onClick={() => setNoite((v) => !v)}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-card-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      {noite ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * Moldura das telas de entrar e criar conta, no visual do protótipo aprovado:
 * fundo claro, tinta #1d1d1f, rótulos mono e ciano só como destaque.
 */
export function AuthShell({
  mode,
  homeHref,
  switchHref,
  children,
}: {
  mode: "sign-in" | "sign-up";
  homeHref: string;
  switchHref: string;
  children: ReactNode;
}) {
  const { lang } = useLang();
  const t = AUTH_COPY[lang];
  const isSignIn = mode === "sign-in";
  return (
    <div className="min-h-[100dvh] bg-background text-foreground" data-testid={`auth-${mode}`}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5" aria-label="Muster Workforce Operations">
          <MusterMark className="h-7 w-7 shrink-0" />
          <span className="hidden text-[17px] font-semibold tracking-[-0.02em] sm:inline">Muster Workforce Operations</span>
          <span className="flex flex-col gap-[3px] sm:hidden">
            <span className="text-[16px] font-semibold leading-none tracking-[-0.02em]">Muster</span>
            <span className="font-mono text-[8.5px] uppercase leading-none tracking-[0.14em] text-muted-foreground">Workforce Operations</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={homeHref} className="mr-1 hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex">
            <ArrowLeft className="h-3.5 w-3.5" /> {t.back}
          </Link>
          <LangSwitcher className="rounded-full" />
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-4 sm:px-8 lg:min-h-[calc(100dvh-88px)] lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pt-0">
        <section className="hidden lg:block">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[16ch] text-[52px] font-semibold leading-[1.02] tracking-[-0.04em]">
            {isSignIn ? t.signInTitle : t.signUpTitle}
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
            {isSignIn ? t.signInLead : t.signUpLead}
          </p>
          <ul className="mt-9 space-y-3">
            {t.points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[15px]">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--accent))]" strokeWidth={2.5} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        <main className="mx-auto w-full max-w-[440px]">
          <div className="lg:hidden">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t.eyebrow}</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.03em]">
              {isSignIn ? t.signInTitle : t.signUpTitle}
            </h1>
          </div>
          <div className="mt-6 rounded-[28px] border border-card-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8 lg:mt-0">
            {children}
          </div>
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            {isSignIn ? t.noAccount : t.hasAccount}{" "}
            <Link href={switchHref} className="font-medium text-foreground underline underline-offset-4">
              {isSignIn ? t.createAccount : t.signIn}
            </Link>
          </p>
          {isSignIn ? <p className="mt-3 text-center text-[12px] text-muted-foreground">{t.sameMethod}</p> : null}
          <p className="mx-auto mt-6 max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">{t.footnote}</p>
        </main>
      </div>
    </div>
  );
}
