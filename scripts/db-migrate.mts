import { getDbHandle, runMigrations } from "../lib/server/db/client";

const handle = await getDbHandle();
await runMigrations(handle);
console.log(`migrations applied (${handle.kind})`);
await handle.close();
