import { openai } from "@workspace/integrations-openai-ai-server";
import type { LayerKey, AutonomyLevel } from "@workspace/db";
import { DEFAULT_LAYER_METRIC } from "./discovery";

// Max accepted size for pasted/uploaded source so a single analysis request
// stays well within model + request limits. Kept in sync with the frontend.
export const MAX_CONTENT_LENGTH = 100_000;

// Thrown when the AI provider signals a rate-limit / quota error so the route
// can surface a distinct 429 ("limite de uso") instead of a generic failure.
export class RateLimitError extends Error {
  constructor(message = "AI rate limit reached") {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface DraftMetric {
  layer: LayerKey;
  label: string;
  unit: string;
  target: string;
  rationale?: string;
}

export interface AgentDraft {
  name: string;
  role: string;
  tagline: string;
  bio: string;
  shouldDo: string[];
  shouldNotDo: string[];
  autonomyLevel: AutonomyLevel;
  autonomyNotes?: string;
  limits: string[];
  businessCase: {
    baseline: string;
    targetPayback: string;
    description: string;
  };
  proposedMetrics: DraftMetric[];
  summary: string;
  confidence: number;
}

const LAYER_KEYS: LayerKey[] = [
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
];
const AUTONOMY_LEVELS: AutonomyLevel[] = [
  "autonomous",
  "escalates",
  "restricted",
];

const SYSTEM_PROMPT = `Você é o analista de admissão da Cohort, uma plataforma que governa frotas de agentes de IA.
A partir do CÓDIGO e das DEFINIÇÕES DE SKILLS de um agente, você produz um rascunho editável da "Carteira de Trabalho" e das métricas de avaliação.

Responda SOMENTE com um objeto JSON válido (sem markdown, sem comentários) com EXATAMENTE estas chaves:
{
  "name": string,            // nome curto e descritivo do agente
  "role": string,            // papel funcional (ex: "Atendimento ao cliente N1")
  "tagline": string,         // frase curta de posicionamento (máx ~80 caracteres)
  "bio": string,             // 1-3 frases descrevendo propósito e escopo
  "shouldDo": string[],      // 3-6 itens do que o agente DEVE fazer
  "shouldNotDo": string[],   // 3-6 itens do que o agente NÃO deve fazer
  "autonomyLevel": "autonomous" | "escalates" | "restricted",
  "autonomyNotes": string,   // breve justificativa do nível de autonomia
  "limits": string[],        // 2-5 limites/guardrails operacionais
  "businessCase": {
    "baseline": string,        // situação atual / linha de base
    "targetPayback": string,   // payback/retorno esperado (ex: "3 meses")
    "description": string      // caso de negócio em 1-2 frases
  },
  "proposedMetrics": [       // 5 a 8 métricas, COBRINDO as 5 camadas abaixo
    {
      "layer": "efficacy" | "efficiency" | "adoption" | "governance" | "value",
      "label": string,         // rótulo curto da métrica em português
      "unit": string,          // unidade (ex: "%", "s", "min", "/5", "R$ mil")
      "target": string,        // meta sugerida (ex: "≥ 85%", "< 60s")
      "rationale": string      // por que essa métrica importa (1 frase)
    }
  ],
  "summary": string,         // 1-2 frases resumindo a análise
  "confidence": number       // 0-100, confiança da análise
}

As 5 camadas de avaliação da Cohort são:
- efficacy (Eficácia): qualidade e acerto dos resultados.
- efficiency (Eficiência): custo, latência e consumo de recursos.
- adoption (Adoção): uso real pelas pessoas e volume tratado.
- governance (Governança): conformidade, segurança e violações de política.
- value (Valor): impacto de negócio gerado.

Inclua ao menos uma métrica para CADA uma das 5 camadas. Escreva todo o conteúdo em português do Brasil. Se o material for insuficiente, faça as melhores suposições e reduza o "confidence".`;

function asStringArray(input: unknown, max = 8): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, max);
}

function clampConfidence(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return 60;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeMetrics(input: unknown): DraftMetric[] {
  if (!Array.isArray(input)) return [];
  const metrics: DraftMetric[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const layer = typeof m.layer === "string" ? (m.layer as LayerKey) : null;
    const label = typeof m.label === "string" ? m.label.trim() : "";
    if (!layer || !LAYER_KEYS.includes(layer) || !label) continue;
    metrics.push({
      layer,
      label,
      unit: typeof m.unit === "string" && m.unit.trim() ? m.unit.trim() : "%",
      target: typeof m.target === "string" ? m.target.trim() : "",
      rationale:
        typeof m.rationale === "string" && m.rationale.trim()
          ? m.rationale.trim()
          : undefined,
    });
  }
  return metrics.slice(0, 12);
}

// Ensure each of the 5 layers has at least one metric so the draft (and the
// evaluation seeded from it) always covers the full Cohort model.
function ensureLayerCoverage(metrics: DraftMetric[]): DraftMetric[] {
  const present = new Set(metrics.map((m) => m.layer));
  const filled = [...metrics];
  for (const layer of LAYER_KEYS) {
    if (!present.has(layer)) {
      const def = DEFAULT_LAYER_METRIC[layer];
      filled.push({ layer, label: def.label, unit: def.unit, target: def.target });
    }
  }
  return filled;
}

export async function analyzeAgentSource(input: {
  content: string;
  platform?: string;
  nameHint?: string;
}): Promise<AgentDraft> {
  const userParts: string[] = [];
  if (input.nameHint) userParts.push(`Nome sugerido: ${input.nameHint}`);
  if (input.platform) userParts.push(`Plataforma base: ${input.platform}`);
  userParts.push(
    "Código e/ou definições de skills do agente a analisar:\n\n" + input.content,
  );

  // Model is env-configurable so self-hosted setups can point the OpenAI
  // client at any OpenAI-compatible endpoint (e.g. Anthropic's compat API
  // with a claude-* model, or an internal gateway). Defaults to the value
  // used on the managed (Replit) integration.
  const model = process.env.AI_INTEGRATIONS_OPENAI_MODEL ?? "gpt-5.4";

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model,
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userParts.join("\n\n") },
      ],
    });
  } catch (err) {
    const status = (err as { status?: number; code?: string }).status;
    const code = (err as { status?: number; code?: string }).code;
    if (status === 429 || code === "insufficient_quota" || code === "rate_limit_exceeded") {
      throw new RateLimitError();
    }
    throw err;
  }

  const text = completion.choices[0]?.message?.content ?? "";
  if (!text.trim()) {
    throw new Error("Empty analysis response from model");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const autonomyRaw =
    typeof parsed.autonomyLevel === "string" ? parsed.autonomyLevel : "";
  const autonomyLevel = AUTONOMY_LEVELS.includes(autonomyRaw as AutonomyLevel)
    ? (autonomyRaw as AutonomyLevel)
    : "escalates";

  const bc =
    parsed.businessCase && typeof parsed.businessCase === "object"
      ? (parsed.businessCase as Record<string, unknown>)
      : {};

  return {
    name: typeof parsed.name === "string" ? parsed.name.trim() : "",
    role: typeof parsed.role === "string" ? parsed.role.trim() : "",
    tagline: typeof parsed.tagline === "string" ? parsed.tagline.trim() : "",
    bio: typeof parsed.bio === "string" ? parsed.bio.trim() : "",
    shouldDo: asStringArray(parsed.shouldDo),
    shouldNotDo: asStringArray(parsed.shouldNotDo),
    autonomyLevel,
    autonomyNotes:
      typeof parsed.autonomyNotes === "string" && parsed.autonomyNotes.trim()
        ? parsed.autonomyNotes.trim()
        : undefined,
    limits: asStringArray(parsed.limits),
    businessCase: {
      baseline: typeof bc.baseline === "string" ? bc.baseline.trim() : "",
      targetPayback:
        typeof bc.targetPayback === "string" ? bc.targetPayback.trim() : "",
      description:
        typeof bc.description === "string" ? bc.description.trim() : "",
    },
    proposedMetrics: ensureLayerCoverage(normalizeMetrics(parsed.proposedMetrics)),
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    confidence: clampConfidence(parsed.confidence),
  };
}
