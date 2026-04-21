import { Router, type IRouter } from "express";
import { db, bedsTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AssignBedBody, AssignBedParams, UnassignBedParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/beds/:id/assign", async (req, res) => {
  const { id } = AssignBedParams.parse(req.params);
  const { tenantId } = AssignBedBody.parse(req.body);
  // Free this tenant from any prior bed
  await db.update(bedsTable).set({ tenantId: null, isOccupied: false }).where(eq(bedsTable.tenantId, tenantId));
  const [row] = await db
    .update(bedsTable)
    .set({ tenantId, isOccupied: true })
    .where(eq(bedsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  res.json({ ...row, tenantName: tenant?.fullName ?? null });
});

router.post("/beds/:id/unassign", async (req, res) => {
  const { id } = UnassignBedParams.parse(req.params);
  const [row] = await db
    .update(bedsTable)
    .set({ tenantId: null, isOccupied: false })
    .where(eq(bedsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ...row, tenantName: null });
});

export default router;
