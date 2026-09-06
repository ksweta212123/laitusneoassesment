import "server-only";
import { eq } from "drizzle-orm";
import type { UserDto } from "@/lib/shared/api";
import { getDb } from "../db/client";
import { users } from "../db/schema";

export type UserRow = typeof users.$inferSelect;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return row ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export function toUserDto(user: UserRow): UserDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
