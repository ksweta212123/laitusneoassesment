import type { NextRequest } from "next/server";
import { setAccessCookie, setRefreshCookie } from "@/lib/server/auth/cookies";
import { DUMMY_HASH_PROMISE, verifyPassword } from "@/lib/server/auth/password";
import { getTokenService } from "@/lib/server/auth/service";
import { findUserByEmail, toUserDto } from "@/lib/server/auth/users";
import { jsonError, jsonOk, readJsonBody, rejectCrossSite } from "@/lib/server/http/responses";
import type { LoginRequest, LoginResponse } from "@/lib/shared/api";

export async function POST(req: NextRequest) {
  const crossSite = rejectCrossSite(req);
  if (crossSite) return crossSite;

  const body = await readJsonBody<LoginRequest>(req);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return jsonError(400, "invalid_request", "Email and password are required.");

  const user = await findUserByEmail(email);
  // Always run one password verification so a missing account takes as long as a wrong password.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH_PROMISE));
  if (!user || !valid) return jsonError(401, "invalid_credentials", "Incorrect email or password.");
  if (user.disabledAt) return jsonError(403, "user_disabled", "This account has been disabled.");

  const tokens = await getTokenService();
  const issued = await tokens.issueSession({ userId: user.id, userAgent: req.headers.get("user-agent") });

  const res = jsonOk<LoginResponse>({ user: toUserDto(user), session: { id: issued.sessionId } });
  setAccessCookie(res, issued.access);
  setRefreshCookie(res, issued.refresh);
  return res;
}
