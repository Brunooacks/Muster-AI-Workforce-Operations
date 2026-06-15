import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fleetRouter from "./fleet";
import agentsRouter from "./agents";
import connectorsRouter from "./connectors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fleetRouter);
router.use(agentsRouter);
router.use(connectorsRouter);

export default router;
