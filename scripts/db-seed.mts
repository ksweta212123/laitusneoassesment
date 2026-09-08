/**
 * Seeds the two operator accounts and a set of merchants with transactions
 * into a real Postgres. Only needed when DATABASE_URL is set -- without it the
 * app serves the same content from memory (lib/server/mock).
 *
 * Idempotent: re-running updates operators in place and skips merchants that exist.
 * Amounts are integer paise, carried as BigInt; nothing here is a float.
 */
import { getDbHandle } from "../lib/server/db/client";
import { merchants, transactions, users } from "../lib/server/db/schema";
import { hashPassword } from "../lib/server/auth/password";
import { MERCHANTS, OPERATORS } from "../lib/server/mock/dataset";

const handle = await getDbHandle();
const { db } = handle;

for (const op of OPERATORS) {
  const passwordHash = await hashPassword(op.password);
  await db
    .insert(users)
    .values({ email: op.email, name: op.name, role: op.role, passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { name: op.name, role: op.role, passwordHash, disabledAt: null } });
}

const now = Date.now();
let inserted = 0;
for (const m of MERCHANTS) {
  const [row] = await db
    .insert(merchants)
    .values({ code: m.code, name: m.name, legalName: m.legalName, city: m.city, gstin: m.gstin, status: m.status })
    .onConflictDoNothing({ target: merchants.code })
    .returning({ id: merchants.id });
  if (!row) continue;
  inserted++;
  if (m.txns.length === 0) continue;
  await db.insert(transactions).values(
    m.txns.map((t, i) => ({
      merchantId: row.id,
      reference: `${m.code}-TXN-${String(i + 1).padStart(4, "0")}`,
      amountMinor: t.amountMinor,
      currency: "INR",
      exponent: 2,
      status: t.status,
      createdAt: new Date(now - t.daysAgo * 86_400_000 - i * 3_600_000),
    })),
  );
}

console.log(`seeded ${OPERATORS.length} operators, ${inserted} new merchants (${handle.kind})`);
await handle.close();
