import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fleetRouter from "./fleet";
import agentsRouter from "./agents";
import discoveryRouter from "./discovery";
import connectorsRouter from "./connectors";
import catalogRouter from "./catalog";
import telemetryRouter from "./telemetry";
import mixedTeamsRouter from "./mixed-teams";
import performanceRouter from "./performance";
import evidenceRouter from "./evidence";
import journeysRouter from "./journeys";
import journeyRecommendationsRouter from "./journey-recommendations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fleetRouter);
router.use(agentsRouter);
router.use(discoveryRouter);
router.use(connectorsRouter);
router.use(catalogRouter);
router.use(telemetryRouter);
router.use(mixedTeamsRouter);
router.use(performanceRouter);
router.use(evidenceRouter);
router.use(journeysRouter);
router.use(journeyRecommendationsRouter);

export default router;
