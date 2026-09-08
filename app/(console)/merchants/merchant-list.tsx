"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/app/_ui";
import { useApiQuery } from "@/lib/client/use-api-query";
import { formatMoney, sumMoney } from "@/lib/money/money";
import type { MerchantListResponse, MerchantSummary } from "@/lib/shared/api";
import { QueryStatus } from "../query-status";
import { StatusBadge } from "./status-badge";

const SETTLEMENT = { currency: "INR", exponent: 2 } as const;

export function MerchantList() {
  const query = useApiQuery<MerchantListResponse>("/api/merchants");
  const { data } = query;
  const [filter, setFilter] = useState("");

  const merchants = data?.merchants;
  const needle = filter.trim().toLowerCase();
  const visible = useMemo(
    () =>
      !merchants
        ? []
        : !needle
          ? merchants
          : merchants.filter((m) =>
              [m.name, m.code, m.city].some((field) => field.toLowerCase().includes(needle)),
            ),
    [merchants, needle],
  );

  return (
    <>
      <PageHeader title="Merchants" description={merchants ? <Summary merchants={merchants} /> : "Loading…"} />

      <QueryStatus {...query} />

      {merchants && (
        <div className="mb-4">
          <label htmlFor="merchant-filter" className="sr-only">
            Filter merchants
          </label>
          <input
            id="merchant-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, code or city"
            className="h-10 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500"
          />
        </div>
      )}

      {!merchants && !query.error && <TableSkeleton />}

      {merchants && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Merchant
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    City
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-xs font-medium tracking-wide text-slate-500 uppercase"
                  >
                    Settled
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-xs font-medium tracking-wide text-slate-500 uppercase"
                  >
                    Txns
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-slate-50">
                    <td className="nums px-4 py-3 font-mono text-xs text-slate-500">{m.code}</td>
                    <td className="px-4 py-3">
                      {/* Link text is the name alone: it is the row's handle for a
                          screen reader and for the browser tests. */}
                      <Link
                        href={`/merchants/${m.id}`}
                        className="font-medium text-brand-700 underline-offset-2 hover:underline"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.city}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="nums px-4 py-3 text-right font-medium text-slate-900">
                      {formatMoney(m.settledTotal)}
                    </td>
                    <td className="nums px-4 py-3 text-right text-slate-600">{m.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No merchant matches “{filter.trim()}”.
            </p>
          )}
        </Card>
      )}
    </>
  );
}

function Summary({ merchants }: { merchants: MerchantSummary[] }) {
  const settled = sumMoney(
    merchants.map((m) => m.settledTotal),
    SETTLEMENT,
  );
  const suspended = merchants.filter((m) => m.status === "suspended").length;
  return (
    <span className="nums">
      {merchants.length} merchants · {formatMoney(settled)} settled
      {suspended > 0 && ` · ${suspended} suspended`}
    </span>
  );
}

function TableSkeleton() {
  return (
    <Card className="overflow-hidden p-4">
      <div aria-hidden className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
      <span className="sr-only">Loading merchants…</span>
    </Card>
  );
}
