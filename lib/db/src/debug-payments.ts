import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { paymentsTable } from "./schema/payments.js";
import { tenantsTable } from "./schema/tenants.js";
import { eq, and, lte, or, isNull, lt } from "drizzle-orm";
import dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const pendingPayments = await db
    .select({
      paymentId: paymentsTable.id,
      dueDate: paymentsTable.dueDate,
      status: paymentsTable.status,
      tenantId: tenantsTable.id,
      tenantEmail: tenantsTable.email,
      lastReminderSentAt: paymentsTable.lastReminderSentAt
    })
    .from(paymentsTable)
    .innerJoin(tenantsTable, eq(paymentsTable.tenantId, tenantsTable.id));
    
  console.log("All pending payments in DB:", pendingPayments);

  const matched = await db
      .select({
        paymentId: paymentsTable.id,
      })
      .from(paymentsTable)
      .innerJoin(tenantsTable, eq(paymentsTable.tenantId, tenantsTable.id))
      .where(
        and(
          eq(paymentsTable.status, "pending"),
          lte(paymentsTable.dueDate, todayStr),
          or(
            isNull(paymentsTable.lastReminderSentAt),
            lt(paymentsTable.lastReminderSentAt, yesterday)
          )
        )
      );

  console.log("Matched for reminder:", matched);

  process.exit(0);
}

main().catch(console.error);
