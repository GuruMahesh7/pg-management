import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function run() {
  const hash = await bcrypt.hash("demo", 10);
  await db.update(tenantsTable).set({ passwordHash: hash }).where(eq(tenantsTable.email, "sia@gmail.com"));
  console.log("Updated sia@gmail.com password to 'demo'");
  process.exit(0);
}
run();
