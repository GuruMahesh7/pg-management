import { db, propertiesTable, roomsTable, bedsTable, tenantsTable, paymentsTable, complaintsTable } from "@workspace/db";

async function main() {
  const existing = await db.select().from(propertiesTable);
  if (existing.length > 0) {
    console.log("Seed already applied. Skipping.");
    process.exit(0);
  }

  const props = await db.insert(propertiesTable).values([
    { name: "Stayflow Indiranagar", address: "201 100ft Road, Indiranagar", city: "Bengaluru", totalFloors: 3, contactPhone: "+91 98450 11122", description: "Premium PG for working professionals near Metro." },
    { name: "Stayflow Koramangala", address: "5th Block, Koramangala", city: "Bengaluru", totalFloors: 4, contactPhone: "+91 98450 33344", description: "Cozy hostel close to startup hubs." },
  ]).returning();

  const roomsData = [
    { propertyId: props[0].id, roomNumber: "101", floor: 1, capacity: 3, monthlyRent: "9500", roomType: "triple", amenities: "AC, Attached bath, Wi-Fi" },
    { propertyId: props[0].id, roomNumber: "102", floor: 1, capacity: 2, monthlyRent: "11500", roomType: "double", amenities: "AC, Balcony" },
    { propertyId: props[0].id, roomNumber: "201", floor: 2, capacity: 1, monthlyRent: "16500", roomType: "single", amenities: "AC, Attached bath, Study desk" },
    { propertyId: props[0].id, roomNumber: "202", floor: 2, capacity: 4, monthlyRent: "8500", roomType: "quad", amenities: "Fan, Wi-Fi" },
    { propertyId: props[1].id, roomNumber: "G1", floor: 1, capacity: 2, monthlyRent: "12000", roomType: "double", amenities: "AC, Balcony" },
    { propertyId: props[1].id, roomNumber: "G2", floor: 1, capacity: 3, monthlyRent: "9000", roomType: "triple", amenities: "Fan, Wi-Fi" },
  ];
  const rooms = await db.insert(roomsTable).values(roomsData).returning();

  for (const r of rooms) {
    const bedRows = Array.from({ length: r.capacity }, (_, i) => ({
      roomId: r.id,
      bedLabel: `${r.roomNumber}-${String.fromCharCode(65 + i)}`,
      isOccupied: false,
    }));
    await db.insert(bedsTable).values(bedRows);
  }

  const tenants = await db.insert(tenantsTable).values([
    { fullName: "Aarav Sharma", email: "aarav@example.com", phone: "+91 9988770011", gender: "male", occupation: "Software Engineer", emergencyContactName: "Rohit Sharma", emergencyContactPhone: "+91 9988770099", idProofType: "aadhaar", idProofNumber: "1234-5678-9012", permanentAddress: "Pune, MH", joinedAt: "2025-08-01", status: "active" },
    { fullName: "Priya Iyer", email: "priya@example.com", phone: "+91 9988770022", gender: "female", occupation: "Product Designer", emergencyContactName: "Lakshmi Iyer", emergencyContactPhone: "+91 9988770088", idProofType: "passport", idProofNumber: "M2345678", permanentAddress: "Chennai, TN", joinedAt: "2025-09-15", status: "active" },
    { fullName: "Vikram Mehta", email: "vikram@example.com", phone: "+91 9988770033", gender: "male", occupation: "MBA Student", emergencyContactName: "Sunita Mehta", emergencyContactPhone: "+91 9988770077", idProofType: "aadhaar", idProofNumber: "2345-6789-0123", permanentAddress: "Ahmedabad, GJ", joinedAt: "2025-07-10", status: "active" },
    { fullName: "Ananya Reddy", email: "ananya@example.com", phone: "+91 9988770044", gender: "female", occupation: "Data Analyst", emergencyContactName: "Suresh Reddy", emergencyContactPhone: "+91 9988770066", idProofType: "driving_license", idProofNumber: "KA0420220001", permanentAddress: "Hyderabad, TS", joinedAt: "2026-01-05", status: "active" },
    { fullName: "Rohit Nair", email: "rohit@example.com", phone: "+91 9988770055", gender: "male", occupation: "Marketing Lead", emergencyContactName: "Geeta Nair", emergencyContactPhone: "+91 9988770044", idProofType: "aadhaar", idProofNumber: "3456-7890-1234", permanentAddress: "Kochi, KL", joinedAt: "2025-11-20", status: "active" },
    { fullName: "Sneha Kapoor", email: "sneha@example.com", phone: "+91 9988770066", gender: "female", occupation: "UX Researcher", emergencyContactName: "Mohan Kapoor", emergencyContactPhone: "+91 9988770033", idProofType: "pan", idProofNumber: "ABCDE1234F", permanentAddress: "New Delhi", joinedAt: "2025-10-12", status: "active" },
  ]).returning();

  // Assign tenants to beds
  const allBeds = await db.select().from(bedsTable);
  const assignments = [
    { tenantId: tenants[0].id, bedIdx: 0 },
    { tenantId: tenants[1].id, bedIdx: 1 },
    { tenantId: tenants[2].id, bedIdx: 3 },
    { tenantId: tenants[3].id, bedIdx: 5 },
    { tenantId: tenants[4].id, bedIdx: 9 },
    { tenantId: tenants[5].id, bedIdx: 12 },
  ];
  for (const a of assignments) {
    const bed = allBeds[a.bedIdx];
    if (bed) {
      await db.update(bedsTable).set({ tenantId: a.tenantId, isOccupied: true }).where(eqId(bedsTable, bed.id));
    }
  }

  // Generate payments for current month + previous 2 months
  const now = new Date();
  const months = [
    { m: now.getMonth() + 1, y: now.getFullYear() },
    { m: ((now.getMonth() + 11) % 12) + 1, y: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() },
    { m: ((now.getMonth() + 10) % 12) + 1, y: now.getMonth() <= 1 ? now.getFullYear() - 1 : now.getFullYear() },
  ];

  for (const t of tenants) {
    // find their bed/room
    const bed = (await db.select().from(bedsTable)).find((b) => b.tenantId === t.id);
    if (!bed) continue;
    const [room] = await db.select().from(roomsTable).where(eqId(roomsTable, bed.roomId));
    if (!room) continue;
    for (let i = 0; i < months.length; i++) {
      const mm = months[i];
      const due = `${mm.y}-${String(mm.m).padStart(2, "0")}-05`;
      const isPast = i > 0;
      const isPaid = isPast && t.id !== tenants[2].id;
      await db.insert(paymentsTable).values({
        tenantId: t.id,
        amount: String(room.monthlyRent),
        status: isPaid ? "success" : "pending",
        dueDate: due,
        paidDate: isPaid ? new Date(due) : null,
        method: isPaid ? "upi" : null,
        month: mm.m,
        year: mm.y,
      });
    }
  }

  await db.insert(complaintsTable).values([
    { tenantId: tenants[0].id, category: "plumbing", title: "Leaking tap in bathroom", description: "The cold-water tap has been dripping continuously for two days.", priority: "medium", status: "open" },
    { tenantId: tenants[1].id, category: "internet", title: "Wi-Fi very slow in evenings", description: "After 8pm the speed drops to under 2 Mbps making calls impossible.", priority: "high", status: "in_progress" },
    { tenantId: tenants[3].id, category: "electricity", title: "Power socket near desk not working", description: "The two-pin socket near my study desk has stopped working.", priority: "low", status: "resolved", resolutionNote: "Electrician replaced the socket on 18 Apr." },
    { tenantId: tenants[4].id, category: "cleaning", title: "Common area needs deeper cleaning", description: "The hallway on second floor has been missed for the last 3 days.", priority: "medium", status: "open" },
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

import { eq } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";
function eqId(table: { id: any }, id: number) {
  return eq((table as any).id, id);
}
void ({} as PgTableWithColumns<any>);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
