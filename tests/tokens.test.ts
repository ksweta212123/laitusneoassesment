import { describe, expect, it } from "vitest";
import { verifyAccessToken } from "@/lib/server/auth/jwt";
import { MemorySessionStore } from "@/lib/server/auth/memory-store";
import { TokenService, type TokenConfig } from "@/lib/server/auth/tokens";

const secret = new TextEncoder().encode("test-secret-test-secret-test-secret-1234");
const config: TokenConfig = {
  accessTtlSeconds: 60,
  refreshTtlSeconds: 3600,
  sessionAbsoluteTtlSeconds: 86_400,
  refreshGraceSeconds: 15,
  secret,
};

/** A clock the tests can move, so expiry is tested by advancing time, not by sleeping. */
function fixture(overrides: Partial<TokenConfig> = {}) {
  let now = new Date("2026-09-06T10:00:00Z");
  const store = new MemorySessionStore();
  const service = new TokenService(store, { ...config, ...overrides }, () => now);
  const advance = (seconds: number) => {
    now = new Date(now.getTime() + seconds * 1000);
  };
  return { store, service, advance, now: () => now };
}

describe("issueSession", () => {
  it("issues a verifiable access token bound to the session and user", async () => {
    const { service, now } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    const verified = await verifyAccessToken(issued.access.token, secret, now());
    expect(verified.ok && verified.claims.sub).toBe("user-1");
    expect(verified.ok && verified.claims.sid).toBe(issued.sessionId);
  });

  it("access token expires after its TTL and is rejected with token_expired", async () => {
    const { service, advance, now } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    advance(61 + 5); // past TTL and past the clock tolerance
    const verified = await verifyAccessToken(issued.access.token, secret, now());
    expect(verified).toEqual({ ok: false, reason: "token_expired" });
  });

  it("a token signed with another secret is token_invalid, never token_expired", async () => {
    const { service, now } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    const other = new TextEncoder().encode("another-secret-another-secret-another-1234");
    expect(await verifyAccessToken(issued.access.token, other, now())).toEqual({ ok: false, reason: "token_invalid" });
    expect(await verifyAccessToken("not.a.jwt", secret, now())).toEqual({ ok: false, reason: "token_invalid" });
  });
});

describe("refresh rotation", () => {
  it("rotates: a new refresh token is issued and the old one is marked used", async () => {
    const { service, store } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    const outcome = await service.refresh(issued.refresh.token);
    expect(outcome.ok && outcome.kind).toBe("rotated");
    if (!outcome.ok || outcome.kind !== "rotated") throw new Error("unreachable");
    expect(outcome.refresh.token).not.toBe(issued.refresh.token);
    const old = store.tokens.get(issued.refresh.id)!;
    expect(old.usedAt).not.toBeNull();
    expect(old.replacedById).toBe(outcome.refresh.id);
  });

  it("the rotated token refreshes again; a long chain stays on one session", async () => {
    const { service } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    let token = issued.refresh.token;
    for (let i = 0; i < 5; i++) {
      const outcome = await service.refresh(token);
      if (!outcome.ok || outcome.kind !== "rotated") throw new Error(`rotation ${i} failed`);
      expect(outcome.sessionId).toBe(issued.sessionId);
      token = outcome.refresh.token;
    }
  });

  it("an unknown token is refresh_token_invalid", async () => {
    const { service } = fixture();
    expect(await service.refresh("nope")).toEqual({ ok: false, reason: "refresh_token_invalid" });
  });

  it("an expired refresh token is refused and the session is closed", async () => {
    const { service, store, advance } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    advance(3601);
    expect(await service.refresh(issued.refresh.token)).toEqual({ ok: false, reason: "refresh_token_expired" });
    expect(store.sessions.get(issued.sessionId)!.revokeReason).toBe("refresh_expired");
  });

  it("the session's absolute lifetime wins even when the refresh token is still fresh", async () => {
    const { service, advance } = fixture({ refreshTtlSeconds: 10_000_000 });
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    advance(86_401);
    expect(await service.refresh(issued.refresh.token)).toEqual({ ok: false, reason: "session_expired" });
  });

  it("a revoked session refuses refresh with session_revoked", async () => {
    const { service } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    await service.revokeSession(issued.sessionId, "signed_out");
    expect(await service.refresh(issued.refresh.token)).toEqual({ ok: false, reason: "session_revoked" });
  });
});

describe("concurrent refresh (two tabs, one token)", () => {
  it("second use inside the grace window gets an access token and no new refresh token", async () => {
    const { service, advance } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    const first = await service.refresh(issued.refresh.token);
    advance(5);
    const second = await service.refresh(issued.refresh.token);
    expect(first.ok && first.kind).toBe("rotated");
    expect(second.ok && second.kind).toBe("concurrent");
    if (!second.ok || second.kind !== "concurrent") throw new Error("unreachable");
    expect(second.access.token).toBeTruthy();
  });

  it("truly simultaneous refreshes: exactly one rotates, the other is concurrent, nobody is signed out", async () => {
    const { service } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    const [a, b] = await Promise.all([service.refresh(issued.refresh.token), service.refresh(issued.refresh.token)]);
    const kinds = [a, b].map((o) => (o.ok ? o.kind : o.reason)).sort();
    expect(kinds).toEqual(["concurrent", "rotated"]);
  });

  it("the rotated child still works after a concurrent sibling request", async () => {
    const { service } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    const first = await service.refresh(issued.refresh.token);
    await service.refresh(issued.refresh.token);
    if (!first.ok || first.kind !== "rotated") throw new Error("unreachable");
    const next = await service.refresh(first.refresh.token);
    expect(next.ok && next.kind).toBe("rotated");
  });
});

describe("refresh token reuse (theft)", () => {
  it("use after the grace window revokes the whole family, including the newest token", async () => {
    const { service, store, advance } = fixture();
    const issued = await service.issueSession({ userId: "user-1", userAgent: null });
    const first = await service.refresh(issued.refresh.token);
    if (!first.ok || first.kind !== "rotated") throw new Error("unreachable");
    advance(16);
    expect(await service.refresh(issued.refresh.token)).toEqual({ ok: false, reason: "refresh_reuse_detected" });
    expect(store.sessions.get(issued.sessionId)!.revokeReason).toBe("refresh_reuse");
    // The legitimate holder of the newest token is signed out too: that is the point.
    expect(await service.refresh(first.refresh.token)).toEqual({ ok: false, reason: "session_revoked" });
  });

  it("grace window boundary: exactly at the limit is still concurrent, one second later is reuse", async () => {
    const at = fixture();
    const i1 = await at.service.issueSession({ userId: "u", userAgent: null });
    await at.service.refresh(i1.refresh.token);
    at.advance(15);
    expect((await at.service.refresh(i1.refresh.token)).ok).toBe(true);

    const after = fixture();
    const i2 = await after.service.issueSession({ userId: "u", userAgent: null });
    await after.service.refresh(i2.refresh.token);
    after.advance(16);
    expect((await after.service.refresh(i2.refresh.token)).ok).toBe(false);
  });
});
