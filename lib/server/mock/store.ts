import "server-only";
import { createHash } from "node:crypto";
import { hashPassword } from "../auth/password";
import { MemorySessionStore } from "../auth/memory-store";
import { MERCHANTS, OPERATORS } from "./dataset";

/**
 * Mock data source: the whole console served out of memory, no database.
 *
 * Ids are derived from a stable name (the merchant code, the operator email)
 * rather than randomly generated, so every serverless instance agrees on them.
 * That is what keeps a deep link to /merchants/<id> working after a cold start
 * lands on a different instance.
 */
function stableUuid(namespace: string, name: string): string {
  const bytes = Buffer.from(createHash("sha256").update(`${namespace}:${name}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export type MockUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "viewer" | "admin";
  disabledAt: Date | null;
  createdAt: Date;
};

export type MockTransaction = {
  id: string;
  merchantId: string;
  reference: string;
  amountMinor: bigint;
  currency: string;
  exponent: number;
  status: "pending" | "settled" | "failed";
  createdAt: Date;
};

export type MockMerchant = {
  id: string;
  code: string;
  name: string;
  legalName: string;
  city: string;
  gstin: string;
  status: "onboarding" | "active" | "suspended";
  createdAt: Date;
  statusChangedAt: Date | null;
  statusChangedBy: string | null;
};

export type MockStore = {
  users: MockUser[];
  merchants: MockMerchant[];
  transactions: MockTransaction[];
  sessions: MemorySessionStore;
};

async function build(): Promise<MockStore> {
  const now = Date.now();

  const users: MockUser[] = await Promise.all(
    OPERATORS.map(async (op) => ({
      id: stableUuid("user", op.email),
      email: op.email,
      name: op.name,
      passwordHash: await hashPassword(op.password),
      role: op.role,
      disabledAt: null,
      createdAt: new Date(now - 30 * 86_400_000),
    })),
  );

  const merchants: MockMerchant[] = [];
  const transactions: MockTransaction[] = [];

  for (const m of MERCHANTS) {
    const id = stableUuid("merchant", m.code);
    merchants.push({
      id,
      code: m.code,
      name: m.name,
      legalName: m.legalName,
      city: m.city,
      gstin: m.gstin,
      status: m.status,
      createdAt: new Date(now - 60 * 86_400_000),
      statusChangedAt: null,
      statusChangedBy: null,
    });
    m.txns.forEach((t, i) => {
      const reference = `${m.code}-TXN-${String(i + 1).padStart(4, "0")}`;
      transactions.push({
        id: stableUuid("transaction", reference),
        merchantId: id,
        reference,
        amountMinor: t.amountMinor,
        currency: "INR",
        exponent: 2,
        status: t.status,
        createdAt: new Date(now - t.daysAgo * 86_400_000 - i * 3_600_000),
      });
    });
  }

  return { users, merchants, transactions, sessions: new MemorySessionStore() };
}

// Cached on globalThis so Next's dev-mode module reloads keep one dataset, and
// so a warm serverless instance keeps its sessions and status edits between
// requests. See the persistence note in README.md.
const globalRef = globalThis as unknown as { __udyogpayMock?: Promise<MockStore> };

export function getMockStore(): Promise<MockStore> {
  if (!globalRef.__udyogpayMock) globalRef.__udyogpayMock = build();
  return globalRef.__udyogpayMock;
}
