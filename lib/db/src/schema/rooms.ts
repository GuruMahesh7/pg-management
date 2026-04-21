import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  roomNumber: text("room_number").notNull(),
  floor: integer("floor").notNull().default(1),
  capacity: integer("capacity").notNull().default(1),
  monthlyRent: numeric("monthly_rent", { precision: 10, scale: 2 }).notNull(),
  roomType: text("room_type").notNull().default("single"),
  amenities: text("amenities"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Room = typeof roomsTable.$inferSelect;
export type InsertRoom = typeof roomsTable.$inferInsert;
