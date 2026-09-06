"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError, NetworkError } from "@/lib/client/api";
import type { LoginResponse } from "@/lib/shared/api";
import { isSignOutReason, safeNextPath, SIGN_OUT_MESSAGES } from "@/lib/shared/auth";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const reason = params.get("reason");
  const notice = isSignOutReason(reason) ? SIGN_OUT_MESSAGES[reason] : null;

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

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Udyogpay Console</h1>
      {notice && (
        <p role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          {notice}
        </p>
      )}
      <label className="block text-sm">
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 p-2"
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 p-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-zinc-900 p-2 text-white disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
