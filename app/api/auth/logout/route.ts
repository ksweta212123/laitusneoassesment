import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/server/auth/authenticate";
import { clearAuthCookies, readRefreshCookie } from "@/lib/server/auth/cookies";
import { getTokenService } from "@/lib/server/auth/service";
import { jsonOk, rejectCrossSite } from "@/lib/server/http/responses";

/**
 * Sign-out must work even when the access token has already expired, so the
 * session is located through whichever credential is still usable.
 * It never fails: the cookies are cleared regardless.
 */
export async function POST(req: NextRequest) {
  const crossSite = rejectCrossSite(req);
  if (crossSite) return crossSite;

  const tokens = await getTokenService();
  let sessionId: string | null = null;
  const auth = await authenticate(req);
  if (auth.ok) sessionId = auth.ctx.session.id;
  else {
    const refresh = readRefreshCookie(req);
    if (refresh) sessionId = await tokens.sessionIdForRefreshToken(refresh);
  }
  if (sessionId) await tokens.revokeSession(sessionId, "signed_out");

  const res = jsonOk({ ok: true });
  clearAuthCookies(res);
  return res;
}
