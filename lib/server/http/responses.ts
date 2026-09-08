import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ApiErrorBody } from "@/lib/shared/api";
import type { AuthFailureCode } from "@/lib/shared/auth";

export function jsonError(status: number, code: string, message: string, reason?: AuthFailureCode) {
  const body: ApiErrorBody = { error: { code, message, ...(reason ? { reason } : {}) } };
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function jsonOk<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { "cache-control": "no-store", ...init?.headers } });
}

/**
 * Cross-site request forgery guard for state-changing routes.
 * SameSite=Lax cookies already stop a cross-site POST from carrying our cookies;
 * this is the second lock on the same door. Browsers always send
 * Sec-Fetch-Site; non-browser clients (curl) send neither header and are allowed.
 */
export function rejectCrossSite(req: NextRequest): NextResponse | null {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return jsonError(403, "cross_site_request", "Cross-site requests are not allowed.");
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return jsonError(403, "cross_site_request", "Cross-site requests are not allowed.");
  }
  return null;
}

export async function readJsonBody<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
