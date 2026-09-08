import type { ApiErrorBody, RefreshResponse } from "@/lib/shared/api";
import { isSignOutReason, type SignOutReason } from "@/lib/shared/auth";
import { announceRefreshed, announceSignedOut, lastRefreshedAt } from "./session-channel";

/** The server said no. `status` and `code` come straight from the response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

/** The request never reached the server, or the response never came back. Not a sign-out. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Could not reach the server.", { cause });
  }
}

/** Thrown after the session is unrecoverable; the browser is already navigating to /login. */
export class SignedOutError extends Error {
  constructor(readonly reason: SignOutReason) {
    super("Signed out.");
  }
}

type Options = RequestInit & {
  /** Skip the refresh-and-retry dance (used by the refresh call itself and by the login page probe). */
  noRefresh?: boolean;
};

/**
 * The only way client code talks to the API.
 *
 * On a 401 it refreshes the session once and retries once. Refreshes are
 * single-flight across tabs (Web Locks) and skipped entirely when another tab
 * has refreshed since this request started. If the refresh itself is refused
 * the operator is sent to the login page with the server's reason.
 */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { noRefresh, ...init } = options;
  const startedAt = Date.now();
  let res = await send(path, init);
  if (res.status === 401 && !noRefresh) {
    await ensureFreshSession(startedAt);
    res = await send(path, init);
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body !== undefined) headers.set("content-type", "application/json");
  try {
    return await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  } catch (err) {
    throw new NetworkError(err);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Not JSON (a proxy error page, for instance). Fall through to a generic error.
  }
  return new ApiError(
    res.status,
    body?.error.code ?? "http_error",
    body?.error.message ?? `Request failed with status ${res.status}.`,
    body?.error.reason,
  );
}

const LOCK_NAME = "udyogpay:refresh";
let inFlight: Promise<void> | null = null;

async function ensureFreshSession(startedAt: number): Promise<void> {
  // Within this tab, piggyback on a refresh that is already running.
  if (inFlight) return inFlight;
  inFlight = withCrossTabLock(async () => {
    // Another tab refreshed after our request went out: its new cookies are already ours.
    if (lastRefreshedAt() > startedAt) return;
    await refreshSession();
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function withCrossTabLock(fn: () => Promise<void>): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, fn);
  }
  return fn(); // No Web Locks (very old browser): the server's grace window covers the race.
}

async function refreshSession(): Promise<void> {
  const res = await send("/api/auth/refresh", { method: "POST" });
  if (res.ok) {
    (await res.json()) as RefreshResponse;
    announceRefreshed(Date.now());
    return;
  }
  if (res.status === 401) {
    const err = await toApiError(res);
    const reason: SignOutReason = isSignOutReason(err.reason) ? err.reason : "refresh_token_invalid";
    signOut(reason);
    throw new SignedOutError(reason);
  }
  // 5xx or anything else: the session may well be fine. Surface it, do not sign out.
  throw await toApiError(res);
}

/** Sends this tab to the login page, remembering where it was, and tells the other tabs to follow. */
export function signOut(reason: SignOutReason): void {
  announceSignedOut(reason);
  const url = new URL("/login", window.location.origin);
  url.searchParams.set("reason", reason);
  url.searchParams.set("next", window.location.pathname + window.location.search);
  window.location.assign(url.toString());
}
