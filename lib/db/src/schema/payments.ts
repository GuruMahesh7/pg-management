import { pgTable, serial, integer, numeric, text, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { bookingRequestsTable } from "./booking_requests";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }),
  bookingRequestId: integer("booking_request_id").references(() => bookingRequestsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, success, failed
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  dueDate: date("due_date"),
  paidDate: timestamp("paid_date", { withTimezone: true }),
  month: integer("month"),
  year: integer("year"),
  method: text("method"),
  notes: text("notes"),
  lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqRazorpayPayment: uniqueIndex("payments_unique_razorpay_payment").on(t.razorpayPaymentId),
}));


export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = typeof paymentsTable.$inferInsert;
