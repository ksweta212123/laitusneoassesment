import type { SignOutReason } from "@/lib/shared/auth";

/**
 * Cross-tab coordination. Cookies are shared by every tab in the browser, so
 * a refresh or sign-out in one tab changes the credentials every tab is using.
 * This channel lets the other tabs find out without waiting for a 401.
 */
type Message = { type: "signed-out"; reason: SignOutReason } | { type: "refreshed"; at: number };

const CHANNEL = "udyogpay-session";
const REFRESHED_AT_KEY = "udyogpay:refreshedAt";

function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL);
}

export function announceRefreshed(at: number): void {
  try {
    localStorage.setItem(REFRESHED_AT_KEY, String(at));
  } catch {
    // Private mode or storage disabled; other tabs fall back to their own refresh.
  }
  channel()?.postMessage({ type: "refreshed", at } satisfies Message);
}

/** When another tab last completed a refresh, or 0 if unknown. */
export function lastRefreshedAt(): number {
  try {
    return Number(localStorage.getItem(REFRESHED_AT_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function announceSignedOut(reason: SignOutReason): void {
  channel()?.postMessage({ type: "signed-out", reason } satisfies Message);
}

export function onSignedOut(handler: (reason: SignOutReason) => void): () => void {
  const ch = channel();
  if (!ch) return () => {};
  const listener = (event: MessageEvent<Message>) => {
    if (event.data?.type === "signed-out") handler(event.data.reason);
  };
  ch.addEventListener("message", listener);
  return () => {
    ch.removeEventListener("message", listener);
    ch.close();
  };
}
