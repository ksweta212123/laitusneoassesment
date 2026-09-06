import "server-only";
import { getDb } from "../db/client";
import { loadTokenConfig } from "./config";
import { DrizzleSessionStore } from "./drizzle-store";
import { TokenService } from "./tokens";

let cached: Promise<TokenService> | undefined;

export function getTokenService(): Promise<TokenService> {
  if (!cached) cached = getDb().then((db) => new TokenService(new DrizzleSessionStore(db), loadTokenConfig()));
  return cached;
}
