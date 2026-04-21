import { Router, type IRouter } from "express";
import { db, roomsTable, bedsTable, propertiesTable, tenantsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  CreateRoomBody,
  UpdateRoomBody,
  UpdateRoomParams,
  DeleteRoomParams,
  ListRoomsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/rooms", async (req, res) => {
  const { propertyId } = ListRoomsQueryParams.parse(req.query);
  const rooms = propertyId
    ? await db.select().from(roomsTable).where(eq(roomsTable.propertyId, propertyId)).orderBy(asc(roomsTable.floor), asc(roomsTable.roomNumber))
    : await db.select().from(roomsTable).orderBy(asc(roomsTable.propertyId), asc(roomsTable.floor), asc(roomsTable.roomNumber));

  const props = await db.select().from(propertiesTable);
  const propMap = new Map(props.map((p) => [p.id, p.name]));

  const beds = await db
    .select({
      id: bedsTable.id,
      roomId: bedsTable.roomId,
      bedLabel: bedsTable.bedLabel,
      isOccupied: bedsTable.isOccupied,
      tenantId: bedsTable.tenantId,
      tenantName: tenantsTable.fullName,
    })
    .from(bedsTable)
    .leftJoin(tenantsTable, eq(bedsTable.tenantId, tenantsTable.id))
    .orderBy(asc(bedsTable.bedLabel));

  const bedsByRoom = new Map<number, typeof beds>();
  for (const b of beds) {
    if (!bedsByRoom.has(b.roomId)) bedsByRoom.set(b.roomId, []);
    bedsByRoom.get(b.roomId)!.push(b);
  }

  const result = rooms.map((r) => {
    const roomBeds = bedsByRoom.get(r.id) ?? [];
    return {
      ...r,
      monthlyRent: Number(r.monthlyRent),
      propertyName: propMap.get(r.propertyId) ?? "",
      beds: roomBeds,
      occupiedCount: roomBeds.filter((b) => b.isOccupied).length,
    };
  });
  res.json(result);
});

router.post("/rooms", async (req, res) => {
  const body = CreateRoomBody.parse(req.body);
  const [room] = await db
    .insert(roomsTable)
    .values({ ...body, monthlyRent: String(body.monthlyRent) })
    .returning();
  // Create beds for capacity
  const bedRows = Array.from({ length: room.capacity }, (_, i) => ({
    roomId: room.id,
    bedLabel: `${room.roomNumber}-${String.fromCharCode(65 + i)}`,
    isOccupied: false,
  }));
  await db.insert(bedsTable).values(bedRows);
  res.status(201).json({ ...room, monthlyRent: Number(room.monthlyRent) });
});

router.patch("/rooms/:id", async (req, res) => {
  const { id } = UpdateRoomParams.parse(req.params);
  const body = UpdateRoomBody.parse(req.body);
  const [row] = await db
    .update(roomsTable)
    .set({ ...body, monthlyRent: String(body.monthlyRent) })
    .where(eq(roomsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ...row, monthlyRent: Number(row.monthlyRent) });
});

router.delete("/rooms/:id", async (req, res) => {
  const { id } = DeleteRoomParams.parse(req.params);
  await db.delete(roomsTable).where(eq(roomsTable.id, id));
  res.status(204).end();
});

export default router;
