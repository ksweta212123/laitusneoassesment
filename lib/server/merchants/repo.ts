import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { money, sumMoney, type Money } from "@/lib/money/money";
import type { MerchantDetail, MerchantSummary, TransactionDto } from "@/lib/shared/api";
import { usingMockData } from "../data-source";
import { getMockStore, type MockMerchant, type MockTransaction } from "../mock/store";
import { getDb } from "../db/client";
import { merchants, transactions } from "../db/schema";

/** Every merchant in this seed settles in INR paise. Totals are typed by the merchant, not guessed. */
const SETTLEMENT = { currency: "INR", exponent: 2 } as const;

export async function listMerchants(): Promise<MerchantSummary[]> {
  if (usingMockData()) {
    const store = await getMockStore();
    return [...store.merchants]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => {
        const txns = store.transactions.filter((t) => t.merchantId === m.id);
        // Summed in BigInt, exactly as the SQL path sums in bigint. No double ever holds a total.
        const settled = txns
          .filter((t) => t.status === "settled")
          .reduce((total, t) => total + t.amountMinor, 0n);
        return {
          id: m.id,
          code: m.code,
          name: m.name,
          city: m.city,
          status: m.status,
          settledTotal: money(settled, SETTLEMENT.currency, SETTLEMENT.exponent),
          transactionCount: txns.length,
        };
      });
  }

  const db = await getDb();
  // Summed in Postgres as bigint -> numeric and returned as text, so no double ever holds a total.
  const settledTotal = sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.status} = 'settled'), 0)::text`;
  const count = sql<number>`count(${transactions.id})::int`;
  const rows = await db
    .select({
      id: merchants.id,
      code: merchants.code,
      name: merchants.name,
      city: merchants.city,
      status: merchants.status,
      settledTotal,
      transactionCount: count,
    })
    .from(merchants)
    .leftJoin(transactions, eq(transactions.merchantId, merchants.id))
    .groupBy(merchants.id)
    .orderBy(merchants.name);

  return rows.map((row) => ({
    ...row,
    settledTotal: money(row.settledTotal, SETTLEMENT.currency, SETTLEMENT.exponent),
  }));
}

/** Shared by both paths so the two sources cannot disagree about the shape of a detail page. */
function toDetail(
  merchant: Pick<MockMerchant, "id" | "code" | "name" | "legalName" | "city" | "gstin" | "status"> & {
    createdAt: Date;
    statusChangedAt: Date | null;
  },
  txns: Array<Pick<MockTransaction, "id" | "reference" | "amountMinor" | "currency" | "exponent" | "status" | "createdAt">>,
): MerchantDetail {
  const dto: TransactionDto[] = txns.map((t) => ({
    id: t.id,
    reference: t.reference,
    amount: money(t.amountMinor, t.currency, t.exponent),
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  }));
  const totalOf = (status: TransactionDto["status"]): Money =>
    sumMoney(dto.filter((t) => t.status === status).map((t) => t.amount), SETTLEMENT);

  return {
    id: merchant.id,
    code: merchant.code,
    name: merchant.name,
    legalName: merchant.legalName,
    city: merchant.city,
    gstin: merchant.gstin,
    status: merchant.status,
    createdAt: merchant.createdAt.toISOString(),
    statusChangedAt: merchant.statusChangedAt?.toISOString() ?? null,
    transactionCount: dto.length,
    settledTotal: totalOf("settled"),
    pendingTotal: totalOf("pending"),
    transactions: dto,
  };
}

export async function getMerchant(id: string): Promise<MerchantDetail | null> {
  if (usingMockData()) {
    const store = await getMockStore();
    const merchant = store.merchants.find((m) => m.id === id);
    if (!merchant) return null;
    const txns = store.transactions
      .filter((t) => t.merchantId === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);
    return toDetail(merchant, txns);
  }

  const db = await getDb();
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  if (!merchant) return null;

  const txns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.merchantId, id))
    .orderBy(desc(transactions.createdAt))
    .limit(50);

  return toDetail(merchant, txns);
}

export async function setMerchantStatus(
  id: string,
  status: "active" | "suspended",
  changedBy: string,
): Promise<"updated" | "not_found"> {
  if (usingMockData()) {
    const store = await getMockStore();
    const merchant = store.merchants.find((m) => m.id === id);
    if (!merchant) return "not_found";
    merchant.status = status;
    merchant.statusChangedAt = new Date();
    merchant.statusChangedBy = changedBy;
    return "updated";
  }

  const db = await getDb();
  const updated = await db
    .update(merchants)
    .set({ status, statusChangedAt: new Date(), statusChangedBy: changedBy })
    .where(and(eq(merchants.id, id)))
    .returning({ id: merchants.id });
  return updated.length === 1 ? "updated" : "not_found";
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
