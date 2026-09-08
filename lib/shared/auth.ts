export type Role = "viewer" | "admin";

/**
 * Every way the server can decline a credential. The client never guesses at
 * these; it shows the message for whatever code the server returned.
 */
export type AuthFailureCode =
  | "no_token"
  | "token_expired"
  | "token_invalid"
  | "refresh_token_invalid"
  | "refresh_token_expired"
  | "session_revoked"
  | "session_expired"
  | "refresh_reuse_detected"
  | "user_disabled";

/** Reasons the login page can explain to an operator who arrived there without choosing to. */
export type SignOutReason = AuthFailureCode | "signed_out";

export const SIGN_OUT_MESSAGES: Record<SignOutReason, string> = {
  signed_out: "You signed out.",
  no_token: "Please sign in to continue.",
  token_expired: "Please sign in to continue.",
  token_invalid: "Your session could not be verified, so we need you to sign in again.",
  refresh_token_invalid: "Your session could not be verified, so we need you to sign in again.",
  refresh_token_expired: "You were signed out after seven days without activity.",
  session_revoked: "This session was ended, either by signing out on another device or by an administrator.",
  session_expired: "Sessions last at most thirty days. Please sign in again.",
  refresh_reuse_detected:
    "Your session credential was presented twice, which can mean it was copied. Every device on this account was signed out as a precaution. Please sign in again.",
  user_disabled: "This account has been disabled. Contact an administrator.",
};

export function isSignOutReason(value: unknown): value is SignOutReason {
  return typeof value === "string" && value in SIGN_OUT_MESSAGES;
}

/** Only ever send an operator back to a path inside this app. */
export function safeNextPath(value: string | null | undefined, fallback = "/merchants"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return fallback;
  return value;
}
