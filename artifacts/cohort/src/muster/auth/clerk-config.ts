import { esES, enUS, ptBR } from "@clerk/localizations";
import type { Lang } from "@/lib/i18n";
import { AUTH_COPY } from "./auth-copy";

/**
 * Aparência do Clerk ligada aos tokens do protótipo (index.css). As cores vêm
 * de variáveis CSS, então Claro e Noite trocam sozinhos com a classe .dark.
 */
export function musterClerkAppearance(basePath: string) {
  return {
    cssLayerName: "clerk",
    options: {
      logoPlacement: "none" as const,
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
    },
    variables: {
      colorPrimary: "hsl(var(--primary))",
      colorPrimaryForeground: "hsl(var(--primary-foreground))",
      colorForeground: "hsl(var(--foreground))",
      colorMutedForeground: "hsl(var(--muted-foreground))",
      colorMuted: "hsl(var(--muted))",
      colorDanger: "hsl(var(--destructive))",
      colorBackground: "hsl(var(--card))",
      colorInput: "hsl(var(--background))",
      colorInputForeground: "hsl(var(--foreground))",
      colorNeutral: "hsl(var(--foreground))",
      colorBorder: "hsl(var(--card-border))",
      colorRing: "hsl(var(--ring))",
      fontFamily: "var(--app-font-sans)",
      borderRadius: "0.75rem",
    },
    elements: {
      rootBox: "w-full",
      cardBox: "!w-full !max-w-none !shadow-none !border-0 !bg-transparent !rounded-none",
      card: "!shadow-none !border-0 !bg-transparent !p-0 !rounded-none",
      header: "!items-start !text-left !gap-1 !mb-2",
      headerTitle: "!text-[22px] !font-semibold !tracking-[-0.02em] !text-[hsl(var(--foreground))]",
      headerSubtitle: "!text-sm !text-[hsl(var(--muted-foreground))]",
      footer: "!bg-transparent !shadow-none",
      socialButtonsBlockButton:
        "!h-11 !rounded-full !border !border-[hsl(var(--card-border))] !bg-[hsl(var(--background))] hover:!bg-[hsl(var(--secondary))] !text-[hsl(var(--foreground))] !shadow-none",
      socialButtonsBlockButtonText: "!text-sm !font-medium",
      dividerText: "!font-mono !text-[10px] !uppercase !tracking-[0.18em] !text-[hsl(var(--muted-foreground))]",
      dividerLine: "!bg-[hsl(var(--card-border))]",
      formFieldLabel: "!text-[13px] !font-medium !text-[hsl(var(--foreground))]",
      formFieldInput:
        "!h-11 !rounded-xl !border !border-[hsl(var(--input))] !bg-[hsl(var(--background))] !shadow-none focus:!ring-2 focus:!ring-[hsl(var(--ring)/0.35)] focus:!border-[hsl(var(--ring))]",
      formButtonPrimary:
        "!h-11 !rounded-full !bg-[hsl(var(--primary))] hover:!opacity-90 !text-[hsl(var(--primary-foreground))] !text-sm !font-medium !shadow-none !normal-case",
      footerAction: "!hidden",
      footerActionText: "!text-[hsl(var(--muted-foreground))]",
      footerActionLink: "!text-[hsl(var(--foreground))] !font-medium underline underline-offset-4",
      formFieldAction: "!text-[hsl(var(--muted-foreground))] hover:!text-[hsl(var(--foreground))]",
      identityPreviewEditButton: "!text-[hsl(var(--foreground))]",
      otpCodeFieldInput: "!rounded-lg !border !border-[hsl(var(--input))]",
      alert: "!rounded-xl !border !border-[hsl(var(--destructive)/0.35)] !bg-[hsl(var(--destructive)/0.08)]",
    },
    layout: { logoLinkUrl: basePath || "/" },
  };
}

const BASE = { pt: ptBR, en: enUS, es: esES } as const;

/** Localização do Clerk por idioma, com os nossos textos por cima. */
export function musterClerkLocalization(lang: Lang) {
  const t = AUTH_COPY[lang];
  const base = BASE[lang] as Record<string, any>;
  return {
    ...base,
    socialButtonsBlockButton: { pt: "Continuar com {{provider|titleize}}", en: "Continue with {{provider|titleize}}", es: "Continuar con {{provider|titleize}}" }[lang],
    dividerText: t.or,
    formFieldLabel__emailAddress: t.email,
    formFieldLabel__password: t.password,
    formFieldInputPlaceholder__emailAddress: t.emailPlaceholder,
    formFieldInputPlaceholder__password: t.passwordPlaceholder,
    formFieldInputPlaceholder__signUpPassword: t.newPasswordPlaceholder,
    formButtonPrimary: t.continue,
    formFieldAction__forgotPassword: t.forgot,
    signIn: {
      ...base.signIn,
      start: { ...base.signIn?.start, title: t.cardSignInTitle, subtitle: t.cardSignInSubtitle, actionText: t.noAccount, actionLink: t.createAccount },
    },
    signUp: {
      ...base.signUp,
      start: { ...base.signUp?.start, title: t.cardSignUpTitle, subtitle: t.cardSignUpSubtitle, actionText: t.hasAccount, actionLink: t.signIn },
    },
  };
}
