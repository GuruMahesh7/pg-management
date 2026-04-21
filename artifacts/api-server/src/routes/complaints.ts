import { Router, type IRouter } from "express";
import { db, complaintsTable, tenantsTable, bedsTable, roomsTable, propertiesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateComplaintBody,
  ListComplaintsQueryParams,
  UpdateComplaintStatusBody,
  UpdateComplaintStatusParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/complaints", async (req, res) => {
  const { status } = ListComplaintsQueryParams.parse(req.query);
  const baseQuery = db
    .select({
      id: complaintsTable.id,
      tenantId: complaintsTable.tenantId,
      category: complaintsTable.category,
      title: complaintsTable.title,
      description: complaintsTable.description,
      priority: complaintsTable.priority,
      status: complaintsTable.status,
      resolutionNote: complaintsTable.resolutionNote,
      createdAt: complaintsTable.createdAt,
      resolvedAt: complaintsTable.resolvedAt,
      tenantName: tenantsTable.fullName,
      roomNumber: roomsTable.roomNumber,
      propertyName: propertiesTable.name,
    })
    .from(complaintsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, complaintsTable.tenantId))
    .leftJoin(bedsTable, eq(bedsTable.tenantId, tenantsTable.id))
    .leftJoin(roomsTable, eq(roomsTable.id, bedsTable.roomId))
    .leftJoin(propertiesTable, eq(propertiesTable.id, roomsTable.propertyId));

  const rows = status
    ? await baseQuery.where(and(eq(complaintsTable.status, status))).orderBy(desc(complaintsTable.createdAt))
    : await baseQuery.orderBy(desc(complaintsTable.createdAt));
  res.json(rows);
});

router.post("/complaints", async (req, res) => {
  const body = CreateComplaintBody.parse(req.body);
  const [row] = await db.insert(complaintsTable).values({ ...body, status: "open" }).returning();
  res.status(201).json(row);
});

router.patch("/complaints/:id", async (req, res) => {
  const { id } = UpdateComplaintStatusParams.parse(req.params);
  const { status, resolutionNote } = UpdateComplaintStatusBody.parse(req.body);
  const update: Record<string, unknown> = { status };
  if (resolutionNote !== undefined) update.resolutionNote = resolutionNote;
  if (status === "resolved") update.resolvedAt = new Date();
  const [row] = await db.update(complaintsTable).set(update).where(eq(complaintsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

export default router;
