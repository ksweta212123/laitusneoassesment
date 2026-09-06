"use client";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { MeResponse } from "@/lib/shared/api";
import { onSignedOut } from "./session-channel";
import { useApiQuery } from "./use-api-query";

type SessionContextValue = { me: MeResponse | undefined; error: Error | undefined; reload: () => void };

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Who is signed in, according to the API. Nothing in the UI reads the cookies
 * or decodes the token: the server answers /api/auth/me and that answer is
 * the only source of the operator's identity and role.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, error, reload } = useApiQuery<MeResponse>("/api/auth/me");

  useEffect(
    () =>
      onSignedOut((reason) => {
        const url = new URL("/login", window.location.origin);
        url.searchParams.set("reason", reason);
        url.searchParams.set("next", window.location.pathname + window.location.search);
        window.location.replace(url.toString());
      }),
    [],
  );

  return <SessionContext.Provider value={{ me: data, error, reload }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
