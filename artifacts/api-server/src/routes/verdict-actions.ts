import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, agents, verdicts, verdictActions } from "@workspace/db";
import type { VerdictActionStatus } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import {
  VERDICT_ACTION_STATUSES,
  canCompleteAction,
  isValidActionStatus,
} from "../lib/verdict-action-policy";

const router: IRouter = Router();

/**
 * Ciclo de revisão do agente (gauntlet rodada 5).
 *
 * O veredito recomenda; estas rotas acompanham se a recomendação foi executada.
 * Sem isso, "Mentorar" era um texto sem dono efetivo e a pergunta que fecha o
 * ciclo — "a mentoria funcionou?" — não tinha resposta verificável.
 */

type ActionRow = typeof verdictActions.$inferSelect;

function toVerdictAction(row: ActionRow) {
  return {
    id: row.id,
    agentId: row.agentId,
    verdictId: row.verdictId,
    sequence: row.sequence,
    action: row.action,
    owner: row.owner,
    due: row.due,
    status: row.status,
    evidence: row.evidence,
    healthScoreAtApproval: row.healthScoreAtApproval ?? null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    updatedBy: row.updatedBy ?? null,
  };
}

async function agentInOrg(agentId: string, orgId: string) {
  const [row] = await db
    .select({ id: agents.id, healthScore: agents.healthScore })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
    .limit(1);
  return row;
}

router.get("/agents/:agentId/actions", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  if (!(await agentInOrg(agentId, req.orgId!))) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }
  const rows = await db
    .select()
    .from(verdictActions)
    .where(eq(verdictActions.agentId, agentId))
    .orderBy(desc(verdictActions.createdAt), asc(verdictActions.sequence));
  res.json(rows.map(toVerdictAction));
});

router.patch("/agents/:agentId/actions/:actionId", requireAuth, requireOrg, async (req, res) => {
  const agentId = req.params.agentId as string;
  const actionId = req.params.actionId as string;

  const agent = await agentInOrg(agentId, req.orgId!);
  if (!agent) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }

  const status = req.body?.status as VerdictActionStatus | undefined;
  if (status !== undefined && !isValidActionStatus(status)) {
    res.status(400).json({ error: `Status inválido. Use: ${VERDICT_ACTION_STATUSES.join(", ")}.` });
    return;
  }

  const [atual] = await db
    .select()
    .from(verdictActions)
    .where(and(eq(verdictActions.id, actionId), eq(verdictActions.agentId, agentId)))
    .limit(1);
  if (!atual) {
    res.status(404).json({ error: "Ação não encontrada para este agente." });
    return;
  }

  // Concluir sem dizer o que foi feito derrota o propósito: a evidência é o que
  // sustenta a decisão numa auditoria posterior.
  const evidence = typeof req.body?.evidence === "string" ? req.body.evidence.trim() : undefined;
  if (status === "completed" && !canCompleteAction({ evidenceAtual: atual.evidence, evidenceNova: evidence })) {
    res.status(400).json({ error: "Concluir uma ação exige evidência do que foi feito." });
    return;
  }

  const [row] = await db
    .update(verdictActions)
    .set({
      ...(status ? { status } : {}),
      ...(evidence !== undefined ? { evidence } : {}),
      ...(typeof req.body?.owner === "string" ? { owner: req.body.owner.trim() } : {}),
      // Marca a saúde no momento em que a ação sai do papel: é o ponto de
      // comparação que responde, na próxima avaliação, se a intervenção surtiu efeito.
      ...(status === "in-progress" && atual.healthScoreAtApproval === null
        ? { healthScoreAtApproval: agent.healthScore }
        : {}),
      ...(status === "completed" ? { completedAt: new Date() } : {}),
      updatedBy: req.userId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(verdictActions.id, actionId))
    .returning();

  res.json(toVerdictAction(row!));
});

export default router;

/**
 * Cria as linhas rastreáveis a partir do plano de ação de um veredito. Chamado
 * na emissão do veredito para que a tela nunca mostre um plano sem status.
 */
export async function materializeVerdictActions(
  verdictId: string,
  agentId: string,
  actions: Array<{ action: string; owner: string; due: string }>,
): Promise<void> {
  if (actions.length === 0) return;
  const existentes = await db
    .select({ id: verdictActions.id })
    .from(verdictActions)
    .where(eq(verdictActions.verdictId, verdictId))
    .limit(1);
  if (existentes.length > 0) return;
  await db.insert(verdictActions).values(
    actions.map((a, i) => ({
      verdictId, agentId, sequence: i + 1,
      action: a.action, owner: a.owner ?? "", due: a.due ?? "",
    })),
  );
}


