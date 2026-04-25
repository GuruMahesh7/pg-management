import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@workspace/db";
import { adminsTable } from "../../../../lib/db/src/schema/admins";
import { eq } from "drizzle-orm";
import {
  isAdminRole,
  normalizeAdminEmail,
  requireAdminRole,
  withAsyncRoute,
} from "../auth/admin-auth";

const router: IRouter = Router();

const createAdminBody = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  role: z.enum(["super_admin", "staff"]),
});

router.get(
  "/admin/admins",
  requireAdminRole("super_admin"),
  withAsyncRoute(async (_req, res) => {
    const rows = await db
      .select({
        id: adminsTable.id,
        email: adminsTable.email,
        role: adminsTable.role,
        createdAt: adminsTable.createdAt,
      })
      .from(adminsTable)
      .orderBy(adminsTable.createdAt);

    res.json(rows.filter((row) => isAdminRole(row.role)));
  }),
);

router.post(
  "/admin/admins",
  requireAdminRole("super_admin"),
  withAsyncRoute(async (req, res) => {
    const { email, password, role } = createAdminBody.parse(req.body);
    const normalizedEmail = normalizeAdminEmail(email);

    const [existing] = await db
      .select({ id: adminsTable.id })
      .from(adminsTable)
      .where(eq(adminsTable.email, normalizedEmail))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Admin already exists for that email" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [admin] = await db
      .insert(adminsTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        role,
      })
      .returning({
        id: adminsTable.id,
        email: adminsTable.email,
        role: adminsTable.role,
        createdAt: adminsTable.createdAt,
      });

    res.status(201).json(admin);
  }),
);

export default router;
