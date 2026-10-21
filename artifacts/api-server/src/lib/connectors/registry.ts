import type { ConnectorImpl } from "./types";
import { githubConnector } from "./github";
import { langfuseConnector } from "./langfuse/connector";
import { CONNECTOR_CAPABILITIES } from "./capabilities";

// Platforms with a real implementation. Everything else stays on the demo
// catalog (PLATFORM_CATALOG) and is labeled as such by the API/UI.
const REGISTRY = new Map<string, ConnectorImpl>([
  [githubConnector.platform, githubConnector],
  [langfuseConnector.platform, langfuseConnector],
]);

export function getConnectorImpl(platform: string): ConnectorImpl | undefined {
  return REGISTRY.get(platform);
}

export function realPlatforms(): string[] {
  return [...REGISTRY.keys()];
}

export function formatRealPlatforms(): string {
  return `Disponível: ${realPlatforms().join(", ")}.`;
}

export function connectorCapabilities() {
  return CONNECTOR_CAPABILITIES;
}
