import type { RefreshTokenRecord, SessionRecord, SessionStore } from "./store";

/** In-memory store for tests. JavaScript's single thread makes `claim` atomic. */
export class MemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, SessionRecord>();
  readonly tokens = new Map<string, RefreshTokenRecord>();

  async createSession(session: SessionRecord & { userAgent: string | null }): Promise<void> {
    this.sessions.set(session.id, {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      revokedAt: session.revokedAt,
      revokeReason: session.revokeReason,
    });
  }
  async getSession(id: string): Promise<SessionRecord | null> {
    const s = this.sessions.get(id);
    return s ? { ...s } : null;
  }
  async revokeSession(id: string, reason: string, at: Date): Promise<void> {
    const s = this.sessions.get(id);
    if (s && !s.revokedAt) {
      s.revokedAt = at;
      s.revokeReason = reason;
    }
  }
  async insertRefreshToken(token: RefreshTokenRecord): Promise<void> {
    this.tokens.set(token.id, { ...token });
  }
  async findRefreshTokenByHash(hash: string): Promise<RefreshTokenRecord | null> {
    for (const t of this.tokens.values()) if (t.tokenHash === hash) return { ...t };
    return null;
  }
  async claimRefreshToken(id: string, usedAt: Date, replacedById: string): Promise<boolean> {
    const t = this.tokens.get(id);
    if (!t || t.usedAt) return false;
    t.usedAt = usedAt;
    t.replacedById = replacedById;
    return true;
  }
}
