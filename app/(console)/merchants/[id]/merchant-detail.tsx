"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card } from "@/app/_ui";
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
      <Link
        href="/merchants"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <span aria-hidden>←</span> All merchants
      </Link>

      <QueryStatus {...query} />

      {!merchant && !query.error && (
        <div aria-hidden className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      {merchant && (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
                {merchant.name}
                <StatusBadge status={merchant.status} />
              </h1>
              {/* Kept on one line so "GSTIN <value>" stays a single contiguous string. */}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                <span>{merchant.legalName}</span>
                <span aria-hidden>·</span>
                <span>{merchant.city}</span>
                <span aria-hidden>·</span>
                <span className="nums">GSTIN {merchant.gstin}</span>
                <span aria-hidden>·</span>
                <span className="nums font-mono text-xs">{merchant.code}</span>
              </p>
            </div>
            <StatusControl id={merchant.id} status={merchant.status} onChanged={query.reload} />
          </div>

          <dl className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Settled" value={formatMoney(merchant.settledTotal)} emphasis />
            <Stat label="Pending" value={formatMoney(merchant.pendingTotal)} />
            <Stat label="Transactions" value={String(merchant.transactionCount)} />
            <Stat label="Onboarded" value={new Date(merchant.createdAt).toLocaleDateString("en-IN")} />
          </dl>

          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent transactions</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                      Reference
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                      When
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right text-xs font-medium tracking-wide text-slate-500 uppercase"
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {merchant.transactions.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50">
                      <td className="nums px-4 py-3 font-mono text-xs text-slate-500">{t.reference}</td>
                      <td className="nums px-4 py-3 text-slate-600">
                        {new Date(t.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="nums px-4 py-3 text-right font-medium text-slate-900">{formatMoney(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {merchant.transactions.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No transactions yet for this merchant.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd
        className={`nums mt-1.5 font-semibold ${emphasis ? "text-xl text-slate-900" : "text-lg text-slate-700"}`}
      >
        {value}
      </dd>
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
      <Button
        type="button"
        onClick={onClick}
        disabled={pending}
        variant={target === "suspended" ? "danger" : "secondary"}
      >
        {pending ? "Saving…" : target === "suspended" ? "Suspend merchant" : "Reinstate merchant"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
