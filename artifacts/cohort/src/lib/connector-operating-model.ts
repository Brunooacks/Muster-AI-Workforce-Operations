import type { Connector, ConnectorCapability } from "@workspace/api-client-react";

export type ConnectorEnvironment = "all" | "cloud" | "hybrid" | "local";

const PLATFORM_ALIASES: Record<string, string[]> = {
  zendesk: ["zendesk", "zendesk-ai"],
  agentforce: ["agentforce", "salesforce-agentforce"],
  "aws-bedrock-agentcore": ["aws-bedrock-agentcore", "aws-bedrock"],
  "google-vertex-agent-engine": ["google-vertex-agent-engine", "google-vertex-ai"],
  "openai-agents": ["openai-agents", "openai-assistants", "github-copilot"],
  otel: ["otel", "opentelemetry"],
};

export function connectorEnvironment(platform: string): Exclude<ConnectorEnvironment, "all"> {
  if (/docker|vllm/.test(platform)) return "local";
  if (/otel|opentelemetry|webhook|kubernetes|langgraph|crewai|openai-agents/.test(platform)) return "hybrid";
  return "cloud";
}

export function findConnectorForCapability(
  connectors: Connector[],
  capability: ConnectorCapability,
): Connector | undefined {
  const candidates = PLATFORM_ALIASES[capability.platform] ?? [capability.platform];
  return connectors.find((connector) => candidates.includes(connector.platform));
}
