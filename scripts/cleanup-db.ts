import { db, propertiesTable, roomsTable, bedsTable, tenantsTable, paymentsTable, bookingRequestsTable, complaintsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function cleanup() {
  console.log("Cleaning up test database (tenants, payments, bookings)...");
  
  try {
    // Delete transactional data
    await db.delete(paymentsTable);
    await db.delete(complaintsTable);
    await db.delete(bookingRequestsTable);
    await db.delete(tenantsTable);
    
    // Reset all beds to unoccupied
    await db.execute(sql`UPDATE ${bedsTable} SET is_occupied = false, tenant_id = NULL`);
    
    console.log("Database cleaned successfully! Properties and rooms are intact.");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    process.exit(0);
  }
}

cleanup();
