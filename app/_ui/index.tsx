import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The small set of pieces every screen is built from. No hooks and no event
 * handlers of its own, so server and client components can both import it.
 */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900 ${className}`}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md bg-brand-600 text-[13px] font-bold text-white shadow-sm"
      >
        U
      </span>
      Udyogpay
    </span>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100",
  danger: "border border-rose-300 bg-white text-rose-700 shadow-sm hover:bg-rose-50 active:bg-rose-100",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
} as const;

const SIZES = {
  sm: "h-8 px-3",
  md: "h-10 px-4",
  lg: "h-11 px-5 text-[15px]",
} as const;

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={`${BUTTON_BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={`${BUTTON_BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

/** Page title plus optional supporting line and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
      </div>
      {actions}
    </div>
  );
}
