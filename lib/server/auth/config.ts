import type { TokenConfig } from "./tokens";
import { usingMockData } from "../data-source";

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

const DEV_ONLY_SECRET = "dev-only-secret-do-not-use-in-production";

/**
 * A real deployment must bring its own signing key. The one exception is mock
 * mode (no DATABASE_URL), which serves fabricated data to anyone who asks and
 * therefore has no session worth protecting -- it falls back to a fixed key so
 * the demo deploys with no environment variables at all. The key must be fixed
 * rather than random: serverless instances have to agree on it, or a token
 * signed by one instance is rejected by the next.
 */
function secretFromEnv(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (raw && raw.length >= 32) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === "production" && !usingMockData()) {
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
