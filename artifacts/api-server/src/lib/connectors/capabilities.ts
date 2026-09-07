import type { ConnectorCapabilities } from "./types";

export interface ConnectorCapabilityEntry {
  platform: string;
  label: string;
  mode: "live" | "contract-ready" | "planned";
  capabilities: ConnectorCapabilities;
  transport: string[];
  note: string;
}

const noDiscovery = {
  testConnection: false,
  discoverAgents: false,
  collectTelemetry: false,
  collectMetrics: false,
  sendFeedback: false,
  exportDecisions: false,
} satisfies ConnectorCapabilities;

export const CONNECTOR_CAPABILITIES: ConnectorCapabilityEntry[] = [
  {
    platform: "github",
    label: "GitHub",
    mode: "live",
    capabilities: {
      ...noDiscovery,
      testConnection: true,
      discoverAgents: true,
    },
    transport: ["REST polling"],
    note: "Descoberta real de repositórios e pré-assessment de agentes.",
  },
  {
    platform: "webhook",
    label: "Webhook universal",
    mode: "live",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["HTTPS JSON", "batch", "event-driven"],
    note: "Contrato recomendado para Zendesk, Agentforce e runtimes próprios.",
  },
  {
    platform: "otel",
    label: "OpenTelemetry",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
    },
    transport: ["OTLP gateway", "collector"],
    note: "Mapeia traces e métricas para o envelope do Muster; adapter OTLP dedicado é o próximo passo.",
  },
  {
    platform: "zendesk",
    label: "Zendesk AI",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["incremental REST export", "webhook"],
    note: "Coleta via contrato universal; polling, credencial e feedback nativos ainda dependem do adapter Zendesk.",
  },
  {
    platform: "agentforce",
    label: "Salesforce Agentforce",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["Agent API", "OpenAPI action", "webhook"],
    note: "Sessões e métricas entram pelo contrato universal; ações e credenciais Salesforce dependem do adapter dedicado.",
  },
  {
    platform: "aws-bedrock-agentcore",
    label: "AWS Bedrock AgentCore",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["CloudWatch", "OTLP", "AWS SDK"],
    note: "Recebe traces, latência, tokens, erros e custo normalizados; CloudWatch e AWS SDK nativos ainda estão no roadmap.",
  },
  {
    platform: "azure-ai-foundry",
    label: "Microsoft Foundry Agent Service",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["Azure Monitor", "Application Insights", "OTLP"],
    note: "Recebe tracing e avaliações normalizados; Azure Monitor e Application Insights nativos ainda estão no roadmap.",
  },
  {
    platform: "google-vertex-agent-engine",
    label: "Google Vertex AI Agent Engine",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["Cloud Logging", "Cloud Monitoring", "OTLP"],
    note: "Recebe sessões e avaliações normalizadas; Cloud Logging e Monitoring nativos ainda estão no roadmap.",
  },
  {
    platform: "databricks-mosaic-ai",
    label: "Databricks Mosaic AI",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["MLflow Tracing", "Lakehouse", "OTLP"],
    note: "Recebe avaliação e traces normalizados; MLflow e Lakehouse nativos ainda estão no roadmap.",
  },
  {
    platform: "snowflake-cortex-agents",
    label: "Snowflake Cortex Agents",
    mode: "planned",
    capabilities: noDiscovery,
    transport: ["Snowflake events", "SQL", "webhook"],
    note: "Adapter planejado para workloads agentic com governança e dados dentro do warehouse.",
  },
  {
    platform: "ibm-watsonx",
    label: "IBM watsonx Orchestrate",
    mode: "planned",
    capabilities: noDiscovery,
    transport: ["REST API", "webhook", "OpenTelemetry"],
    note: "Adapter planejado para automação enterprise, skills, handoffs e aprovação humana.",
  },
  {
    platform: "servicenow-ai",
    label: "ServiceNow AI Agents",
    mode: "planned",
    capabilities: noDiscovery,
    transport: ["Table API", "IntegrationHub", "webhook"],
    note: "Adapter planejado para ITSM, resolução, escalonamento, SLA e aprovação operacional.",
  },
  {
    platform: "openai-agents",
    label: "OpenAI Agents / Responses",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["SDK", "traces", "webhook"],
    note: "Integração real por reporter ou envelope normalizado; exportação nativa de traces ainda exige uma bridge.",
  },
  {
    platform: "langgraph",
    label: "LangGraph / LangChain",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["SDK", "LangSmith export", "OTLP"],
    note: "Runs, tool calls, custo e avaliação entram pelo reporter; exportação LangSmith nativa ainda não está implementada.",
  },
  {
    platform: "crewai",
    label: "CrewAI",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["SDK", "webhook", "OTLP"],
    note: "Foco em tarefas, agentes, delegação, falhas e custo por crew.",
  },
  {
    platform: "llamaindex",
    label: "LlamaIndex",
    mode: "contract-ready",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["instrumentation", "OTLP", "webhook"],
    note: "Foco em retrieval, grounding, latência, qualidade e custo de inferência.",
  },
  {
    platform: "dify",
    label: "Dify",
    mode: "planned",
    capabilities: noDiscovery,
    transport: ["REST API", "webhook", "self-hosted"],
    note: "Adapter planejado para aplicações e workflows self-hosted.",
  },
  {
    platform: "n8n",
    label: "n8n AI Workflows",
    mode: "planned",
    capabilities: noDiscovery,
    transport: ["webhook", "execution API", "self-hosted"],
    note: "Adapter planejado para workflows híbridos e automações com aprovação humana.",
  },
  {
    platform: "kubernetes-otel",
    label: "Kubernetes / Runtime próprio",
    mode: "live",
    capabilities: {
      ...noDiscovery,
      collectTelemetry: true,
      collectMetrics: true,
    },
    transport: ["HTTPS JSON", "OTLP", "batch"],
    note: "Integração imediata por contrato universal para cloud, on-premise e edge.",
  },
];
