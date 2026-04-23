import { db, propertiesTable, roomsTable, bedsTable, tenantsTable, paymentsTable, bookingRequestsTable, complaintsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function cleanup() {
  console.log("Cleaning up database...");
  
  try {
    // Truncate tables with CASCADE to handle foreign key constraints
    // Using raw SQL for truncate as Drizzle doesn't have a direct truncate method with cascade easily accessible across all drivers
    await db.execute(sql`TRUNCATE TABLE ${propertiesTable}, ${tenantsTable}, ${bookingRequestsTable} CASCADE`);
    
    console.log("Database cleaned successfully!");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    process.exit(0);
  }
}

cleanup();
