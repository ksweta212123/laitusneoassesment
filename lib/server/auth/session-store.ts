import "server-only";
import { usingMockData } from "../data-source";
import { getMockStore } from "../mock/store";
import { getDb } from "../db/client";
import { DrizzleSessionStore } from "./drizzle-store";
import type { SessionStore } from "./store";

/**
 * The one place that decides where sessions and refresh tokens live. Both the
 * token service and request authentication go through it, so neither can reach
 * for a database that mock mode never opened.
 */
let cached: Promise<SessionStore> | undefined;

export function getSessionStore(): Promise<SessionStore> {
  if (!cached) {
    cached = usingMockData()
      ? getMockStore().then((store) => store.sessions)
      : getDb().then((db) => new DrizzleSessionStore(db));
  }
  return cached;
}
