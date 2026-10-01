import type {
  ProfessionalPlanAction,
  ProfessionalPlanActionStatus,
  ProfessionalPlanDecisionType,
} from "@workspace/db";

const HOUR = 60 * 60 * 1_000;
const DAY = 24 * HOUR;

type PlanWorkflowInput = {
  decision: ProfessionalPlanDecisionType;
  professionalName: string;
  owner: string;
  now: Date;
};

export type ProfessionalPlanWorkflow = {
  actions: ProfessionalPlanAction[];
  nextReviewAt: Date | null;
};

const ACTION_TRANSITIONS: Record<
  ProfessionalPlanActionStatus,
  readonly ProfessionalPlanActionStatus[]
> = {
  ready: ["in_progress", "blocked", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export type ProfessionalPlanActionTransitionInput = {
  action: ProfessionalPlanAction;
  status: ProfessionalPlanActionStatus;
  evidence?: string;
  updatedBy: string;
  now: Date;
};

export function transitionProfessionalPlanAction(
  input: ProfessionalPlanActionTransitionInput,
): ProfessionalPlanAction {
  if (!ACTION_TRANSITIONS[input.action.status].includes(input.status)) {
    throw new Error(
      `A ação não pode mudar de ${input.action.status} para ${input.status}.`,
    );
  }

  const evidence = input.evidence?.trim() ?? "";
  if (
    ["blocked", "completed", "cancelled"].includes(input.status) &&
    evidence.length < 3
  ) {
    throw new Error("Bloquear, concluir ou cancelar exige evidência.");
  }

  return {
    ...input.action,
    status: input.status,
    evidence: evidence || input.action.evidence,
    startedAt:
      input.status === "in_progress"
        ? input.action.startedAt ?? input.now.toISOString()
        : input.action.startedAt,
    completedAt:
      input.status === "completed" ? input.now.toISOString() : input.action.completedAt,
    updatedBy: input.updatedBy,
  };
}

function dueAt(now: Date, offset: number): string {
  return new Date(now.getTime() + offset).toISOString();
}

export function buildProfessionalPlanWorkflow(
  input: PlanWorkflowInput,
): ProfessionalPlanWorkflow {
  if (input.decision === "approved") {
    const nextReviewAt = new Date(input.now.getTime() + 14 * DAY);
    return {
      nextReviewAt,
      actions: [
        {
          sequence: 1,
          actorType: "muster",
          title: "Preparar coorte e baseline",
          description: "Preservar evidências, congelar a referência e abrir a janela de acompanhamento.",
          owner: "Muster",
          status: "completed",
          dueAt: input.now.toISOString(),
        },
        {
          sequence: 2,
          actorType: "agent",
          title: "Executar o plano aprovado",
          description: "Aplicar o plano dentro dos guardrails e reportar resultado por execução.",
          owner: input.professionalName,
          status: "ready",
          dueAt: dueAt(input.now, DAY),
        },
        {
          sequence: 3,
          actorType: "human",
          title: "Validar evolução",
          description: "Comparar os ciclos válidos com a baseline e decidir autonomia, mentoria ou encerramento.",
          owner: input.owner,
          status: "ready",
          dueAt: nextReviewAt.toISOString(),
        },
      ],
    };
  }

  if (input.decision === "adjustment_requested") {
    const nextReviewAt = new Date(input.now.getTime() + 8 * HOUR);
    return {
      nextReviewAt,
      actions: [
        {
          sequence: 1,
          actorType: "muster",
          title: "Preservar versão recusada",
          description: "Registrar a hipótese anterior e manter evidências para comparação.",
          owner: "Muster",
          status: "completed",
          dueAt: input.now.toISOString(),
        },
        {
          sequence: 2,
          actorType: "agent",
          title: "Reformular o plano",
          description: "Incorporar o feedback sem ampliar escopo, autonomia ou risco silenciosamente.",
          owner: input.professionalName,
          status: "ready",
          dueAt: dueAt(input.now, 4 * HOUR),
        },
        {
          sequence: 3,
          actorType: "human",
          title: "Revisar nova versão",
          description: "Confirmar responsabilidades, SLA, evidências e limites antes de liberar a execução.",
          owner: input.owner,
          status: "ready",
          dueAt: nextReviewAt.toISOString(),
        },
      ],
    };
  }

  return {
    nextReviewAt: null,
    actions: [
      {
        sequence: 1,
        actorType: "muster",
        title: "Bloquear execução do plano",
        description: "Cancelar a liberação operacional e preservar a decisão no histórico.",
        owner: "Muster",
        status: "completed",
        dueAt: input.now.toISOString(),
      },
      {
        sequence: 2,
        actorType: "human",
        title: "Definir destino do profissional",
        description: "Escolher entre redefinir função, abrir nova hipótese ou encerrar o vínculo operacional.",
        owner: input.owner,
        status: "ready",
        dueAt: dueAt(input.now, 2 * DAY),
      },
    ],
  };
}
