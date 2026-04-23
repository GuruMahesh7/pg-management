import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  const tenants = await db.select().from(tenantsTable);
  console.log("Tenants in DB:");
  tenants.forEach(t => {
    console.log(`- ${t.email} / ID: ${t.id} / Status: ${t.status}`);
  });
  process.exit(0);
}
run();
