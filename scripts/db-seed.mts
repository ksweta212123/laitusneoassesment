/**
 * Seeds the two operator accounts and a set of merchants with transactions.
 * Idempotent: re-running updates operators in place and skips merchants that exist.
 * Amounts are integer paise, written as BigInt literals; nothing here is a float.
 */
import { getDbHandle } from "../lib/server/db/client";
import { merchants, transactions, users } from "../lib/server/db/schema";
import { hashPassword } from "../lib/server/auth/password";

export const OPERATORS = [
  { email: "admin@udyogpay.test", name: "Asha Rao", role: "admin", password: "Admin#2026" },
  { email: "viewer@udyogpay.test", name: "Vikram Shah", role: "viewer", password: "Viewer#2026" },
] as const;

type Txn = { amountMinor: bigint; status: "pending" | "settled" | "failed"; daysAgo: number };

const MERCHANTS: Array<{
  code: string;
  name: string;
  legalName: string;
  city: string;
  gstin: string;
  status: "onboarding" | "active" | "suspended";
  txns: Txn[];
}> = [
  {
    code: "M-1001", name: "Sharma Sweets", legalName: "Sharma Sweets Private Limited", city: "Jaipur",
    gstin: "08AABCS1234A1Z5", status: "active",
    txns: [
      { amountMinor: 124999n, status: "settled", daysAgo: 1 },
      { amountMinor: 89950n, status: "settled", daysAgo: 2 },
      { amountMinor: 1n, status: "settled", daysAgo: 3 },
      { amountMinor: 45000n, status: "pending", daysAgo: 0 },
    ],
  },
  {
    code: "M-1002", name: "Nandini Textiles", legalName: "Nandini Textiles LLP", city: "Surat",
    gstin: "24AAFFN5678B1Z2", status: "active",
    txns: [
      { amountMinor: 12345678901n, status: "settled", daysAgo: 1 }, // ₹12,34,56,789.01
      { amountMinor: 250000000n, status: "settled", daysAgo: 4 },
      { amountMinor: 999999n, status: "failed", daysAgo: 2 },
    ],
  },
  {
    code: "M-1003", name: "Chennai Cycle Works", legalName: "Chennai Cycle Works", city: "Chennai",
    gstin: "33AAACC9012C1Z9", status: "suspended",
    txns: [
      { amountMinor: 1550000n, status: "settled", daysAgo: 12 },
      { amountMinor: -320000n, status: "settled", daysAgo: 10 }, // refund
    ],
  },
  {
    code: "M-1004", name: "Bhatia Electronics", legalName: "Bhatia Electronics Pvt Ltd", city: "Ludhiana",
    gstin: "03AABCB3456D1Z7", status: "active",
    txns: [
      { amountMinor: 7899900n, status: "settled", daysAgo: 1 },
      { amountMinor: 4599900n, status: "settled", daysAgo: 1 },
      { amountMinor: 12999n, status: "pending", daysAgo: 0 },
      { amountMinor: 250n, status: "settled", daysAgo: 5 },
    ],
  },
  {
    code: "M-1005", name: "Kerala Spice Traders", legalName: "Kerala Spice Traders", city: "Kochi",
    gstin: "32AAHFK7890E1Z1", status: "active",
    txns: [
      { amountMinor: 100000n, status: "settled", daysAgo: 3 },
      { amountMinor: 100000n, status: "settled", daysAgo: 3 },
      { amountMinor: 100000n, status: "settled", daysAgo: 3 },
    ],
  },
  {
    code: "M-1006", name: "Patel Agro Supplies", legalName: "Patel Agro Supplies", city: "Anand",
    gstin: "24AAKFP2345F1Z8", status: "onboarding",
    txns: [],
  },
  {
    code: "M-1007", name: "Mumbai Tiffin Co", legalName: "Mumbai Tiffin Company Pvt Ltd", city: "Mumbai",
    gstin: "27AADCM6789G1Z3", status: "active",
    txns: [
      { amountMinor: 35000n, status: "settled", daysAgo: 0 },
      { amountMinor: 35000n, status: "settled", daysAgo: 1 },
      { amountMinor: 35000n, status: "failed", daysAgo: 1 },
      { amountMinor: 70000n, status: "pending", daysAgo: 0 },
    ],
  },
  {
    code: "M-1008", name: "Dilli Book Depot", legalName: "Dilli Book Depot", city: "New Delhi",
    gstin: "07AABPD4567H1Z6", status: "active",
    txns: [{ amountMinor: 99n, status: "settled", daysAgo: 2 }],
  },
  {
    code: "M-1009", name: "Hyderabad Pearls", legalName: "Hyderabad Pearls & Jewels LLP", city: "Hyderabad",
    gstin: "36AAEFH8901J1Z4", status: "active",
    txns: [
      { amountMinor: 45000000n, status: "settled", daysAgo: 7 },
      { amountMinor: 45000000n, status: "pending", daysAgo: 0 },
    ],
  },
  {
    code: "M-1010", name: "Pune Auto Garage", legalName: "Pune Auto Garage", city: "Pune",
    gstin: "27AABFP1234K1Z0", status: "suspended",
    txns: [],
  },
];

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
