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

/**
 * RG-M05 — /en e /es são URLs públicas de idioma: a primeira tela já vem no
 * idioma da URL (e a escolha é persistida), em vez de cair no 404.
 */
export const LANG_PATHS: Record<string, Lang> = { "/en": "en", "/es": "es", "/pt": "pt" };

export function langFromPath(pathname: string): Lang | null {
  const limpo = pathname.replace(/\/+$/, "").toLowerCase();
  const ultimo = "/" + (limpo.split("/").pop() ?? "");
  return LANG_PATHS[ultimo] ?? null;
}

function initialLang(): Lang {
  try {
    const daUrl = langFromPath(window.location.pathname);
    if (daUrl) {
      window.localStorage.setItem(STORAGE_KEY, daUrl);
      return daUrl;
    }
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

/**
 * Deep-translates the strings of a static structure (arrays/objects) using a
 * pt→target dictionary. Strings missing from the dictionary pass through, so
 * colors, ids and numbers stay untouched.
 */
export function localize<T>(value: T, dict?: Record<string, string>): T {
  if (!dict) return value;
  if (typeof value === "string") return (dict[value] ?? value) as T;
  if (Array.isArray(value)) return value.map((v) => localize(v, dict)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = localize(v, dict);
    return out as T;
  }
  return value;
}
