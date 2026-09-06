"use client";
import Link from "next/link";
import { useState } from "react";
import { api, signOut } from "@/lib/client/api";
import { useSession } from "@/lib/client/session-provider";

export function ConsoleHeader() {
  const { me } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST", noRefresh: true });
    } catch {
      // The server clears cookies even on failure paths; if it was unreachable
      // the refresh token stays valid server-side, which NOTES.md calls out.
    }
    signOut("signed_out");
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between p-4">
        <Link href="/merchants" className="font-semibold">
          Udyogpay Console
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {me ? (
            <span>
              {me.user.name}{" "}
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs uppercase text-zinc-600">{me.user.role}</span>
            </span>
          ) : (
            <span className="text-zinc-400">…</span>
          )}
          <button type="button" onClick={onSignOut} disabled={signingOut} className="underline disabled:opacity-50">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
