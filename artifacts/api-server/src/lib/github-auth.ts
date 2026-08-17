function envToken(): string | null {
  const token =
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.GITHUB_ACCESS_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

export function getGitHubAccessToken(): string | null {
  return envToken();
}

export type GitHubCredentialSource = "token" | "none";

export function getGitHubStatus(): {
  connected: boolean;
  source: GitHubCredentialSource;
} {
  return envToken()
    ? { connected: true, source: "token" }
    : { connected: false, source: "none" };
}
