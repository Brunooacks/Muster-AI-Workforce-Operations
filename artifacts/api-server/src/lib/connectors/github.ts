import type {
  ConnectorCredential,
  ConnectorImpl,
  ConnectorTestResult,
  DiscoveredAgentCandidate,
} from "./types";
import { getGitHubAccessToken } from "../github-auth";
import { logger } from "../logger";

const API = "https://api.github.com";
const MAX_REPOS = 60; // discovery guardrail — first N most recently pushed

// Dependency/topic/path signals that mark a repo as an AI agent. Each hit adds
// weight; candidates below the floor are dropped.
const DEP_SIGNALS: Array<{ pattern: RegExp; label: string; stack: string; weight: number }> = [
  { pattern: /"langchain"|"@langchain\//, label: "dep:langchain", stack: "langchain", weight: 45 },
  { pattern: /"@anthropic-ai\/sdk"|"@anthropic-ai\/claude-agent-sdk"/, label: "dep:anthropic", stack: "anthropic-claude", weight: 45 },
  { pattern: /"openai"/, label: "dep:openai", stack: "openai", weight: 35 },
  { pattern: /"crewai"|"crewai-tools"/, label: "dep:crewai", stack: "crewai", weight: 45 },
  { pattern: /"autogen"|"ag2"/, label: "dep:autogen", stack: "autogen", weight: 45 },
  { pattern: /"@copilot-extensions\/|"@github\/copilot/, label: "dep:copilot-extension", stack: "github-copilot", weight: 45 },
];

const TOPIC_SIGNALS: Record<string, { label: string; weight: number }> = {
  "ai-agent": { label: "topic:ai-agent", weight: 40 },
  "ai-agents": { label: "topic:ai-agents", weight: 40 },
  agent: { label: "topic:agent", weight: 20 },
  llm: { label: "topic:llm", weight: 20 },
  langchain: { label: "topic:langchain", weight: 35 },
  copilot: { label: "topic:copilot", weight: 25 },
};

const NAME_HINTS = /agent|bot|copilot|assistant|triage|reviewer|guardian/i;
const CONFIDENCE_FLOOR = 35;

async function gh<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    if (res.status !== 404) {
      logger.warn({ path, status: res.status }, "GitHub API request failed");
    }
    return null;
  }
  return (await res.json()) as T;
}

async function resolveToken(cred: ConnectorCredential): Promise<string | null> {
  if (cred.token && cred.token.trim()) return cred.token.trim();
  // Fall back to the ambient credential (GITHUB_TOKEN env / managed connector).
  return getGitHubAccessToken();
}

interface RepoInfo {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  topics?: string[];
  archived: boolean;
  fork: boolean;
}

export const githubConnector: ConnectorImpl = {
  platform: "github",
  displayName: "GitHub",

  async testConnection(cred): Promise<ConnectorTestResult> {
    const token = await resolveToken(cred);
    if (!token) {
      return {
        ok: false,
        message:
          "Nenhuma credencial disponível. Informe um token (PAT com escopo repo:read) ou configure GITHUB_TOKEN.",
      };
    }
    const user = await gh<{ login: string }>("/user", token);
    if (!user) return { ok: false, message: "Token inválido ou sem permissão." };
    const repos = await gh<RepoInfo[]>("/user/repos?per_page=1", token);
    return {
      ok: true,
      message: `Conectado como @${user.login}${repos ? " · acesso a repositórios confirmado" : ""}.`,
    };
  },

  async discoverAgents(cred): Promise<DiscoveredAgentCandidate[]> {
    const token = await resolveToken(cred);
    if (!token) return [];

    const repos =
      (await gh<RepoInfo[]>(
        `/user/repos?per_page=${MAX_REPOS}&sort=pushed&affiliation=owner,collaborator,organization_member`,
        token,
      )) ?? [];

    const candidates: DiscoveredAgentCandidate[] = [];
    for (const repo of repos) {
      if (repo.archived || repo.fork) continue;

      const signals: string[] = [];
      let confidence = 0;
      let stack: string | null = null;

      for (const topic of repo.topics ?? []) {
        const hit = TOPIC_SIGNALS[topic];
        if (hit) {
          signals.push(hit.label);
          confidence += hit.weight;
        }
      }
      if (NAME_HINTS.test(repo.name) || NAME_HINTS.test(repo.description ?? "")) {
        signals.push("name:agent-hint");
        confidence += 15;
      }

      // Inspect the root package.json for agent-framework dependencies. One
      // extra request per repo, bounded by MAX_REPOS.
      const pkg = await gh<{ content?: string }>(
        `/repos/${repo.full_name}/contents/package.json`,
        token,
      );
      if (pkg?.content) {
        const text = Buffer.from(pkg.content, "base64").toString("utf8");
        for (const dep of DEP_SIGNALS) {
          if (dep.pattern.test(text)) {
            signals.push(dep.label);
            confidence += dep.weight;
            stack = stack ?? dep.stack;
          }
        }
      }

      // Monorepos keep framework deps in subpackages — the README is the
      // cheapest reliable signal for those (one extra request per repo).
      if (confidence < CONFIDENCE_FLOOR) {
        const readme = await gh<{ content?: string }>(
          `/repos/${repo.full_name}/readme`,
          token,
        );
        if (readme?.content) {
          const text = Buffer.from(readme.content, "base64").toString("utf8").slice(0, 20_000);
          if (/langchain|@anthropic-ai|crewai|autogen|copilot extension/i.test(text)) {
            signals.push("readme:framework");
            confidence += 25;
            stack =
              stack ??
              (/langchain/i.test(text)
                ? "langchain"
                : /@anthropic-ai/i.test(text)
                  ? "anthropic-claude"
                  : null);
          }
          if (/ai agents?|agentes? de ia\b/i.test(text)) {
            signals.push("readme:ai-agent");
            confidence += 15;
          }
        }
      }

      if (confidence >= CONFIDENCE_FLOOR) {
        candidates.push({
          externalId: repo.full_name,
          name: repo.name,
          description: repo.description ?? "",
          stack,
          url: repo.html_url,
          signals,
          confidence: Math.min(100, confidence),
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  },
};
