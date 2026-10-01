import { readFileSync } from "node:fs";

export function requireMusterSessionToken(
  environment: NodeJS.ProcessEnv = process.env,
  tokenFile?: string,
): string {
  const token = tokenFile
    ? readFileSync(tokenFile, "utf8").trim()
    : environment.MUSTER_AUTH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "MUSTER_AUTH_TOKEN ou --token-file é obrigatório. Entre no Muster com Clerk e forneça um token de sessão válido.",
    );
  }
  return token;
}
