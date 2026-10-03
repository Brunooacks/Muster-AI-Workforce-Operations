/**
 * O modo de convite é deliberadamente opt-in. Valores ausentes ou malformados
 * não podem bloquear o acesso por acidente durante uma recuperação operacional.
 */
export function inviteOnlyEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.MUSTER_INVITE_ONLY?.trim().toLowerCase() === "true";
}
