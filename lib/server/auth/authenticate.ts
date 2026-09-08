import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import type { AuthFailureCode, Role } from "@/lib/shared/auth";
import { jsonError } from "../http/responses";
import { loadTokenConfig } from "./config";
import { readAccessToken } from "./cookies";
import { verifyAccessToken, type AccessClaims } from "./jwt";
import { getSessionStore } from "./session-store";
import { findUserById, type UserRow } from "./users";

export type AuthContext = {
  user: UserRow;
  claims: AccessClaims;
  session: { id: string; createdAt: Date; absoluteExpiresAt: Date };
};

export type AuthResult = { ok: true; ctx: AuthContext } | { ok: false; reason: AuthFailureCode };

/**
 * Authenticates an API request. The JWT proves who signed it; the session store
 * decides whether that session and user are still allowed in. Revoking a
 * session or disabling an operator therefore takes effect on the next request,
 * not when the access token happens to expire.
 */
export async function authenticate(req: NextRequest): Promise<AuthResult> {
  const token = readAccessToken(req);
  if (!token) return { ok: false, reason: "no_token" };

  const verified = await verifyAccessToken(token, loadTokenConfig().secret);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const store = await getSessionStore();
  const session = await store.getSession(verified.claims.sid);
  if (!session) return { ok: false, reason: "token_invalid" };
  if (session.revokedAt) return { ok: false, reason: "session_revoked" };
  if (session.absoluteExpiresAt <= new Date()) return { ok: false, reason: "session_expired" };

  const user = await findUserById(verified.claims.sub);
  if (!user) return { ok: false, reason: "token_invalid" };
  if (user.disabledAt) return { ok: false, reason: "user_disabled" };

  return { ok: true, ctx: { user, claims: verified.claims, session } };
}

const FAILURE_MESSAGES: Record<AuthFailureCode, string> = {
  no_token: "No access token was presented.",
  token_expired: "The access token has expired.",
  token_invalid: "The access token could not be verified.",
  refresh_token_invalid: "The refresh token could not be verified.",
  refresh_token_expired: "The refresh token has expired.",
  session_revoked: "The session has been revoked.",
  session_expired: "The session has reached its maximum lifetime.",
  refresh_reuse_detected: "The refresh token was reused; the session has been revoked.",
  user_disabled: "The operator account is disabled.",
};

export function unauthenticated(reason: AuthFailureCode): NextResponse {
  return jsonError(401, "unauthenticated", FAILURE_MESSAGES[reason], reason);
}

type Handler<Ctx> = (req: NextRequest, ctx: Ctx, auth: AuthContext) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler with authentication and an optional role requirement.
 * A missing role is a 403, never a 401: the operator is who they say they are,
 * they simply may not do this, and they must not be signed out for trying.
 */
export function withAuth<Ctx>(handler: Handler<Ctx>, options: { role?: Role } = {}) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    const result = await authenticate(req);
    if (!result.ok) return unauthenticated(result.reason);
    if (options.role && result.ctx.user.role !== options.role) {
      return jsonError(403, "forbidden", `This action requires the ${options.role} role.`);
    }
    return handler(req, ctx, result.ctx);
  };
}
