import type { KpiLayer, LayerKey } from "@workspace/db";
import {
  analyzeTrendAndAnomaly,
  assessFreshness,
  calculateOperationalScore,
  classifyConfidence,
  prioritizeOperationalInsights,
  type OperationalInsightCandidate,
} from "./operational-insights";

export interface FleetInsightAgentInput {
  id: string;
  name: string;
  platform: string;
  monthlyVolume: number;
}

export interface FleetInsightEvaluationInput {
  agentId: string;
  evaluatedAt: Date;
  layers: KpiLayer[];
  verdictConfidence: number;
}

export interface FleetInsightPointInput {
  agentId: string;
  timestamp: Date;
  efficacy: number;
  efficiency: number;
  adoption: number;
  governance: number;
  value: number;
}

export interface BuildFleetInsightsInput {
  agents: FleetInsightAgentInput[];
  evaluations: FleetInsightEvaluationInput[];
  points: FleetInsightPointInput[];
  now: Date;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildFleetInsights(input: BuildFleetInsightsInput) {
  const latestByAgent = new Map<string, FleetInsightEvaluationInput>();
  for (const evaluation of [...input.evaluations].sort(
    (left, right) => right.evaluatedAt.getTime() - left.evaluatedAt.getTime(),
  )) {
    if (!latestByAgent.has(evaluation.agentId)) latestByAgent.set(evaluation.agentId, evaluation);
  }
  const pointsByAgent = new Map<string, FleetInsightPointInput[]>();
  for (const point of input.points) {
    const agentPoints = pointsByAgent.get(point.agentId) ?? [];
    agentPoints.push(point);
    pointsByAgent.set(point.agentId, agentPoints);
  }

  const freshnessPolicy = {
    expectedWithinMinutes: 1_440,
    staleAfterMinutes: 2_160,
    expiresAfterMinutes: 4_320,
  };
  const candidates: OperationalInsightCandidate[] = [];
  let freshAgents = 0;
  let decisionGradeAgents = 0;
  let operationalScoreSum = 0;

  const agentSnapshots = input.agents.map((agent) => {
    const latest = latestByAgent.get(agent.id);
    const layers = Object.fromEntries(
      (latest?.layers ?? []).map((layer) => [layer.key, layer.score]),
    ) as Partial<Record<LayerKey, number>>;
    const freshness = assessFreshness(latest?.evaluatedAt, input.now, freshnessPolicy);
    const confidence = classifyConfidence(latest?.verdictConfidence ?? 0);
    const governanceScore = layers.governance;
    const guardrailBreached = typeof governanceScore === "number" && governanceScore < 50;
    const operational = calculateOperationalScore({
      layers,
      freshnessScore: freshness.score,
      confidence: confidence.score,
      guardrailBreached,
    });
    const trend = analyzeTrendAndAnomaly(
      (pointsByAgent.get(agent.id) ?? []).map((point) => ({
        observedAt: point.timestamp,
        value: round1(
          (point.efficacy + point.efficiency + point.adoption + point.governance + point.value) / 5,
        ),
      })),
      "higher-is-better",
    );

    operationalScoreSum += operational.score;
    if (freshness.status === "fresh" || freshness.status === "aging") freshAgents += 1;
    if (confidence.band === "decision-grade" && operational.decisionEligible) decisionGradeAgents += 1;

    if (["missing", "stale", "expired"].includes(freshness.status)) {
      candidates.push({
        id: `${agent.id}:freshness`,
        entityId: agent.id,
        entityName: agent.name,
        category: "data-quality",
        title: freshness.status === "missing" ? "Avaliação ainda não observada" : "Avaliação operacional desatualizada",
        explanation: `O último dado está classificado como ${freshness.status} para a janela diária.`,
        recommendation: "Restabelecer a coleta, validar o heartbeat e reprocessar a avaliação antes de decidir.",
        severity: freshness.status === "expired" || freshness.status === "missing" ? "critical" : "high",
        impact: 85,
        confidence: 100,
        freshness: freshness.status,
        guardrail: true,
        affectedExecutions: agent.monthlyVolume,
        slaRisk: true,
      });
    }
    if (confidence.band === "insufficient") {
      candidates.push({
        id: `${agent.id}:confidence`,
        entityId: agent.id,
        entityName: agent.name,
        category: "quality-evaluation",
        title: "Confiança insuficiente para decisão",
        explanation: `A avaliação atual tem ${confidence.score}% de confiança.`,
        recommendation: "Aumentar amostra, revisar qualidade da evidência e calibrar o avaliador humano.",
        severity: "medium",
        impact: 65,
        confidence: 100,
        freshness: freshness.status,
        guardrail: false,
        affectedExecutions: agent.monthlyVolume,
      });
    }
    if (guardrailBreached) {
      candidates.push({
        id: `${agent.id}:guardrail`,
        entityId: agent.id,
        entityName: agent.name,
        category: "governance",
        title: "Camada de governança em nível crítico",
        explanation: `O score de governança está em ${round1(governanceScore ?? 0)} pontos.`,
        recommendation: "Conter autonomia, auditar execuções afetadas e atribuir owner para correção.",
        severity: "critical",
        impact: 95,
        confidence: confidence.score,
        freshness: freshness.status,
        guardrail: true,
        affectedExecutions: agent.monthlyVolume,
        slaRisk: true,
      });
    }
    if (trend.trend === "degrading" || trend.anomaly === "drop") {
      candidates.push({
        id: `${agent.id}:trend`,
        entityId: agent.id,
        entityName: agent.name,
        category: "performance",
        title: trend.anomaly === "drop" ? "Anomalia negativa de desempenho" : "Tendência de desempenho em queda",
        explanation: `A série operacional variou ${trend.relativeChangePercent ?? 0}% na janela analisada.`,
        recommendation: "Comparar versão, runtime, fallback e mix de workload antes de ajustar o agente.",
        severity: trend.anomaly === "drop" ? "high" : "medium",
        impact: 75,
        confidence: confidence.score,
        freshness: freshness.status,
        guardrail: false,
        affectedExecutions: agent.monthlyVolume,
      });
    }
    if (operational.score < 65 && !guardrailBreached) {
      candidates.push({
        id: `${agent.id}:operational-score`,
        entityId: agent.id,
        entityName: agent.name,
        category: "performance",
        title: "Score operacional abaixo do nível controlado",
        explanation: `O score composto está em ${operational.score}, considerando performance e maturidade da evidência.`,
        recommendation: "Priorizar a camada de menor score e manter o agente em observação até nova janela.",
        severity: operational.score < 50 ? "high" : "medium",
        impact: 70,
        confidence: confidence.score,
        freshness: freshness.status,
        guardrail: false,
        affectedExecutions: agent.monthlyVolume,
      });
    }

    return {
      id: agent.id,
      name: agent.name,
      platform: agent.platform,
      operationalScore: operational.score,
      band: operational.band,
      freshness,
      confidence,
      trend,
      decisionEligible: operational.decisionEligible && confidence.decisionEligible && freshness.decisionEligible,
    };
  });

  return {
    generatedAt: input.now.toISOString(),
    fleetOperationalScore: input.agents.length ? round1(operationalScoreSum / input.agents.length) : 0,
    coverage: {
      totalAgents: input.agents.length,
      evaluatedAgents: latestByAgent.size,
      freshAgents,
      staleAgents: input.agents.length - freshAgents,
      decisionGradeAgents,
    },
    agents: agentSnapshots.sort((left, right) => left.operationalScore - right.operationalScore),
    insights: prioritizeOperationalInsights(candidates).slice(0, 20),
  };
}
