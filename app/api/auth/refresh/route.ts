import type { NextRequest } from "next/server";
import { unauthenticated } from "@/lib/server/auth/authenticate";
import { clearAuthCookies, readRefreshCookie, setAccessCookie, setRefreshCookie } from "@/lib/server/auth/cookies";
import { getTokenService } from "@/lib/server/auth/service";
import { jsonOk, rejectCrossSite } from "@/lib/server/http/responses";
import type { RefreshResponse } from "@/lib/shared/api";

/**
 * Exchanges the refresh cookie for a new access token, rotating the refresh
 * token. Every failure clears both cookies and names its reason so the login
 * page can tell the operator what happened.
 */
export async function POST(req: NextRequest) {
  const crossSite = rejectCrossSite(req);
  if (crossSite) return crossSite;

  const presented = readRefreshCookie(req) ?? bearer(req);
  if (!presented) {
    const res = unauthenticated("refresh_token_invalid");
    clearAuthCookies(res);
    return res;
  }

  const tokens = await getTokenService();
  const outcome = await tokens.refresh(presented);
  if (!outcome.ok) {
    const res = unauthenticated(outcome.reason);
    clearAuthCookies(res);
    return res;
  }

  const body: RefreshResponse = {
    rotated: outcome.kind === "rotated",
    sessionId: outcome.sessionId,
    accessToken: { jti: outcome.access.jti, expiresAt: outcome.access.expiresAt.toISOString() },
  };
  if (outcome.kind === "rotated") {
    body.refreshToken = { id: outcome.refresh.id, expiresAt: outcome.refresh.expiresAt.toISOString() };
  }

  const res = jsonOk(body);
  setAccessCookie(res, outcome.access);
  // On a concurrent refresh the winner already set the newer refresh cookie in
  // this browser. Setting one here would overwrite it with nothing better.
  if (outcome.kind === "rotated") setRefreshCookie(res, outcome.refresh);
  return res;
}

/** Allows `Authorization: Bearer <refresh token>` so the rotation can be driven from curl. */
function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  return header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() || null : null;
}
