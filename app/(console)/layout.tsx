import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/client/session-provider";
import { ConsoleHeader } from "./console-header";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ConsoleHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </SessionProvider>
  );
}
