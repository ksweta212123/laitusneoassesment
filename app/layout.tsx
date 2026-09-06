import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Udyogpay Console",
  description: "Operator console for Udyogpay merchants",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans">{children}</body>
    </html>
  );
}
