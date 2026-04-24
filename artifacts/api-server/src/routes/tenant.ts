import { Router, type IRouter } from "express";
import { db, tenantsTable, bedsTable, roomsTable, propertiesTable, paymentsTable, complaintsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecurejwtsecret_change_me_in_prod";

// Middleware to authenticate tenant
router.use((req, res, next) => {
  const token = req.cookies?.tenant_session;
  console.log("Auth Middleware - Cookie:", token ? "Exists" : "Missing");
  
  if (!token) {
    res.status(401).json({ error: "Unauthorized: Missing session cookie" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log("Auth Middleware - JWT Decoded:", decoded.tenantId, decoded.role);
    if (decoded.role !== "tenant" || !decoded.tenantId) {
      res.status(403).json({ error: "Forbidden: Not a tenant" });
      return;
    }
    // inject tenantId
    (req as any).tenantId = Number(decoded.tenantId);
    next();
  } catch (err) {
    console.error("Auth Middleware - JWT Error:", err);
    res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
  }
});

router.get("/tenant/dashboard", async (req, res) => {
  const tenantId = (req as any).tenantId;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  // Get current bed assignment
  const [bed] = await db.select().from(bedsTable).where(eq(bedsTable.tenantId, tenantId));
  
  let property = null;
  let room = null;
  if (bed) {
    [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, bed.roomId));
    if (room) {
      [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, room.propertyId));
    }
  }

  // Payments
  const payments = await db.select()
    .from(paymentsTable)
    .where(eq(paymentsTable.tenantId, tenantId))
    .orderBy(desc(paymentsTable.createdAt));

  // Complaints
  const complaints = await db.select()
    .from(complaintsTable)
    .where(eq(complaintsTable.tenantId, tenantId))
    .orderBy(desc(complaintsTable.createdAt));

  res.json({
    tenant,
    assignment: bed ? { property, room, bed } : null,
    payments,
    complaints
  });
});

router.post("/tenant/complaints", async (req, res) => {
  const tenantId = (req as any).tenantId;
  const body = z.object({
    category: z.enum(["plumbing", "electricity", "cleaning", "internet", "furniture", "security", "other"]),
    title: z.string().min(1),
    description: z.string().min(1),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
  }).parse(req.body);

  const [row] = await db
    .insert(complaintsTable)
    .values({ ...body, tenantId, status: "open" })
    .returning();

  res.status(201).json(row);
});

router.post("/tenant/logout", (req, res) => {
  res.clearCookie("tenant_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ success: true });
});

export default router;
