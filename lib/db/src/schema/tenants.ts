import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash"),
  gender: text("gender"),
  dateOfBirth: date("date_of_birth"),
  occupation: text("occupation"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  idProofType: text("id_proof_type"),
  idProofNumber: text("id_proof_number"),
  permanentAddress: text("permanent_address"),
  joinedAt: date("joined_at").notNull(),
  status: text("status").notNull().default("active"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenantsTable.$inferSelect;
export type InsertTenant = typeof tenantsTable.$inferInsert;
