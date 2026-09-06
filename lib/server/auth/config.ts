import type { TokenConfig } from "./tokens";

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

const DEV_ONLY_SECRET = "dev-only-secret-do-not-use-in-production";

function secretFromEnv(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (raw && raw.length >= 32) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set to at least 32 characters in production");
  }
  return new TextEncoder().encode(DEV_ONLY_SECRET);
}

export const COOKIE_NAMES = { access: "udy_access", refresh: "udy_refresh" } as const;

export function loadTokenConfig(): TokenConfig {
  return {
    accessTtlSeconds: intFromEnv("ACCESS_TOKEN_TTL_SECONDS", 60),
    refreshTtlSeconds: intFromEnv("REFRESH_TOKEN_TTL_SECONDS", 7 * 24 * 3600),
    sessionAbsoluteTtlSeconds: intFromEnv("SESSION_ABSOLUTE_TTL_SECONDS", 30 * 24 * 3600),
    refreshGraceSeconds: intFromEnv("REFRESH_GRACE_SECONDS", 15),
    secret: secretFromEnv(),
  };
}
