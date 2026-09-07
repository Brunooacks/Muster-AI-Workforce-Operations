import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const captureRoot = path.resolve(repositoryRoot, "videos", "muster-workforce-capture-app");

const captureConnectors = [
  {
    id: "github-primary",
    platform: "github",
    name: "GitHub Engineering",
    status: "connected",
    mode: "native",
    health: "healthy",
    agentsDiscovered: 4,
    category: "Adapter nativo",
    lastSyncAt: "2026-09-02T18:42:00Z",
    lastTestedAt: "2026-09-02T18:41:00Z",
    lastEventAt: null,
    nextAction: "Executar discovery e selecionar os agentes para admissão.",
  },
  {
    id: "zendesk-support",
    platform: "zendesk",
    name: "Zendesk Support",
    status: "connected",
    mode: "universal",
    health: "healthy",
    agentsDiscovered: 3,
    category: "Contrato universal",
    lastSyncAt: null,
    lastTestedAt: "2026-09-02T18:38:00Z",
    lastEventAt: "2026-09-02T18:39:00Z",
    nextAction: "Acompanhar freshness, cobertura e qualidade dos eventos.",
  },
  {
    id: "aws-runtime",
    platform: "aws-bedrock-agentcore",
    name: "AWS Bedrock · Produção",
    status: "configured",
    mode: "universal",
    health: "unverified",
    agentsDiscovered: 0,
    category: "Contrato universal",
    lastSyncAt: null,
    lastTestedAt: "2026-09-02T18:35:00Z",
    lastEventAt: null,
    nextAction: "Enviar o primeiro evento real para comprovar a conexão.",
  },
  {
    id: "local-runtime",
    platform: "kubernetes-otel",
    name: "Runtime local · GPU",
    status: "connected",
    mode: "runtime",
    health: "healthy",
    agentsDiscovered: 2,
    category: "Ingestão operacional",
    lastSyncAt: null,
    lastTestedAt: "2026-09-02T18:32:00Z",
    lastEventAt: "2026-09-02T18:40:00Z",
    nextAction: "Acompanhar freshness, cobertura e qualidade dos eventos.",
  },
];

const captureCapabilities = [
  ["github", "GitHub", "live", "REST polling", "Discovery e importação reais de repositórios e stacks agentic."],
  ["webhook", "Webhook universal", "live", "HTTPS JSON · batch · event-driven", "Envelope autenticado para qualquer runtime ou plataforma."],
  ["zendesk", "Zendesk AI", "contract-ready", "incremental REST export · webhook", "Coleta pelo contrato universal; adapter nativo ainda não implementado."],
  ["agentforce", "Salesforce Agentforce", "contract-ready", "Agent API · webhook", "Sessões e métricas entram pelo contrato universal."],
  ["aws-bedrock-agentcore", "AWS Bedrock AgentCore", "contract-ready", "CloudWatch · OTLP · AWS SDK", "Traces e custos normalizados pelo contrato universal."],
  ["azure-ai-foundry", "Microsoft Foundry Agent Service", "contract-ready", "Azure Monitor · OTLP", "Tracing e avaliações normalizados pelo contrato universal."],
  ["google-vertex-agent-engine", "Google Vertex AI Agent Engine", "contract-ready", "Cloud Logging · OTLP", "Sessões e avaliações normalizadas pelo contrato universal."],
  ["openai-agents", "OpenAI Agents / Responses", "contract-ready", "SDK · traces · webhook", "Execuções entram por reporter ou envelope normalizado."],
  ["langgraph", "LangGraph / LangChain", "contract-ready", "SDK · LangSmith export · OTLP", "Runs, tool calls, custo e avaliação pelo reporter."],
  ["kubernetes-otel", "Kubernetes / Runtime próprio", "live", "HTTPS JSON · OTLP · batch", "Integração imediata para cloud, on-premise, GPU local e edge."],
  ["snowflake-cortex-agents", "Snowflake Cortex Agents", "planned", "Snowflake events · SQL", "Adapter planejado para workloads agentic no warehouse."],
].map(([platform, label, mode, transport, note]) => ({
  platform,
  label,
  mode,
  capabilities: {
    testConnection: platform === "github",
    discoverAgents: platform === "github",
    collectTelemetry: mode !== "planned" && platform !== "github",
    collectMetrics: mode !== "planned" && platform !== "github",
    sendFeedback: false,
    exportDecisions: false,
  },
  transport: transport.split(" · "),
  note,
}));

const captureAlerts = [
  {
    id: "alert-quality-drift",
    agentId: "sofia",
    agentName: "Sofia",
    pattern: "Qualidade aparente cresceu enquanto a cobertura caiu",
    patternType: "quality_coverage_divergence",
    severity: "critical",
    hypothesis: "A taxa de sucesso considera apenas casos concluídos e exclui uma parcela crescente das solicitações difíceis.",
    recommendation: "Recalibrar a amostra, restaurar cobertura mínima de 95% e revisar os casos excluídos com a supervisora.",
    detectedAt: "2026-09-02T17:10:00Z",
    status: "acknowledged",
    assignedTo: "Marina Costa",
    dueAt: "2026-09-04T23:59:59.999Z",
    acknowledgedAt: "2026-09-02T17:28:00Z",
    resolvedAt: null,
  },
  {
    id: "alert-cost-latency",
    agentId: "theo",
    agentName: "Théo",
    pattern: "Custo por resolução subiu sem ganho de eficácia",
    patternType: "cost_effectiveness_divergence",
    severity: "high",
    hypothesis: "Chamadas redundantes de ferramenta aumentaram custo e latência nos fluxos de cobrança.",
    recommendation: "Limitar retentativas, comparar a coorte anterior e validar a mudança por dois ciclos.",
    detectedAt: "2026-09-02T15:32:00Z",
    status: "active",
    assignedTo: "Felipe Costa",
    dueAt: "2026-09-06T23:59:59.999Z",
    acknowledgedAt: null,
    resolvedAt: null,
  },
  {
    id: "alert-human-load",
    agentId: "diego",
    agentName: "Diego",
    pattern: "A automação deslocou carga para a revisão humana",
    patternType: "automation_load_shift",
    severity: "antecedent",
    hypothesis: "O agente encerra etapas mais rápido, mas transfere contexto incompleto para a triagem jurídica.",
    recommendation: "Exigir evidência mínima no handoff antes de ampliar a autonomia da etapa.",
    detectedAt: "2026-09-01T20:05:00Z",
    status: "active",
    assignedTo: null,
    dueAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
  },
];

const comparison = (
  current: number,
  previous: number,
  unit: string,
  direction: "higher-is-better" | "lower-is-better" = "higher-is-better",
) => ({
  current,
  previous,
  delta: Number((current - previous).toFixed(2)),
  deltaPercent: previous === 0 ? null : Number((((current - previous) / previous) * 100).toFixed(1)),
  unit,
  direction,
});

const captureReport = {
  id: "report-2026-09-v1",
  period: "2026-09",
  previousPeriod: "2026-08",
  version: 1,
  status: "published",
  title: "Força de trabalho de IA · Setembro 2026",
  executiveSummary: "A operação elevou eficácia e cobertura de governança, enquanto dois profissionais digitais seguem com plano de recalibração acompanhado por responsáveis humanos.",
  generatedAt: "2026-09-02T18:45:00Z",
  sourceWatermark: "2026-09-02T18:42:00Z",
  narrativeSource: "deterministic",
  narrativeModel: null,
  promptVersion: null,
  templateId: "board-brief",
  metrics: {
    operationalScore: comparison(88, 82, "%"),
    executionCount: comparison(48_720, 41_380, "execuções"),
    successRate: comparison(94, 91, "%"),
    averageDurationMs: comparison(820, 960, "ms", "lower-is-better"),
    costPerExecutionCents: comparison(18, 21, "centavos", "lower-is-better"),
    escalationRate: comparison(7, 10, "%", "lower-is-better"),
    errorRate: comparison(2.4, 3.8, "%", "lower-is-better"),
  },
  layerComparison: {
    efficacy: comparison(92, 87, "%"),
    efficiency: comparison(86, 81, "%"),
    adoption: comparison(84, 76, "%"),
    governance: comparison(96, 88, "%"),
    value: comparison(89, 84, "%"),
  },
  portfolio: {
    totalAgents: 12,
    activeAgents: 9,
    newAgents: 3,
    agentsWithExecution: 11,
    activeAlerts: 4,
    criticalAlerts: 1,
    verdicts: { promote: 5, mentor: 4, retire: 1, observation: 2 },
  },
  quality: {
    score: 94,
    dataCoverage: 97,
    evaluationConfidence: 92,
    decisionReady: true,
    limitations: [],
  },
  sections: [
    {
      key: "outcomes",
      title: "Resultados do período",
      summary: "A melhora de desempenho permanece ligada ao propósito contratado de cada função.",
      highlights: ["Sucesso subiu 3 pp", "Latência média caiu 15%", "Adoção recorrente chegou a 84%"],
      evidenceRefs: ["metric:success-rate", "metric:duration", "metric:adoption"],
    },
    {
      key: "risk-governance",
      title: "Risco e governança",
      summary: "Cobertura de telemetria e decisões auditáveis reduziram a incerteza operacional.",
      highlights: ["97% de cobertura", "1 alerta crítico com owner", "100% das decisões com justificativa"],
      evidenceRefs: ["quality:data-coverage", "alerts:critical", "decisions:audit"],
    },
    {
      key: "decisions",
      title: "Decisões e responsáveis",
      summary: "Dois planos de desenvolvimento foram aprovados com SLA e revisão em dois ciclos.",
      highlights: ["Sofia: recalibrar base de conhecimento", "Diego: reduzir handoff jurídico"],
      evidenceRefs: ["decision:sofia", "decision:diego"],
    },
    {
      key: "outlook",
      title: "Próximos compromissos",
      summary: "Validar os planos aprovados com evidência de duas janelas consecutivas.",
      highlights: ["Revisão executiva em 15 dias", "Expandir cobertura do runtime AWS"],
      evidenceRefs: ["review:next", "connector:aws-runtime"],
    },
  ],
  insights: [
    {
      id: "insight-1",
      category: "performance",
      title: "Qualidade cresce com menor escalonamento",
      narrative: "A taxa de sucesso avançou enquanto os handoffs humanos diminuíram, sem perda de governança.",
      recommendation: "Ampliar a coorte validada e manter revisão humana nos casos de maior risco.",
      severity: "positive",
      confidence: 93,
      evidenceRefs: ["metric:success-rate", "metric:escalation-rate"],
    },
    {
      id: "insight-2",
      category: "connectivity",
      title: "AWS ainda sem prova operacional",
      narrative: "A credencial existe, mas nenhum evento real chegou ao tenant no período.",
      recommendation: "Enviar o primeiro envelope autenticado antes de incluir o runtime no score consolidado.",
      severity: "medium",
      confidence: 100,
      evidenceRefs: ["connector:aws-runtime"],
    },
  ],
};

function captureApiMock() {
  return {
    name: "muster-video-capture-api",
    configureServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        const payload = pathname === "/api/connectors/capabilities"
          ? captureCapabilities
          : pathname === "/api/connectors"
            ? captureConnectors
            : pathname === "/api/fleet/alerts"
              ? captureAlerts
            : pathname?.startsWith("/api/professionals/") && pathname.endsWith("/development-plan/decisions")
              ? []
            : pathname === "/api/executive-reports/monthly"
              ? {
                  reports: [{
                    id: captureReport.id,
                    period: captureReport.period,
                    version: captureReport.version,
                    status: captureReport.status,
                    title: captureReport.title,
                    executiveSummary: captureReport.executiveSummary,
                    generatedAt: captureReport.generatedAt,
                    narrativeSource: captureReport.narrativeSource,
                    qualityScore: captureReport.quality.score,
                    decisionReady: captureReport.quality.decisionReady,
                  }],
                }
            : null;
        if (pathname?.startsWith("/api/executive-reports/monthly/")) {
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(captureReport));
          return;
        }
        if (!payload) return next();
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(payload));
      });
    },
  };
}

export default defineConfig({
  plugins: [captureApiMock(), react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(repositoryRoot, "attached_assets"),
      "@clerk/react": path.resolve(captureRoot, "src", "clerk-mock.tsx"),
      "@tanstack/react-query": path.resolve(
        import.meta.dirname,
        "node_modules/@tanstack/react-query",
      ),
      react: path.resolve(import.meta.dirname, "node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: captureRoot,
  server: {
    host: "127.0.0.1",
    port: 5187,
    strictPort: true,
    fs: {
      allow: [repositoryRoot],
      strict: true,
    },
  },
});
