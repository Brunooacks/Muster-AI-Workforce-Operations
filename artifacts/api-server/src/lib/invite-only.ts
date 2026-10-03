/**
 * O modo de convite falha fechado: fica ativo a menos que `MUSTER_INVITE_ONLY`
 * seja explicitamente `false` (maiúsculas e espaços são ignorados). Valores
 * ausentes, vazios ou malformados mantêm o cadastro restrito. Ambientes locais
 * que precisem de cadastro aberto devem definir `MUSTER_INVITE_ONLY=false`.
 */
export function inviteOnlyEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.MUSTER_INVITE_ONLY?.trim().toLowerCase() !== "false";
}
