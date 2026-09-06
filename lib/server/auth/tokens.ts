import type { AuthFailureCode } from "@/lib/shared/auth";
import { signAccessToken } from "./jwt";
import type { SessionStore } from "./store";

export type TokenConfig = {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  sessionAbsoluteTtlSeconds: number;
  /** Window after rotation in which the old token is treated as a concurrent request, not theft. */
  refreshGraceSeconds: number;
  secret: Uint8Array;
};

export type IssuedAccess = { token: string; jti: string; expiresAt: Date };
export type IssuedRefresh = { token: string; id: string; expiresAt: Date };

export type IssuedSession = { sessionId: string; userId: string; access: IssuedAccess; refresh: IssuedRefresh };

export type RefreshOutcome =
  | { ok: true; kind: "rotated"; sessionId: string; userId: string; access: IssuedAccess; refresh: IssuedRefresh }
  | { ok: true; kind: "concurrent"; sessionId: string; userId: string; access: IssuedAccess }
  | { ok: false; reason: Extract<AuthFailureCode, "refresh_token_invalid" | "refresh_token_expired" | "session_revoked" | "session_expired" | "refresh_reuse_detected"> };

const encoder = new TextEncoder();

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Buffer.from(digest).toString("base64url");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * The whole token lifecycle. No HTTP, no cookies, no framework: those live one
 * layer up so this can be exercised directly by tests.
 */
export class TokenService {
  constructor(
    private readonly store: SessionStore,
    private readonly config: TokenConfig,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async issueSession(input: { userId: string; userAgent: string | null }): Promise<IssuedSession> {
    const now = this.clock();
    const sessionId = crypto.randomUUID();
    await this.store.createSession({
      id: sessionId,
      userId: input.userId,
      createdAt: now,
      absoluteExpiresAt: addSeconds(now, this.config.sessionAbsoluteTtlSeconds),
      revokedAt: null,
      revokeReason: null,
      userAgent: input.userAgent,
    });
    const refresh = await this.mintRefreshToken(sessionId, now);
    const access = await this.mintAccessToken(input.userId, sessionId, now);
    return { sessionId, userId: input.userId, access, refresh };
  }

  /**
   * Exchange a refresh token for a new access token, rotating the refresh token.
   *
   * Decision table for a token that has already been used:
   *   used within the grace window  -> concurrent refresh; issue an access token, keep the caller's cookies
   *   used before the grace window  -> reuse; revoke the whole session (every token in the family)
   */
  async refresh(presentedToken: string): Promise<RefreshOutcome> {
    const now = this.clock();
    const record = await this.store.findRefreshTokenByHash(await hashToken(presentedToken));
    if (!record) return { ok: false, reason: "refresh_token_invalid" };

    const session = await this.store.getSession(record.sessionId);
    if (!session) return { ok: false, reason: "refresh_token_invalid" };
    if (session.revokedAt) return { ok: false, reason: "session_revoked" };
    if (session.absoluteExpiresAt <= now) {
      await this.store.revokeSession(session.id, "absolute_expiry", now);
      return { ok: false, reason: "session_expired" };
    }

    if (record.usedAt === null) {
      if (record.expiresAt <= now) {
        await this.store.revokeSession(session.id, "refresh_expired", now);
        return { ok: false, reason: "refresh_token_expired" };
      }
      const replacementId = crypto.randomUUID();
      if (await this.store.claimRefreshToken(record.id, now, replacementId)) {
        const refresh = await this.mintRefreshToken(session.id, now, replacementId);
        const access = await this.mintAccessToken(session.userId, session.id, now);
        return { ok: true, kind: "rotated", sessionId: session.id, userId: session.userId, access, refresh };
      }
      // Lost the race to a concurrent request; fall through with the winner's timestamp.
      const fresh = await this.store.findRefreshTokenByHash(record.tokenHash);
      record.usedAt = fresh?.usedAt ?? now;
    }

    const secondsSinceUse = (now.getTime() - record.usedAt.getTime()) / 1000;
    if (secondsSinceUse <= this.config.refreshGraceSeconds) {
      const access = await this.mintAccessToken(session.userId, session.id, now);
      return { ok: true, kind: "concurrent", sessionId: session.id, userId: session.userId, access };
    }

    await this.store.revokeSession(session.id, "refresh_reuse", now);
    return { ok: false, reason: "refresh_reuse_detected" };
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.store.revokeSession(sessionId, reason, this.clock());
  }

  /** Resolves which session a refresh token belongs to without consuming it (used by sign-out). */
  async sessionIdForRefreshToken(token: string): Promise<string | null> {
    const record = await this.store.findRefreshTokenByHash(await hashToken(token));
    return record?.sessionId ?? null;
  }

  private async mintRefreshToken(sessionId: string, now: Date, id = crypto.randomUUID()): Promise<IssuedRefresh> {
    const token = randomToken();
    const expiresAt = addSeconds(now, this.config.refreshTtlSeconds);
    await this.store.insertRefreshToken({
      id,
      sessionId,
      tokenHash: await hashToken(token),
      createdAt: now,
      expiresAt,
      usedAt: null,
      replacedById: null,
    });
    return { token, id, expiresAt };
  }

  private mintAccessToken(userId: string, sessionId: string, now: Date): Promise<IssuedAccess> {
    return signAccessToken({ userId, sessionId, ttlSeconds: this.config.accessTtlSeconds, secret: this.config.secret, now });
  }
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
