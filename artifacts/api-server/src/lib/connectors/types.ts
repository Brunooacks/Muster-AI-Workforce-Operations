/**
 * Connector SPI — every real platform integration implements this interface.
 * The registry maps a platform key to its implementation; platforms without
 * one fall back to the demo catalog (clearly labeled in the UI).
 */

export interface ConnectorCredential {
  /** Raw secret (PAT, API key). Never serialized in API responses. */
  token: string | null;
}

export interface DiscoveredAgentCandidate {
  /** Stable external identifier on the source platform (e.g. "org/repo"). */
  externalId: string;
  name: string;
  /** Short role/description inferred from the source. */
  description: string;
  /** Detected agent stack, e.g. "langchain", "anthropic-claude", "crewai". */
  stack: string | null;
  /** URL a human can open (repo page, agent console). */
  url: string | null;
  /** Signals that led to detection, e.g. ["dep:langchain", "dir:agents/"]. */
  signals: string[];
  /** 0-100 — how confident the heuristic is that this is an AI agent. */
  confidence: number;
}

export interface ConnectorTestResult {
  ok: boolean;
  /** Human-readable pt-BR message ("Conectado como @user, 42 repositórios"). */
  message: string;
}

export interface ConnectorImpl {
  platform: string;
  displayName: string;
  /** Validates the credential against the live platform. */
  testConnection(cred: ConnectorCredential): Promise<ConnectorTestResult>;
  /** Lists agent candidates found on the platform. */
  discoverAgents(cred: ConnectorCredential): Promise<DiscoveredAgentCandidate[]>;
}
