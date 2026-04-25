import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminAuthRouter from "./admin-auth";
import adminsRouter from "./admins";
import dashboardRouter from "./dashboard";
import propertiesRouter from "./properties";
import roomsRouter from "./rooms";
import bedsRouter from "./beds";
import tenantsRouter from "./tenants";
import paymentsRouter from "./payments";
import complaintsRouter from "./complaints";
import publicRouter from "./public";
import tenantPortalRouter from "./tenant";
import verificationRouter from "./verification";
import { requireAdminAuth } from "../auth/admin-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminAuthRouter);
router.use(publicRouter);
router.use(tenantPortalRouter);
router.use(verificationRouter);
router.use(requireAdminAuth);
router.use(adminsRouter);
router.use(dashboardRouter);
router.use(propertiesRouter);
router.use(roomsRouter);
router.use(bedsRouter);
router.use(tenantsRouter);
router.use(paymentsRouter);
router.use(complaintsRouter);

export default router;
