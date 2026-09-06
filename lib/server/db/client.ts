import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type Handle = { db: Db; kind: "postgres" | "pglite"; close: () => Promise<void> };

const PGLITE_DIR = "./.data/pglite";

/**
 * DATABASE_URL set  -> real Postgres over the wire (production on Neon).
 * DATABASE_URL unset -> embedded PGlite persisted under ./.data (local dev, tests).
 * Both are Postgres, so the schema, migrations and queries are identical.
 */
async function open(): Promise<Handle> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, { max: 5, prepare: false });
    return { db: drizzle(sql, { schema }) as unknown as Db, kind: "postgres", close: () => sql.end() };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdir } = await import("node:fs/promises");
  const dir = process.env.PGLITE_DATA_DIR ?? PGLITE_DIR;
  await mkdir(dir, { recursive: true });
  const client = await PGlite.create(dir);
  return { db: drizzle(client, { schema }) as unknown as Db, kind: "pglite", close: () => client.close() };
}

// Cached on globalThis so Next's dev-mode module reloads reuse one connection
// (PGlite in particular refuses to open the same data directory twice).
const globalRef = globalThis as unknown as { __udyogpayDb?: Promise<Handle> };

export function getDbHandle(): Promise<Handle> {
  if (!globalRef.__udyogpayDb) globalRef.__udyogpayDb = open();
  return globalRef.__udyogpayDb;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}

export async function runMigrations(handle: Handle): Promise<void> {
  const folder = "./drizzle";
  if (handle.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(handle.db as never, { migrationsFolder: folder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db as never, { migrationsFolder: folder });
  }
}
