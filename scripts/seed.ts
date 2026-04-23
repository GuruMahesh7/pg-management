import { db, propertiesTable, roomsTable, bedsTable } from "@workspace/db";
import { properties } from "../../home-haven-connect/src/data/mock";

async function run() {
  console.log("Seeding properties from mock data...");
  
  for (const p of properties) {
    console.log("Inserting property:", p.name);
    const [prop] = await db.insert(propertiesTable).values({
      name: p.name,
      address: p.neighbourhood,
      city: p.city,
      totalFloors: Math.max(...p.rooms.map(r => r.floor)),
      contactPhone: "9999999999",
      description: p.tagline,
    }).returning();

    for (const r of p.rooms) {
      console.log("  Inserting room:", r.number);
      const [room] = await db.insert(roomsTable).values({
        propertyId: prop.id,
        roomNumber: r.number,
        floor: r.floor,
        capacity: r.sharing,
        monthlyRent: String(r.beds[0]?.monthlyRent ?? p.startingRent),
        roomType: r.sharing === 1 ? "single" : "shared",
        amenities: r.amenities.join(", ")
      }).returning();

      for (const b of r.beds) {
        console.log("    Inserting bed:", b.label);
        await db.insert(bedsTable).values({
          roomId: room.id,
          bedLabel: b.label,
          isOccupied: b.occupied,
        });
      }
    }
  }
  
  console.log("Seed complete!");
  process.exit(0);
}

run().catch(console.error);
