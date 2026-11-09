import { useLang } from "@/lib/i18n";
import { AUTH_COPY } from "./auth-copy";

/**
 * Réplica estática do primeiro passo do Clerk, usada só na prévia sem chave
 * (Cloudflare Pages). No app, o cartão real é o <SignIn/>/<SignUp/> do Clerk
 * com a mesma aparência (clerk-config.ts).
 */
export function AuthCardPreview({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { lang } = useLang();
  const t = AUTH_COPY[lang];
  const signIn = mode === "sign-in";
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{signIn ? t.cardSignInTitle : t.cardSignUpTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{signIn ? t.cardSignInSubtitle : t.cardSignUpSubtitle}</p>
      </div>
      <button type="button" className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-card-border bg-background text-sm font-medium hover:bg-secondary">
        <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        {t.google}
      </button>
      <button type="button" className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-card-border bg-background text-sm font-medium hover:bg-secondary">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        {t.github}
      </button>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-card-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t.or}</span>
        <span className="h-px flex-1 bg-card-border" />
      </div>
      <label className="block">
        <span className="text-[13px] font-medium">{t.email}</span>
        <input type="email" placeholder={t.emailPlaceholder} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none focus:border-[hsl(var(--ring))] focus:ring-2 focus:ring-[hsl(var(--ring)/0.35)]" />
      </label>
      <label className="block">
        <span className="flex items-center justify-between text-[13px] font-medium">
          {t.password}
          {signIn ? <span className="font-normal text-muted-foreground">{t.forgot}</span> : null}
        </span>
        <input type="password" placeholder={signIn ? t.passwordPlaceholder : t.newPasswordPlaceholder} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none focus:border-[hsl(var(--ring))] focus:ring-2 focus:ring-[hsl(var(--ring)/0.35)]" />
      </label>
      <button type="submit" className="h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground hover:opacity-90">{t.continue}</button>
      {!signIn ? <p className="text-center text-[11px] leading-relaxed text-muted-foreground">{t.terms}</p> : null}
    </form>
  );
}
