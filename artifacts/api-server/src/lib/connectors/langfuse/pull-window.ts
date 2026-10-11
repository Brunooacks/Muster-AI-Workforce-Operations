import type {
  LangfuseObservation,
  LangfuseReadableClient,
  LangfuseScore,
} from "./client";

export interface LangfuseTraceGroup {
  traceId: string;
  observations: LangfuseObservation[];
  scores: LangfuseScore[];
}

export interface LangfusePullWindow {
  projectId: string;
  traces: LangfuseTraceGroup[];
  truncated: boolean;
  warnings: string[];
}

export async function pullLangfuseWindow(
  client: LangfuseReadableClient,
  {
    from,
    to,
    maxTraces = 500,
  }: {
    from: Date;
    to: Date;
    maxTraces?: number;
  },
): Promise<LangfusePullWindow> {
  const projects = await client.listProjects();
  const project = projects[0];
  if (!project) throw new Error("Nenhum projeto Langfuse foi encontrado para estas chaves.");

  const warnings: string[] = [];
  const traces = new Map<string, LangfuseTraceGroup>();
  let truncated = false;

  observationPages: for await (const observations of client.listObservations({ from, to })) {
    for (const observation of observations) {
      const traceId = typeof observation.traceId === "string" ? observation.traceId : undefined;
      if (!traceId) {
        warnings.push("Observação Langfuse ignorada: traceId ausente.");
        continue;
      }
      let trace = traces.get(traceId);
      if (!trace) {
        if (traces.size >= maxTraces) {
          truncated = true;
          break observationPages;
        }
        trace = { traceId, observations: [], scores: [] };
        traces.set(traceId, trace);
      }
      trace.observations.push(stripSensitiveFields(observation));
    }
  }

  for await (const scores of client.listScores({ from, to })) {
    for (const score of scores) {
      const subject = score.subject;
      const traceId =
        subject?.kind === "trace"
          ? subject.id
          : subject?.kind === "observation"
            ? subject.traceId
            : undefined;
      if (!traceId || !traces.has(traceId)) {
        if (subject?.kind === "session" || subject?.kind === "experiment") {
          warnings.push(
            `Score Langfuse ignorado: subject.kind ${subject.kind} não é associado a uma trace.`,
          );
        } else if (!traceId) {
          warnings.push("Score Langfuse ignorado: subject sem trace associada.");
        }
        continue;
      }
      traces.get(traceId)!.scores.push(stripSensitiveFields(score));
    }
  }

  return {
    projectId: project.id,
    traces: [...traces.values()],
    truncated,
    warnings,
  };
}

function stripSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripSensitiveFields) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["input", "output", "metadata"].includes(key))
      .map(([key, nested]) => [key, stripSensitiveFields(nested)]),
  ) as T;
}
