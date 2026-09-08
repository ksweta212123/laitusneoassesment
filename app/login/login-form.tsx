"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/app/_ui";
import { api, ApiError, NetworkError } from "@/lib/client/api";
import type { LoginResponse } from "@/lib/shared/api";
import { isSignOutReason, safeNextPath, SIGN_OUT_MESSAGES } from "@/lib/shared/auth";

const DEMO = {
  admin: { email: "admin@udyogpay.test", password: "Admin#2026" },
  viewer: { email: "viewer@udyogpay.test", password: "Viewer#2026" },
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const reason = params.get("reason");
  const notice = isSignOutReason(reason) ? SIGN_OUT_MESSAGES[reason] : null;

  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return; // double submit
    setPending(true);
    setError(null);
    try {
      await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        noRefresh: true,
      });
      router.replace(next);
    } catch (err) {
      if (err instanceof NetworkError) setError("Could not reach the server. Check your connection and try again.");
      else if (err instanceof ApiError) setError(err.message);
      else setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  function fillDemo(account: keyof typeof DEMO) {
    setEmail(DEMO[account].email);
    setPassword(DEMO[account].password);
    setError(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1.5 text-sm text-slate-500">Use an operator account to open the console.</p>

      {notice && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm/relaxed text-amber-900"
        >
          {notice}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor={emailId} className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500"
            placeholder="you@udyogpay.test"
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-brand-500"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} size="lg" className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium text-slate-700">Demo accounts</p>
        <p className="mt-1 text-xs/relaxed text-slate-500">
          This deployment runs on mock data. Fill the form with one of them:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo("admin")}>
            Use admin account
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo("viewer")}>
            Use viewer account
          </Button>
        </div>
      </div>
    </div>
  );
}
