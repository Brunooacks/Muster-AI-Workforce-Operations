import { createTenantScopeKey } from "./tenant-scope";

const ONBOARDING_PREFIX = "cohort:onboarding:";
const ADOPTION_PROGRESS_PREFIX = "cohort:adoption-progress:";

export function createOnboardingStorageKey(
  userId?: string | null,
  organizationId?: string | null,
): string | null {
  const scopeKey = createTenantScopeKey(userId, organizationId);
  return scopeKey ? ONBOARDING_PREFIX + scopeKey : null;
}

export function isOnboardingComplete(
  userId?: string | null,
  organizationId?: string | null,
): boolean {
  const storageKey = createOnboardingStorageKey(userId, organizationId);
  if (!storageKey) return true;
  try {
    return window.localStorage.getItem(storageKey) === "done";
  } catch {
    return true;
  }
}

export function completeOnboarding(
  userId?: string | null,
  organizationId?: string | null,
): void {
  const storageKey = createOnboardingStorageKey(userId, organizationId);
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, "done");
  } catch {
    /* ignore storage errors */
  }
}

export function createAdoptionProgressStorageKey(
  userId?: string | null,
  organizationId?: string | null,
): string | null {
  const scopeKey = createTenantScopeKey(userId, organizationId);
  return scopeKey ? ADOPTION_PROGRESS_PREFIX + scopeKey : null;
}

export function readAdoptionProgress(
  userId?: string | null,
  organizationId?: string | null,
): string[] {
  const storageKey = createAdoptionProgressStorageKey(userId, organizationId);
  if (!storageKey) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveAdoptionProgress(
  watchedClipIds: string[],
  userId?: string | null,
  organizationId?: string | null,
): void {
  const storageKey = createAdoptionProgressStorageKey(userId, organizationId);
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...new Set(watchedClipIds)]));
  } catch {
    /* ignore storage errors */
  }
}
