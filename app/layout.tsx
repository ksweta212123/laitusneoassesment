import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Udyogpay Console", template: "%s · Udyogpay" },
  description: "Operator console for Udyogpay merchants",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
