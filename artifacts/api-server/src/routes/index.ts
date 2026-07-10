import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fleetRouter from "./fleet";
import agentsRouter from "./agents";
import discoveryRouter from "./discovery";
import connectorsRouter from "./connectors";
import catalogRouter from "./catalog";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fleetRouter);
router.use(agentsRouter);
router.use(discoveryRouter);
router.use(connectorsRouter);
router.use(catalogRouter);

export default router;
