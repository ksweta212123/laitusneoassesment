import type { MerchantStatus, TransactionStatus } from "@/lib/shared/api";

const COLOURS: Record<MerchantStatus | TransactionStatus, string> = {
  active: "bg-green-100 text-green-800",
  settled: "bg-green-100 text-green-800",
  onboarding: "bg-blue-100 text-blue-800",
  pending: "bg-blue-100 text-blue-800",
  suspended: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: MerchantStatus | TransactionStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${COLOURS[status]}`}>{status}</span>;
}
