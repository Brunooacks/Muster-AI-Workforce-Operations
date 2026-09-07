import { Router, type IRouter } from "express";
import {
  ListProfessionalPlanDecisionsParams,
  ListProfessionalPlanDecisionsResponse,
  ListProfessionalPlanDecisionsResponseItem,
  RecordProfessionalPlanDecisionBody,
  RecordProfessionalPlanDecisionParams,
  UpdateProfessionalPlanActionBody,
  UpdateProfessionalPlanActionParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgOperator } from "../middlewares/orgRole";
import {
  listProfessionalPlanDecisions,
  ProfessionalPlanActionNotFoundError,
  ProfessionalPlanActionTransitionError,
  ProfessionalPlanDecisionNotFoundError,
  recordProfessionalPlanDecision,
  toProfessionalPlanDecision,
  updateProfessionalPlanAction,
} from "../lib/professional-plan-service";

const router: IRouter = Router();

router.get(
  "/professionals/:professionalRef/development-plan/decisions",
  requireAuth,
  requireOrg,
  async (req, res) => {
    const { professionalRef } = ListProfessionalPlanDecisionsParams.parse(req.params);
    const rows = await listProfessionalPlanDecisions({
      orgId: req.orgId!,
      professionalRef,
    });
    res.json(
      ListProfessionalPlanDecisionsResponse.parse(
        rows.map(toProfessionalPlanDecision),
      ),
    );
  },
);

router.post(
  "/professionals/:professionalRef/development-plan/decisions",
  requireAuth,
  requireOrg,
  requireOrgOperator,
  async (req, res) => {
    const { professionalRef } = RecordProfessionalPlanDecisionParams.parse(req.params);
    const body = RecordProfessionalPlanDecisionBody.parse(req.body);
    const row = await recordProfessionalPlanDecision({
      orgId: req.orgId!,
      userId: req.userId!,
      professionalRef,
      professionalName: body.professionalName,
      recommendation: body.recommendation,
      decision: body.decision,
      reason: body.reason,
      owner: body.owner,
    });
    res.status(201).json(
      ListProfessionalPlanDecisionsResponseItem.parse(
        toProfessionalPlanDecision(row),
      ),
    );
  },
);

router.patch(
  "/professionals/:professionalRef/development-plan/decisions/:decisionId/actions/:sequence",
  requireAuth,
  requireOrg,
  requireOrgOperator,
  async (req, res) => {
    const { professionalRef, decisionId, sequence } =
      UpdateProfessionalPlanActionParams.parse(req.params);
    const body = UpdateProfessionalPlanActionBody.parse(req.body);
    try {
      const row = await updateProfessionalPlanAction({
        orgId: req.orgId!,
        userId: req.userId!,
        professionalRef,
        decisionId,
        sequence,
        status: body.status,
        evidence: body.evidence,
      });
      res.json(
        ListProfessionalPlanDecisionsResponseItem.parse(
          toProfessionalPlanDecision(row),
        ),
      );
    } catch (error) {
      if (
        error instanceof ProfessionalPlanDecisionNotFoundError ||
        error instanceof ProfessionalPlanActionNotFoundError
      ) {
        res.status(404).json({ error: "Decisão ou ação não encontrada." });
        return;
      }
      if (error instanceof ProfessionalPlanActionTransitionError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  },
);

export default router;
