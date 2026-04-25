import { pgTable, text, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core';

export const otpVerifications = pgTable('otp_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  otpHash: text('otp_hash').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  verified: boolean('verified').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
