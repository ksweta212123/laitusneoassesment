import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "../_ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const POINTS = [
  "A 60-second access token, refreshed and rotated behind your back.",
  "Two tabs racing produce at most one rotation, and neither is signed out.",
  "A refresh token replayed after the grace window ends every session on the account.",
];

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Context for a first-time visitor. Decorative on small screens, so it goes away. */}
      <aside className="hidden bg-slate-900 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="inline-flex">
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-white">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-md bg-brand-600 text-[13px] font-bold text-white"
            >
              U
            </span>
            Udyogpay
          </span>
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-white">
            Stay signed in for the whole shift.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-sm/relaxed text-slate-300">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Mock data. Nothing here is a real merchant.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 inline-flex lg:hidden">
            <Logo />
          </Link>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
