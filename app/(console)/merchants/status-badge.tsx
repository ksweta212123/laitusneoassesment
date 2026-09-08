import type { MerchantStatus, TransactionStatus } from "@/lib/shared/api";

/** A dot carries the state at a glance; the word carries it for a screen reader. */
const STYLES: Record<MerchantStatus | TransactionStatus, { chip: string; dot: string }> = {
  active: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  settled: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  onboarding: { chip: "border-sky-200 bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  pending: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  suspended: { chip: "border-rose-200 bg-rose-50 text-rose-800", dot: "bg-rose-500" },
  failed: { chip: "border-rose-200 bg-rose-50 text-rose-800", dot: "bg-rose-500" },
};

export function StatusBadge({ status }: { status: MerchantStatus | TransactionStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style.chip}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
