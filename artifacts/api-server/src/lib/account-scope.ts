/**
 * Conta da empresa x conta pessoal (fase 1 da área logada).
 *
 * A conta (account_id) é a própria organização local: toda consulta já filtra
 * por org_id (ver tenant-scope.ts), então a conta pessoal herda o mesmo
 * isolamento sem tabela nova. A regra que este módulo fixa:
 *  - com organização ativa na sessão → conta da empresa;
 *  - sem organização ativa → conta pessoal do usuário (externalId personal:<userId>);
 *  - a conta pessoal nunca é escolhida quando há uma organização ativa, e
 *    nunca entra no fallback de "vínculo único" das contas de empresa.
 */
export type AccountKind = "company" | "personal";

export const PERSONAL_PREFIX = "personal:";

export function personalExternalId(userId: string): string {
  const id = userId.trim();
  if (!id) throw new Error("userId obrigatório para a conta pessoal.");
  return `${PERSONAL_PREFIX}${id}`;
}

export function isPersonalExternalId(externalId: string | null | undefined): boolean {
  return typeof externalId === "string" && externalId.startsWith(PERSONAL_PREFIX);
}

export function resolveAccountKind(activeOrganizationId: string | null | undefined): AccountKind {
  return activeOrganizationId ? "company" : "personal";
}

/** Slug estável e não adivinhável a partir do nome da pessoa. */
export function personalSlug(userId: string): string {
  const safe = userId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `pessoal-${safe || "conta"}`;
}
