import { db, paymentsTable, tenantsTable } from "@workspace/db";
import { eq, and, lte, isNull, or, lt } from "drizzle-orm";

async function main() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  console.log("Today str:", todayStr);
  console.log("Yesterday:", yesterday);

  const payments = await db.select().from(paymentsTable);
  console.log("All payments:", payments);

  const pendingPayments = await db
    .select({
      paymentId: paymentsTable.id,
      amount: paymentsTable.amount,
      dueDate: paymentsTable.dueDate,
      tenantId: tenantsTable.id,
      tenantEmail: tenantsTable.email,
      lastReminderSentAt: paymentsTable.lastReminderSentAt,
      status: paymentsTable.status
    })
    .from(paymentsTable)
    .innerJoin(tenantsTable, eq(paymentsTable.tenantId, tenantsTable.id));
    
  console.log("Joined pending payments (all):", pendingPayments);

  const filtered = pendingPayments.filter(p => 
    p.status === "pending" && 
    p.dueDate !== null &&
    p.dueDate <= todayStr && 
    (p.lastReminderSentAt === null || p.lastReminderSentAt < yesterday)
  );

  console.log("Filtered in memory:", filtered);

  process.exit(0);
}

main().catch(console.error);
