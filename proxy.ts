import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAMES, loadTokenConfig } from "@/lib/server/auth/config";
import { verifyAccessToken } from "@/lib/server/auth/jwt";
import { safeNextPath } from "@/lib/shared/auth";

/**
 * Optimistic gate for page navigations. It only checks what it can check
 * without a database: is there a verifiable access token, or a refresh cookie
 * that the client can exchange for one? Anyone holding either gets through to
 * the page; the API is the authority on whether the session is still good.
 *
 * It never refreshes tokens itself. There is exactly one refresh path in the
 * system, POST /api/auth/refresh, and this file would otherwise be a second.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const access = req.cookies.get(COOKIE_NAMES.access)?.value;
  const hasRefresh = req.cookies.has(COOKIE_NAMES.refresh);
  const verified = access ? await verifyAccessToken(access, loadTokenConfig().secret) : null;
  const accessValid = verified?.ok === true;

  if (pathname === "/login") {
    // Anyone still holding a credential is sent into the console. If the
    // refresh cookie turns out to be dead, the API refuses it, clears both
    // cookies and sends them back here with the real reason. No loop: on
    // that second visit there are no cookies.
    if (!accessValid && !hasRefresh) return NextResponse.next();
    return NextResponse.redirect(new URL(safeNextPath(req.nextUrl.searchParams.get("next")), req.url));
  }

  if (accessValid || hasRefresh) return NextResponse.next();

  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);
  // A cookie was present but unusable, and there is no refresh cookie to fall
  // back on: tell the operator why they are here.
  if (verified && !verified.ok) login.searchParams.set("reason", verified.reason);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/login", "/merchants/:path*"],
};
