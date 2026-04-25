import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@workspace/db";
import { adminsTable } from "../../../../lib/db/src/schema/admins";
import { eq } from "drizzle-orm";
import {
  clearAdminSessionCookie,
  ensureLoginAttemptAllowed,
  isAdminRole,
  normalizeAdminEmail,
  registerFailedLoginAttempt,
  requireAdminAuth,
  resetLoginAttempts,
  setAdminSessionCookie,
  withAsyncRoute,
} from "../auth/admin-auth";

const router: IRouter = Router();

const adminLoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

router.post(
  "/admin/login",
  withAsyncRoute(async (req, res) => {
    const { email, password } = adminLoginBody.parse(req.body);
    const normalizedEmail = normalizeAdminEmail(email);

    try {
      ensureLoginAttemptAllowed(req, normalizedEmail);
    } catch (error) {
      const retryAfterSeconds = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
      if (retryAfterSeconds) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
      }
      res.status(429).json({ error: "Too many login attempts. Please try again later." });
      return;
    }

    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.email, normalizedEmail))
      .limit(1);

    const isPasswordValid = admin
      ? await bcrypt.compare(password, admin.passwordHash)
      : false;

    if (!admin || !isPasswordValid || !isAdminRole(admin.role)) {
      const retryAfterSeconds = registerFailedLoginAttempt(req, normalizedEmail);
      if (retryAfterSeconds) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
      }
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    resetLoginAttempts(req, normalizedEmail);
    setAdminSessionCookie(res, { adminId: admin.id, role: admin.role });

    res.json({
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
      },
    });
  }),
);

router.post("/admin/logout", (_req, res) => {
  clearAdminSessionCookie(res);
  res.status(200).json({ success: true });
});

router.get("/admin/session", requireAdminAuth, (req, res) => {
  res.json({ admin: req.admin });
});

export default router;
