import type {
  ConnectorCredential,
  ConnectorImpl,
  ConnectorTestResult,
  DiscoveredAgentCandidate,
} from "../types";
import { createLangfuseClient, LangfuseClientError } from "./client";
import { parseLangfuseCredential } from "./credential";
import { pullLangfuseWindow } from "./pull-window";

const DISCOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export const langfuseConnector: ConnectorImpl = {
  platform: "langfuse",
  displayName: "Langfuse",

  async testConnection(cred: ConnectorCredential): Promise<ConnectorTestResult> {
    try {
      const credential = await parseLangfuseCredential(cred.token);
      const projects = await createLangfuseClient({ credential }).listProjects();
      const project = projects[0];
      if (!project) {
        return { ok: false, message: "Nenhum projeto Langfuse foi encontrado para estas chaves." };
      }
      return { ok: true, message: `Conectado ao projeto ${project.name}` };
    } catch (error) {
      if (error instanceof LangfuseClientError && error.code === "langfuse_unauthorized") {
        return { ok: false, message: "Chaves do Langfuse inválidas ou sem acesso ao projeto." };
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível conectar ao Langfuse.",
      };
    }
  },

  async discoverAgents(cred: ConnectorCredential): Promise<DiscoveredAgentCandidate[]> {
    let credential;
    try {
      credential = await parseLangfuseCredential(cred.token);
    } catch {
      return [];
    }
    const to = new Date();
    const from = new Date(to.getTime() - DISCOVERY_WINDOW_MS);
    const pulled = await pullLangfuseWindow(createLangfuseClient({ credential }), { from, to });
    const counts = new Map<string, number>();
    for (const trace of pulled.traces) {
      const traceName = trace.observations.find(
        (observation) => typeof observation.traceName === "string" && observation.traceName.trim(),
      )?.traceName as string | undefined;
      if (traceName) counts.set(traceName, (counts.get(traceName) ?? 0) + 1);
    }

    return [...counts.entries()].map(([traceName, count]) => ({
      externalId: `langfuse:${pulled.projectId}:${traceName}`,
      name: traceName,
      description: `Trace Langfuse ${traceName}.`,
      stack: "langfuse",
      url: null,
      signals: ["langfuse:trace-name", `traces:${count}`],
      confidence: 60,
    }));
  },
};
