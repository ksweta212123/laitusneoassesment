import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAMES } from "./config";
import type { IssuedAccess, IssuedRefresh } from "./tokens";

/**
 * Both tokens live in httpOnly cookies. See NOTES.md for what breaks under the
 * alternatives (localStorage, memory, a single long-lived cookie).
 *
 * SameSite=Lax rather than Strict: Strict would drop the cookies on any
 * top-level navigation from another site (a link in an email or a chat), so an
 * operator following a link to a merchant would land on the login page for a
 * reason they did not cause. Lax still withholds cookies from cross-site POSTs.
 */
const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setAccessCookie(res: NextResponse, access: IssuedAccess): void {
  res.cookies.set(COOKIE_NAMES.access, access.token, { ...base, expires: access.expiresAt });
}

export function setRefreshCookie(res: NextResponse, refresh: IssuedRefresh): void {
  res.cookies.set(COOKIE_NAMES.refresh, refresh.token, { ...base, expires: refresh.expiresAt });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(COOKIE_NAMES.access, "", { ...base, maxAge: 0 });
  res.cookies.set(COOKIE_NAMES.refresh, "", { ...base, maxAge: 0 });
}

export function readRefreshCookie(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAMES.refresh)?.value || null;
}

/** Cookie first; a Bearer header is also accepted so the API can be driven from curl. */
export function readAccessToken(req: NextRequest): string | null {
  const fromCookie = req.cookies.get(COOKIE_NAMES.access)?.value;
  if (fromCookie) return fromCookie;
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim() || null;
  return null;
}
