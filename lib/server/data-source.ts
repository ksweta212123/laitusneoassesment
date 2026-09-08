/**
 * Which data source backs the console.
 *
 * DATABASE_URL set   -> real Postgres over Drizzle.
 * DATABASE_URL unset -> in-memory mock data (lib/server/mock).
 *
 * Read at call time rather than module load so tests and scripts can set the
 * variable before the first query.
 */
export function usingMockData(): boolean {
  return !process.env.DATABASE_URL;
}
