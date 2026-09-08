import { bigint, pgEnum, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const userRole = pgEnum("user_role", ["viewer", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  disabledAt: ts("disabled_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** One session per sign-in. It is the "family" that every rotated refresh token belongs to. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: ts("created_at").notNull(),
  absoluteExpiresAt: ts("absolute_expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  revokeReason: text("revoke_reason"),
  userAgent: text("user_agent"),
});

/** Only the SHA-256 of the token is stored. A database leak does not leak sessions. */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: ts("created_at").notNull(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  replacedById: uuid("replaced_by_id"),
});

export const merchantStatus = pgEnum("merchant_status", ["onboarding", "active", "suspended"]);

export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  legalName: text("legal_name").notNull(),
  city: text("city").notNull(),
  gstin: text("gstin").notNull(),
  status: merchantStatus("status").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  statusChangedAt: ts("status_changed_at"),
  statusChangedBy: uuid("status_changed_by").references(() => users.id),
});

export const transactionStatus = pgEnum("transaction_status", ["pending", "settled", "failed"]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id),
  reference: text("reference").notNull().unique(),
  /** Integer minor units. bigint mode so it is a JS BigInt, never a double. */
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  exponent: smallint("exponent").notNull(),
  status: transactionStatus("status").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
