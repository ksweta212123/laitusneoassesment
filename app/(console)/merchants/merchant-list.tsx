"use client";
import Link from "next/link";
import { useApiQuery } from "@/lib/client/use-api-query";
import { formatMoney } from "@/lib/money/money";
import type { MerchantListResponse } from "@/lib/shared/api";
import { QueryStatus } from "../query-status";
import { StatusBadge } from "./status-badge";

export function MerchantList() {
  const query = useApiQuery<MerchantListResponse>("/api/merchants");
  const { data } = query;

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Merchants</h1>
      <QueryStatus {...query} />
      {!data && !query.error && <p className="text-sm text-zinc-500">Loading…</p>}
      {data && (
        <table className="w-full border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left">
              <th className="p-2">Code</th>
              <th className="p-2">Merchant</th>
              <th className="p-2">City</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Settled</th>
              <th className="p-2 text-right">Txns</th>
            </tr>
          </thead>
          <tbody>
            {data.merchants.map((m) => (
              <tr key={m.id} className="border-b border-zinc-100">
                <td className="p-2 font-mono text-xs">{m.code}</td>
                <td className="p-2">
                  <Link href={`/merchants/${m.id}`} className="underline">
                    {m.name}
                  </Link>
                </td>
                <td className="p-2">{m.city}</td>
                <td className="p-2">
                  <StatusBadge status={m.status} />
                </td>
                <td className="p-2 text-right font-mono tabular-nums">{formatMoney(m.settledTotal)}</td>
                <td className="p-2 text-right tabular-nums">{m.transactionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
