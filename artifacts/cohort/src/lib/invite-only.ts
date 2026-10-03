export function inviteOnlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function inviteContactUrl(value: string | undefined): string | null {
  const url = value?.trim();
  return url ? url : null;
}
