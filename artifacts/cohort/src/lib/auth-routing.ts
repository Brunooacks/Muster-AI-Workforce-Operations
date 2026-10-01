export const DEFAULT_AUTH_REDIRECT = "/comando";
export const DEFAULT_ONBOARDING_REDIRECT = "/comando";

type AuthMode = "sign-in" | "sign-up";

export function locationWithBrowserSearch(location: string, search: string): string {
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  const normalizedSearch = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : "";
  return `${pathname}${normalizedSearch}`;
}

export function safeInternalRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "https://muster.local");
    if (url.origin !== "https://muster.local") return null;
    if (url.pathname === "/sign-in" || url.pathname.startsWith("/sign-in/")) return null;
    if (url.pathname === "/sign-up" || url.pathname.startsWith("/sign-up/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function requestedAuthRedirect(location: string): string | null {
  const query = location.split("?", 2)[1]?.split("#", 1)[0] ?? "";
  return safeInternalRedirect(new URLSearchParams(query).get("redirect_url"));
}

export function authRoute(mode: AuthMode, redirect?: string | null): string {
  const safeRedirect = safeInternalRedirect(redirect);
  return safeRedirect
    ? `/${mode}?redirect_url=${encodeURIComponent(safeRedirect)}`
    : `/${mode}`;
}

export function authFallbackFromLocation(location: string): string {
  return requestedAuthRedirect(location) ?? DEFAULT_AUTH_REDIRECT;
}

export function signedOutSignInPath(location: string): string {
  return authRoute("sign-in", safeInternalRedirect(location) ?? DEFAULT_AUTH_REDIRECT);
}

function isOnboardingPath(location: string): boolean {
  const pathname = location.split(/[?#]/, 1)[0];
  return pathname === "/onboarding" || pathname?.startsWith("/onboarding/") === true;
}

export function onboardingRoute(redirect?: string | null): string {
  const safeRedirect = safeInternalRedirect(redirect);
  return safeRedirect && !isOnboardingPath(safeRedirect)
    ? `/onboarding?redirect_url=${encodeURIComponent(safeRedirect)}`
    : "/onboarding";
}

export function onboardingFallbackFromLocation(location: string): string {
  const requested = requestedAuthRedirect(location);
  return requested && !isOnboardingPath(requested)
    ? requested
    : DEFAULT_ONBOARDING_REDIRECT;
}
