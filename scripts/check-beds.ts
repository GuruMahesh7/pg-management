import { db, bedsTable, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function checkBeds() {
  const beds = await db.select({
    id: bedsTable.id,
    label: bedsTable.bedLabel,
    isOccupied: bedsTable.isOccupied,
    roomNumber: roomsTable.roomNumber
  })
  .from(bedsTable)
  .innerJoin(roomsTable, eq(roomsTable.id, bedsTable.roomId));

  console.log("Bed Status:");
  console.table(beds);
  process.exit(0);
}

checkBeds().catch(console.error);
