import { Router, type IRouter } from "express";
import { db, propertiesTable, roomsTable, bedsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  UpdatePropertyParams,
  GetPropertyParams,
  DeletePropertyParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/properties", async (_req, res) => {
  const rows = await db.select().from(propertiesTable).orderBy(propertiesTable.id);
  res.json(rows);
});

router.post("/properties", async (req, res) => {
  const body = CreatePropertyBody.parse(req.body);
  const [row] = await db.insert(propertiesTable).values(body).returning();
  res.status(201).json(row);
});

router.get("/properties/:id", async (req, res) => {
  const { id } = GetPropertyParams.parse(req.params);
  const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!prop) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [stats] = await db
    .select({
      totalRooms: sql<number>`count(distinct ${roomsTable.id})::int`,
      totalBeds: sql<number>`count(${bedsTable.id})::int`,
      occupiedBeds: sql<number>`count(case when ${bedsTable.isOccupied} then 1 end)::int`,
    })
    .from(roomsTable)
    .leftJoin(bedsTable, eq(bedsTable.roomId, roomsTable.id))
    .where(eq(roomsTable.propertyId, id));
  res.json({ ...prop, ...stats });
});

router.patch("/properties/:id", async (req, res) => {
  const { id } = UpdatePropertyParams.parse(req.params);
  const body = UpdatePropertyBody.parse(req.body);
  const [row] = await db.update(propertiesTable).set(body).where(eq(propertiesTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/properties/:id", async (req, res) => {
  const { id } = DeletePropertyParams.parse(req.params);
  await db.delete(propertiesTable).where(eq(propertiesTable.id, id));
  res.status(204).end();
});

export default router;
