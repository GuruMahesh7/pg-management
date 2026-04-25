import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const adminsTable = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("admins_email_unique").on(table.email),
  }),
);

export type Admin = typeof adminsTable.$inferSelect;
export type InsertAdmin = typeof adminsTable.$inferInsert;
