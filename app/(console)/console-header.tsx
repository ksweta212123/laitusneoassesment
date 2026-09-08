"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Logo } from "@/app/_ui";
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
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/merchants" className="rounded-md">
          <Logo />
        </Link>

        <div className="flex items-center gap-3">
          {me ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="hidden font-medium text-slate-700 sm:inline">{me.user.name}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium tracking-wide text-slate-600 uppercase">
                {me.user.role}
              </span>
            </span>
          ) : (
            <span aria-hidden className="h-5 w-28 animate-pulse rounded bg-slate-200" />
          )}
          <Button type="button" onClick={onSignOut} disabled={signingOut} variant="secondary" size="sm">
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
