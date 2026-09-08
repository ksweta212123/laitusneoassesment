/**
 * The browser side of the token layer, run against a scripted fetch.
 * Covers: retry after refresh, single-flight refresh, skip-refresh when
 * another tab already did it, and which failures do and do not sign out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, NetworkError, SignedOutError } from "@/lib/client/api";

type Step = { status: number; body?: unknown; networkError?: boolean };
let script: Step[] = [];
let calls: Array<{ path: string; method: string }> = [];
const assigned: string[] = [];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  script = [];
  calls = [];
  assigned.length = 0;
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    calls.push({ path: String(input), method: init?.method ?? "GET" });
    const step = script.shift();
    if (!step) throw new Error(`unexpected fetch ${String(input)}`);
    if (step.networkError) throw new TypeError("Failed to fetch");
    return json(step.status, step.body ?? {});
  });
  vi.stubGlobal("window", {
    location: { origin: "http://console.test", pathname: "/merchants", search: "", assign: (u: string) => assigned.push(u) },
  });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("navigator", {});
});
afterEach(() => vi.unstubAllGlobals());

const expired = { status: 401, body: { error: { code: "unauthenticated", message: "expired", reason: "token_expired" } } };
const refreshed = { status: 200, body: { rotated: true, sessionId: "s", accessToken: { jti: "j", expiresAt: "" } } };

describe("api()", () => {
  it("returns the body on success without touching the refresh endpoint", async () => {
    script = [{ status: 200, body: { merchants: [] } }];
    expect(await api("/api/merchants")).toEqual({ merchants: [] });
    expect(calls.map((c) => c.path)).toEqual(["/api/merchants"]);
  });

  it("on 401 refreshes once and retries once; the operator sees only the data", async () => {
    script = [expired, refreshed, { status: 200, body: { merchants: [1] } }];
    expect(await api("/api/merchants")).toEqual({ merchants: [1] });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /api/merchants",
      "POST /api/auth/refresh",
      "GET /api/merchants",
    ]);
    expect(assigned).toEqual([]);
  });

  it("concurrent 401s in one tab share a single refresh", async () => {
    script = [
      expired,
      expired,
      refreshed,
      { status: 200, body: { a: 1 } },
      { status: 200, body: { b: 2 } },
    ];
    const [a, b] = await Promise.all([api("/api/a"), api("/api/b")]);
    expect([a, b]).toEqual([{ a: 1 }, { b: 2 }]);
    expect(calls.filter((c) => c.path === "/api/auth/refresh")).toHaveLength(1);
  });

  it("skips its own refresh when another tab refreshed after the request started", async () => {
    vi.stubGlobal("localStorage", { getItem: () => String(Date.now() + 10_000), setItem: () => {} });
    script = [expired, { status: 200, body: { ok: true } }];
    expect(await api("/api/x")).toEqual({ ok: true });
    expect(calls.map((c) => c.path)).toEqual(["/api/x", "/api/x"]);
  });

  it("when the refresh is refused it signs out with the server's reason", async () => {
    script = [
      expired,
      { status: 401, body: { error: { code: "unauthenticated", message: "", reason: "refresh_reuse_detected" } } },
    ];
    await expect(api("/api/merchants")).rejects.toBeInstanceOf(SignedOutError);
    expect(assigned).toHaveLength(1);
    const url = new URL(assigned[0]);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("reason")).toBe("refresh_reuse_detected");
    expect(url.searchParams.get("next")).toBe("/merchants");
  });

  it("a refresh that fails with a server error (5xx) does NOT sign out", async () => {
    script = [expired, { status: 503, body: { error: { code: "unavailable", message: "db down" } } }];
    const err = await api("/api/merchants").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
    expect(assigned).toEqual([]);
  });

  it("a network failure during refresh is a NetworkError, not a sign-out", async () => {
    script = [expired, { status: 0, networkError: true }];
    await expect(api("/api/merchants")).rejects.toBeInstanceOf(NetworkError);
    expect(assigned).toEqual([]);
  });

  it("403 is surfaced as an ApiError; no refresh, no sign-out", async () => {
    script = [{ status: 403, body: { error: { code: "forbidden", message: "This action requires the admin role." } } }];
    const err = await api("/api/merchants/x/status", { method: "POST", body: "{}" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect(calls).toHaveLength(1);
    expect(assigned).toEqual([]);
  });

  it("noRefresh: a 401 is returned as-is (used by login and logout)", async () => {
    script = [{ status: 401, body: { error: { code: "invalid_credentials", message: "Incorrect email or password." } } }];
    const err = await api("/api/auth/login", { method: "POST", body: "{}", noRefresh: true }).catch((e) => e);
    expect((err as ApiError).code).toBe("invalid_credentials");
    expect(calls).toHaveLength(1);
  });
});
