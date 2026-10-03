/**
 * Fail closed: o modo convite só é desativado quando o valor é explicitamente
 * `false`. Ausente, vazio ou malformado mantém o cadastro público oculto.
 */
export function inviteOnlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "false";
}

export function inviteContactUrl(value: string | undefined): string | null {
  const url = value?.trim();
  return url ? url : null;
}
