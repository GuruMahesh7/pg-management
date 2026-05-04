import { Router, type IRouter } from "express";
import { db, tenantsTable, bedsTable, roomsTable, propertiesTable, paymentsTable, complaintsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateTenantBody,
  UpdateTenantBody,
  UpdateTenantParams,
  GetTenantParams,
  DeleteTenantParams,
} from "@workspace/api-zod";
import { requireAdminRole } from "../auth/admin-auth";
import { Resend } from "resend";
import { logger } from "../lib/logger";
import bcrypt from "bcryptjs";

const router: IRouter = Router();
const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER_EMAIL = (process.env.SENDER_EMAIL || "onboarding@resend.dev").split('#')[0].trim();

function serializePayment(p: typeof paymentsTable.$inferSelect) {
  return { ...p, amount: Number(p.amount) };
}

router.get("/tenants", async (_req, res) => {
  const rows = await db
    .select({
      id: tenantsTable.id,
      fullName: tenantsTable.fullName,
      email: tenantsTable.email,
      phone: tenantsTable.phone,
      gender: tenantsTable.gender,
      dateOfBirth: tenantsTable.dateOfBirth,
      occupation: tenantsTable.occupation,
      emergencyContactName: tenantsTable.emergencyContactName,
      emergencyContactPhone: tenantsTable.emergencyContactPhone,
      idProofType: tenantsTable.idProofType,
      idProofNumber: tenantsTable.idProofNumber,
      permanentAddress: tenantsTable.permanentAddress,
      joinedAt: tenantsTable.joinedAt,
      status: tenantsTable.status,
      avatarUrl: tenantsTable.avatarUrl,
      bedId: bedsTable.id,
      bedLabel: bedsTable.bedLabel,
      roomNumber: roomsTable.roomNumber,
      propertyName: propertiesTable.name,
      monthlyRent: roomsTable.monthlyRent,
    })
    .from(tenantsTable)
    .leftJoin(bedsTable, eq(bedsTable.tenantId, tenantsTable.id))
    .leftJoin(roomsTable, eq(roomsTable.id, bedsTable.roomId))
    .leftJoin(propertiesTable, eq(propertiesTable.id, roomsTable.propertyId))
    .orderBy(tenantsTable.id);
  res.json(rows.map((r) => ({ ...r, monthlyRent: r.monthlyRent != null ? Number(r.monthlyRent) : null })));
});

function dateToStr(d: Date | null | undefined): string | null | undefined {
  if (d == null) return d as null | undefined;
  return d.toISOString().slice(0, 10);
}

router.post("/tenants", async (req, res) => {
  const body = CreateTenantBody.parse(req.body);
  const passwordHash = await bcrypt.hash(body.phone.trim(), 10);
  
  const values = {
    ...body,
    passwordHash,
    joinedAt: dateToStr(body.joinedAt) as string,
    dateOfBirth: dateToStr(body.dateOfBirth),
  };
  
  // Exclude bedId from values to insert since it's not a column in tenantsTable
  const { bedId, ...insertValues } = values;
  
  const [row] = await db.insert(tenantsTable).values(insertValues).returning();

  if (bedId) {
    await db.update(bedsTable)
      .set({ isOccupied: true, tenantId: row.id })
      .where(eq(bedsTable.id, bedId));
  }

  if (row.email && process.env.RESEND_API_KEY) {
    try {
      const { data, error } = await resend.emails.send({
        from: `Diziny Delux PG <${SENDER_EMAIL}>`,
        to: row.email,
        subject: "Welcome to Diziny Delux PG!",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #4CAF50;">Welcome to Diziny Delux PG!</h2>
            <p>Hi <strong>${row.fullName}</strong>,</p>
            <p>You have been successfully joined in the Diziny Delux PG.</p>
            <p>You can login to your tenant dashboard here:<br/>
               <a href="https://home-haven-connect.vercel.app/tenant/login" style="color: #2196F3; display: inline-block; margin-top: 10px;">https://home-haven-connect.vercel.app/tenant/login</a>
            </p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Your login credentials:</strong></p>
              <p style="margin: 0 0 5px 0;">Email: <strong>${row.email}</strong></p>
              <p style="margin: 0;">Password: <strong>${row.phone}</strong></p>
            </div>
            <p>We're glad to have you with us!</p>
            <br/>
            <p style="margin: 0;">Best Regards,</p>
            <p style="margin: 0; font-weight: bold;">Diziny Delux PG Management</p>
          </div>
        `,
      });
      if (error) {
        logger.error({ error }, "Error sending welcome email to tenant");
      } else {
        logger.info({ data, email: row.email }, "Welcome email sent successfully");
      }
    } catch (e) {
      logger.error({ error: e }, "Failed to send welcome email");
    }
  } else if (row.email) {
    logger.warn(`RESEND_API_KEY missing. Would have sent welcome email to ${row.email}`);
  }

  res.status(201).json(row);
});

router.get("/tenants/:id", async (req, res) => {
  const { id } = GetTenantParams.parse(req.params);
  const [t] = await db
    .select({
      id: tenantsTable.id,
      fullName: tenantsTable.fullName,
      email: tenantsTable.email,
      phone: tenantsTable.phone,
      gender: tenantsTable.gender,
      dateOfBirth: tenantsTable.dateOfBirth,
      occupation: tenantsTable.occupation,
      emergencyContactName: tenantsTable.emergencyContactName,
      emergencyContactPhone: tenantsTable.emergencyContactPhone,
      idProofType: tenantsTable.idProofType,
      idProofNumber: tenantsTable.idProofNumber,
      permanentAddress: tenantsTable.permanentAddress,
      joinedAt: tenantsTable.joinedAt,
      status: tenantsTable.status,
      avatarUrl: tenantsTable.avatarUrl,
      bedId: bedsTable.id,
      bedLabel: bedsTable.bedLabel,
      roomNumber: roomsTable.roomNumber,
      propertyName: propertiesTable.name,
      monthlyRent: roomsTable.monthlyRent,
    })
    .from(tenantsTable)
    .leftJoin(bedsTable, eq(bedsTable.tenantId, tenantsTable.id))
    .leftJoin(roomsTable, eq(roomsTable.id, bedsTable.roomId))
    .leftJoin(propertiesTable, eq(propertiesTable.id, roomsTable.propertyId))
    .where(eq(tenantsTable.id, id));
  if (!t) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const recent = await db.select().from(paymentsTable).where(eq(paymentsTable.tenantId, id)).orderBy(desc(paymentsTable.createdAt)).limit(6);
  const compl = await db.select().from(complaintsTable).where(eq(complaintsTable.tenantId, id)).orderBy(desc(complaintsTable.createdAt)).limit(10);
  res.json({
    ...t,
    monthlyRent: t.monthlyRent != null ? Number(t.monthlyRent) : null,
    recentPayments: recent.map(serializePayment),
    complaints: compl,
  });
});

router.patch("/tenants/:id", async (req, res) => {
  const { id } = UpdateTenantParams.parse(req.params);
  const body = UpdateTenantBody.parse(req.body);
  const values = {
    ...body,
    joinedAt: dateToStr(body.joinedAt) as string,
    dateOfBirth: dateToStr(body.dateOfBirth),
  };
  const [row] = await db.update(tenantsTable).set(values).where(eq(tenantsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/tenants/:id", requireAdminRole("super_admin"), async (req, res) => {
  const { id } = DeleteTenantParams.parse(req.params);
  await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  res.status(204).end();
});

export default router;
