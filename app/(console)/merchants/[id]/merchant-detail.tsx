"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session-provider";
import { useApiQuery } from "@/lib/client/use-api-query";
import { formatMoney } from "@/lib/money/money";
import type { MerchantDetailResponse, MerchantStatusRequest } from "@/lib/shared/api";
import { describeError, QueryStatus } from "../../query-status";
import { StatusBadge } from "../status-badge";

export function MerchantDetailView({ id }: { id: string }) {
  const query = useApiQuery<MerchantDetailResponse>(`/api/merchants/${encodeURIComponent(id)}`);
  const merchant = query.data?.merchant;

  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/merchants" className="underline">
          ← All merchants
        </Link>
      </p>
      <QueryStatus {...query} />
      {!merchant && !query.error && <p className="text-sm text-zinc-500">Loading…</p>}
      {merchant && (
        <>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">
                {merchant.name} <StatusBadge status={merchant.status} />
              </h1>
              <p className="text-sm text-zinc-600">
                {merchant.legalName} · {merchant.city} · GSTIN {merchant.gstin} ·{" "}
                <span className="font-mono text-xs">{merchant.code}</span>
              </p>
            </div>
            <StatusControl id={merchant.id} status={merchant.status} onChanged={query.reload} />
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Settled" value={formatMoney(merchant.settledTotal)} />
            <Stat label="Pending" value={formatMoney(merchant.pendingTotal)} />
            <Stat label="Transactions" value={String(merchant.transactionCount)} />
            <Stat label="Onboarded" value={new Date(merchant.createdAt).toLocaleDateString("en-IN")} />
          </dl>

          <h2 className="mb-2 font-semibold">Recent transactions</h2>
          <table className="w-full border-collapse bg-white text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="p-2">Reference</th>
                <th className="p-2">When</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {merchant.transactions.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100">
                  <td className="p-2 font-mono text-xs">{t.reference}</td>
                  <td className="p-2">{new Date(t.createdAt).toLocaleString("en-IN")}</td>
                  <td className="p-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">{formatMoney(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-3">
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The admin-only action. The button is hidden for viewers as a courtesy, but
 * the API enforces the rule: a viewer who calls it anyway gets a 403 and stays
 * signed in.
 */
function StatusControl({ id, status, onChanged }: { id: string; status: string; onChanged: () => void }) {
  const { me } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (me?.user.role !== "admin") return null;
  if (status === "onboarding") return null;

  const target: MerchantStatusRequest["status"] = status === "suspended" ? "active" : "suspended";

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/merchants/${encodeURIComponent(id)}/status`, {
        method: "POST",
        body: JSON.stringify({ status: target } satisfies MerchantStatusRequest),
      });
      onChanged();
    } catch (err) {
      setError(describeError(err as Error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
      >
        {pending ? "Saving…" : target === "suspended" ? "Suspend merchant" : "Reinstate merchant"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
