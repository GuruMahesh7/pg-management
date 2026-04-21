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

const router: IRouter = Router();

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
  const values = {
    ...body,
    joinedAt: dateToStr(body.joinedAt) as string,
    dateOfBirth: dateToStr(body.dateOfBirth),
  };
  const [row] = await db.insert(tenantsTable).values(values).returning();
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

router.delete("/tenants/:id", async (req, res) => {
  const { id } = DeleteTenantParams.parse(req.params);
  await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  res.status(204).end();
});

export default router;
