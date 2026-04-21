import { Router, type IRouter } from "express";
import { db, paymentsTable, tenantsTable, bedsTable, roomsTable, propertiesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  CreatePaymentBody,
  ListPaymentsQueryParams,
  MarkPaymentPaidBody,
  MarkPaymentPaidParams,
  GenerateMonthlyRentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function ser(p: typeof paymentsTable.$inferSelect) {
  return { ...p, amount: Number(p.amount) };
}

router.get("/payments", async (req, res) => {
  const { status, tenantId } = ListPaymentsQueryParams.parse(req.query);
  const conds = [];
  if (status) conds.push(eq(paymentsTable.status, status));
  if (tenantId) conds.push(eq(paymentsTable.tenantId, tenantId));

  const baseQuery = db
    .select({
      id: paymentsTable.id,
      tenantId: paymentsTable.tenantId,
      amount: paymentsTable.amount,
      status: paymentsTable.status,
      dueDate: paymentsTable.dueDate,
      paidDate: paymentsTable.paidDate,
      month: paymentsTable.month,
      year: paymentsTable.year,
      method: paymentsTable.method,
      notes: paymentsTable.notes,
      createdAt: paymentsTable.createdAt,
      tenantName: tenantsTable.fullName,
      roomNumber: roomsTable.roomNumber,
      propertyName: propertiesTable.name,
    })
    .from(paymentsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, paymentsTable.tenantId))
    .leftJoin(bedsTable, eq(bedsTable.tenantId, tenantsTable.id))
    .leftJoin(roomsTable, eq(roomsTable.id, bedsTable.roomId))
    .leftJoin(propertiesTable, eq(propertiesTable.id, roomsTable.propertyId));

  const rows = conds.length
    ? await baseQuery.where(and(...conds)).orderBy(desc(paymentsTable.dueDate))
    : await baseQuery.orderBy(desc(paymentsTable.dueDate));

  // Auto-mark overdue
  const today = new Date().toISOString().slice(0, 10);
  const result = rows.map((r) => {
    let status = r.status;
    if (status === "pending" && r.dueDate < today) status = "overdue";
    return { ...r, amount: Number(r.amount), status };
  });
  res.json(result);
});

router.post("/payments", async (req, res) => {
  const body = CreatePaymentBody.parse(req.body);
  const [row] = await db
    .insert(paymentsTable)
    .values({
      ...body,
      amount: String(body.amount),
      dueDate: body.dueDate.toISOString().slice(0, 10),
      status: "pending",
    })
    .returning();
  res.status(201).json(ser(row));
});

router.post("/payments/:id/mark-paid", async (req, res) => {
  const { id } = MarkPaymentPaidParams.parse(req.params);
  const { method } = MarkPaymentPaidBody.parse(req.body);
  const [row] = await db
    .update(paymentsTable)
    .set({ status: "paid", method, paidDate: new Date().toISOString().slice(0, 10) })
    .where(eq(paymentsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(ser(row));
});

router.post("/payments/generate-monthly", async (req, res) => {
  const { month, year } = GenerateMonthlyRentBody.parse(req.body);
  const occupants = await db
    .select({
      tenantId: tenantsTable.id,
      monthlyRent: roomsTable.monthlyRent,
    })
    .from(tenantsTable)
    .innerJoin(bedsTable, eq(bedsTable.tenantId, tenantsTable.id))
    .innerJoin(roomsTable, eq(roomsTable.id, bedsTable.roomId))
    .where(eq(tenantsTable.status, "active"));

  // Find which tenants already have a payment for that month/year
  const existing = await db
    .select({ tenantId: paymentsTable.tenantId })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.month, month), eq(paymentsTable.year, year)));
  const existingSet = new Set(existing.map((e) => e.tenantId));

  const toCreate = occupants
    .filter((o) => !existingSet.has(o.tenantId))
    .map((o) => ({
      tenantId: o.tenantId,
      amount: String(o.monthlyRent),
      status: "pending",
      dueDate: `${year}-${String(month).padStart(2, "0")}-05`,
      month,
      year,
    }));

  if (toCreate.length) await db.insert(paymentsTable).values(toCreate);
  res.json({ generated: toCreate.length });
});

export default router;
// suppress unused
void sql;
