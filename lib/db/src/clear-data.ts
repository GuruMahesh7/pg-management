import { db } from "./index";
import { 
  tenantsTable, 
  bedsTable, 
  roomsTable, 
  propertiesTable, 
  paymentsTable, 
  complaintsTable, 
  bookingRequestsTable,
  otpVerifications
} from "./schema";

async function clearData() {
  console.log("Cleaning up test data...");

  try {
    // Delete in reverse order of dependencies to avoid foreign key constraints
    await db.delete(paymentsTable);
    console.log("Cleared payments");
    
    await db.delete(complaintsTable);
    console.log("Cleared complaints");
    
    await db.delete(otpVerifications);
    console.log("Cleared OTPs");
    
    await db.delete(bookingRequestsTable);
    console.log("Cleared booking requests");
    
    // We need to unassign beds first
    await db.update(bedsTable).set({ tenantId: null, isOccupied: false });
    console.log("Unassigned all beds");
    
    await db.delete(tenantsTable);
    console.log("Cleared tenants");

    // Optional: Do we delete properties and rooms? 
    // They usually take a long time to set up. I'll leave them unless the user explicitly wants them gone.
    // If we want to delete them too:
    // await db.delete(bedsTable);
    // await db.delete(roomsTable);
    // await db.delete(propertiesTable);
    
    console.log("✅ Test data cleaned up successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error cleaning up data:", err);
    process.exit(1);
  }
}

clearData();
