/**
 * Persistence contract for the token lifecycle. The token service depends on
 * this interface only, so the rotation logic is tested against an in-memory
 * implementation and runs in production against Postgres.
 */
export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
};

export type RefreshTokenRecord = {
  id: string;
  sessionId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  replacedById: string | null;
};

export interface SessionStore {
  createSession(session: SessionRecord & { userAgent: string | null }): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  revokeSession(id: string, reason: string, at: Date): Promise<void>;
  insertRefreshToken(token: RefreshTokenRecord): Promise<void>;
  findRefreshTokenByHash(hash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Marks the token as used, but only if it has not been used already.
   * Must be atomic: of two concurrent callers exactly one gets `true`.
   */
  claimRefreshToken(id: string, usedAt: Date, replacedById: string): Promise<boolean>;
}
