import "server-only";
import { loadTokenConfig } from "./config";
import { getSessionStore } from "./session-store";
import { TokenService } from "./tokens";

let cached: Promise<TokenService> | undefined;

export function getTokenService(): Promise<TokenService> {
  if (!cached) cached = getSessionStore().then((store) => new TokenService(store, loadTokenConfig()));
  return cached;
}
