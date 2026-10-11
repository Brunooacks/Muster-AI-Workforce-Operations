import { z } from "zod";
import { IngestExternalAgentEnvelopeBody as GeneratedIngestExternalAgentEnvelopeBody } from "./generated/api";

const forbiddenStepContentKeys = new Set([
  "prompt",
  "input",
  "output",
  "messages",
  "response",
  "content",
]);

function findForbiddenContentPath(value: unknown, path: Array<string | number> = []): Array<string | number> | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const forbiddenPath = findForbiddenContentPath(item, [...path, index]);
      if (forbiddenPath) return forbiddenPath;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (forbiddenStepContentKeys.has(key.toLowerCase())) return nextPath;
    const forbiddenPath = findForbiddenContentPath(item, nextPath);
    if (forbiddenPath) return forbiddenPath;
  }
  return null;
}

const externalEnvelopeWithoutRawStepContent = z.unknown().superRefine((value, context) => {
  if (!value || typeof value !== "object") return;
  const execution = (value as { execution?: unknown }).execution;
  if (!execution || typeof execution !== "object") return;
  const steps = (execution as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return;

  for (const [index, step] of steps.entries()) {
    const path = findForbiddenContentPath(step);
    if (path) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["execution", "steps", index, ...path],
        message: "Conteúdo bruto não é permitido em execution.steps.",
      });
    }
  }
});

export const IngestExternalAgentEnvelopeBody = externalEnvelopeWithoutRawStepContent
  .pipe(GeneratedIngestExternalAgentEnvelopeBody)
  .superRefine((envelope, context) => {
    if (envelope.contractVersion !== "muster.agent-ingestion.v2") return;
    const steps = envelope.execution?.steps;
    if (!steps) return;

    const seenStepKeys = new Set<string>();
    for (const [index, step] of steps.entries()) {
      if (seenStepKeys.has(step.stepKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["execution", "steps", index, "stepKey"],
          message: "stepKey não pode se repetir no mesmo taskRunId.",
        });
      }
      seenStepKeys.add(step.stepKey);

      if (step.path === "model" && !step.model) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["execution", "steps", index, "model"],
          message: "model é obrigatório quando path é model.",
        });
      }
      if (step.path !== "model" && step.model !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["execution", "steps", index, "model"],
          message: "model só é permitido quando path é model.",
        });
      }

      for (const field of ["tokensIn", "tokensOut", "costCents"] as const) {
        const value = step[field];
        if (value !== undefined && !Number.isInteger(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["execution", "steps", index, field],
            message: `${field} deve ser um inteiro não negativo.`,
          });
        }
      }
    }
  });
