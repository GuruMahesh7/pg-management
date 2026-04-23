import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import propertiesRouter from "./properties";
import roomsRouter from "./rooms";
import bedsRouter from "./beds";
import tenantsRouter from "./tenants";
import paymentsRouter from "./payments";
import complaintsRouter from "./complaints";
import publicRouter from "./public";
import tenantPortalRouter from "./tenant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(propertiesRouter);
router.use(roomsRouter);
router.use(bedsRouter);
router.use(tenantsRouter);
router.use(paymentsRouter);
router.use(complaintsRouter);
router.use(publicRouter);
router.use(tenantPortalRouter);

export default router;
