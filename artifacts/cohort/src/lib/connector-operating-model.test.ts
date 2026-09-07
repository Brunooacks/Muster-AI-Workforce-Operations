import test from "node:test";
import assert from "node:assert/strict";
import type { Connector, ConnectorCapability } from "@workspace/api-client-react";
import { connectorEnvironment, findConnectorForCapability } from "./connector-operating-model";

test("classifica runtimes cloud, híbridos e locais", () => {
  assert.equal(connectorEnvironment("aws-bedrock-agentcore"), "cloud");
  assert.equal(connectorEnvironment("opentelemetry"), "hybrid");
  assert.equal(connectorEnvironment("kubernetes"), "hybrid");
  assert.equal(connectorEnvironment("vllm-local"), "local");
  assert.equal(connectorEnvironment("docker-runner"), "local");
});

test("resolve aliases entre capability e conector persistido", () => {
  const connectors = [
    { id: "zendesk-1", platform: "zendesk-ai" },
    { id: "agentforce-1", platform: "salesforce-agentforce" },
  ] as Connector[];

  assert.equal(findConnectorForCapability(connectors, { platform: "zendesk" } as ConnectorCapability)?.id, "zendesk-1");
  assert.equal(findConnectorForCapability(connectors, { platform: "agentforce" } as ConnectorCapability)?.id, "agentforce-1");
});

test("retorna undefined quando o tenant ainda não ativou a capability", () => {
  assert.equal(findConnectorForCapability([], { platform: "github" } as ConnectorCapability), undefined);
});
