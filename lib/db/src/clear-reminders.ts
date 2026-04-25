import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { paymentsTable } from "./schema/payments.js";
import dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  await db.update(paymentsTable).set({ lastReminderSentAt: null });
  console.log("Cleared lastReminderSentAt for all payments!");
  process.exit(0);
}

main().catch(console.error);
