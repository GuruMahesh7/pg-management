import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { roomsTable } from "./rooms";
import { tenantsTable } from "./tenants";

export const bedsTable = pgTable("beds", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  bedLabel: text("bed_label").notNull(),
  isOccupied: boolean("is_occupied").notNull().default(false),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqTenant: uniqueIndex("beds_unique_tenant").on(t.tenantId),
}));

export type Bed = typeof bedsTable.$inferSelect;
export type InsertBed = typeof bedsTable.$inferInsert;
