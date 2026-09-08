import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { refreshTokens, sessions } from "../db/schema";
import type { RefreshTokenRecord, SessionRecord, SessionStore } from "./store";

export class DrizzleSessionStore implements SessionStore {
  constructor(private readonly db: Db) {}

  async createSession(session: SessionRecord & { userAgent: string | null }): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return row ?? null;
  }

  async revokeSession(id: string, reason: string, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at, revokeReason: reason })
      .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
  }

  async insertRefreshToken(token: RefreshTokenRecord): Promise<void> {
    await this.db.insert(refreshTokens).values(token);
  }

  async findRefreshTokenByHash(hash: string): Promise<RefreshTokenRecord | null> {
    const [row] = await this.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash)).limit(1);
    return row ?? null;
  }

  /** The `used_at IS NULL` predicate makes Postgres decide the race, not the application. */
  async claimRefreshToken(id: string, usedAt: Date, replacedById: string): Promise<boolean> {
    const claimed = await this.db
      .update(refreshTokens)
      .set({ usedAt, replacedById })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.usedAt)))
      .returning({ id: refreshTokens.id });
    return claimed.length === 1;
  }
}
