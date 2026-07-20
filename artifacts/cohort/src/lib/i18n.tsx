import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Muster i18n — pt (default) / en / es.
 *
 * Pattern: each page keeps its OWN dictionary (like carteiraI18n already did
 * for audiences) typed as Record<Lang, Shape>, and reads the active language
 * via useLang(). No central key registry — pages stay self-contained and
 * translations live next to the screens they describe.
 *
 * The choice persists in localStorage and applies instantly (context re-render).
 */

export type Lang = "pt" | "en" | "es";

export const LANGS: Array<{ code: Lang; label: string; flag: string }> = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const STORAGE_KEY = "muster:lang";

function initialLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "pt" || stored === "en" || stored === "es") return stored;
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("en")) return "en";
    if (nav.startsWith("es")) return "es";
  } catch {
    /* SSR/storage indisponível */
  }
  return "pt";
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "pt",
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : lang;
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Locale for number/date formatting consistent with the active language. */
export function localeOf(lang: Lang): string {
  return lang === "pt" ? "pt-BR" : lang === "en" ? "en-US" : "es-ES";
}
