import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { bedsTable } from "./beds";

export const bookingRequestsTable = pgTable("booking_requests", {
  id: serial("id").primaryKey(),
  bedId: integer("bed_id").notNull().references(() => bedsTable.id, { onDelete: "cascade" }),
  applicantName: text("applicant_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  idNumber: text("id_number").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingRequest = typeof bookingRequestsTable.$inferSelect;
export type InsertBookingRequest = typeof bookingRequestsTable.$inferInsert;
