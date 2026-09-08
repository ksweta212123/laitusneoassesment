import { cookies } from "next/headers";
import { ButtonLink, Card, Logo } from "./_ui";
import { COOKIE_NAMES } from "@/lib/server/auth/config";

export const metadata = {
  title: "Udyogpay — operator console for merchant payments",
  description:
    "Suspend a merchant, read exact paise, and stay signed in without thinking about it. A small operator console built around an owned access/refresh token lifecycle.",
};

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@udyogpay.test", password: "Admin#2026", can: "View merchants, suspend and reinstate" },
  { role: "Viewer", email: "viewer@udyogpay.test", password: "Viewer#2026", can: "View merchants only" },
];

const FEATURES = [
  {
    title: "Sessions that survive a long shift",
    body: "A 60-second access token backed by a refresh token that rotates on every use. Expiry mid-task is invisible: the request 401s, the client refreshes once, retries once, and the page never flickers to a login screen.",
  },
  {
    title: "Exact paise, never a float",
    body: "Money travels as an integer count of minor units in a string, is summed with BigInt, and is grouped for an Indian reader digit by digit. ₹12,34,56,789.01 is the same value on the server, on the wire and on screen.",
  },
  {
    title: "Roles the server actually enforces",
    body: "A viewer never sees the suspend button, and calling the endpoint anyway returns 403 — not a sign-out. Permission failures and authentication failures are different things, and the UI treats them that way.",
  },
];

export default async function LandingPage() {
  // Optimistic, exactly like the proxy: holding a refresh cookie is enough to
  // offer the console. The API remains the authority on whether it still works.
  const signedIn = (await cookies()).has(COOKIE_NAMES.refresh);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <ButtonLink href={signedIn ? "/merchants" : "/login"} size="sm">
            {signedIn ? "Open console" : "Sign in"}
          </ButtonLink>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-14 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                <span aria-hidden className="size-1.5 rounded-full bg-brand-500" />
                Operator console
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl">
                Payments operations, without the sign-in tax.
              </h1>
              <p className="mt-5 text-lg/relaxed text-pretty text-slate-600">
                Three screens for the people who watch merchant accounts all day: find a merchant, read what they
                have settled down to the paise, and suspend them when something is wrong. The interesting part is
                the layer underneath that keeps an operator signed in for a whole shift.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={signedIn ? "/merchants" : "/login"} size="lg">
                  Open the console
                </ButtonLink>
                <ButtonLink href="#sessions" variant="secondary" size="lg">
                  How the session works
                </ButtonLink>
              </div>
            </div>

            <ConsolePreview />
          </div>
        </section>

        <section aria-labelledby="demo-heading" className="mx-auto w-full max-w-5xl px-6 pb-16">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3">
              <h2 id="demo-heading" className="text-sm font-semibold text-slate-900">
                Demo accounts
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                This deployment runs on mock data, so these credentials are safe to publish and safe to break.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {DEMO_ACCOUNTS.map((account) => (
                <div key={account.email} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-sm">
                  <span className="w-16 shrink-0 font-medium text-slate-900">{account.role}</span>
                  <code className="nums rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800">
                    {account.email}
                  </code>
                  <code className="nums rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800">
                    {account.password}
                  </code>
                  <span className="text-slate-500">{account.can}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section id="sessions" className="scroll-mt-20 border-y border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What happens while you work</h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              The access token is deliberately short-lived, so the refresh path runs constantly rather than once a
              week where nobody can see it fail.
            </p>

            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: "1", title: "Sign in", body: "You get a signed access token and an opaque refresh token, both in httpOnly cookies." },
                { step: "2", title: "The access token expires", body: "After 60 seconds. Your next click returns 401 and the client notices, not you." },
                { step: "3", title: "One refresh, one retry", body: "The refresh token is exchanged and rotated. Two tabs racing produce at most one rotation." },
                { step: "4", title: "Or it was stolen", body: "A token presented again after the grace window revokes the whole family and says so on the login page." },
              ].map((item) => (
                <li key={item.step} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-3 font-medium text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm/relaxed text-slate-600">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <h3 className="font-medium text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm/relaxed text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-slate-500">
          <Logo className="text-slate-500" />
          <p>Built as an assessment submission. Mock data; nothing here is a real merchant.</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * A still of the merchant list, drawn rather than screenshotted so it stays
 * true when the real table changes. Decorative: hidden from assistive tech,
 * which reads the console itself.
 */
function ConsolePreview() {
  const rows = [
    { code: "M-1002", name: "Nandini Textiles", status: "active", amount: "₹12,59,56,789.01" },
    { code: "M-1003", name: "Chennai Cycle Works", status: "suspended", amount: "₹12,300.00" },
    { code: "M-1004", name: "Bhatia Electronics", status: "active", amount: "₹1,25,000.50" },
    { code: "M-1008", name: "Dilli Book Depot", status: "active", amount: "₹0.99" },
  ];
  const tone: Record<string, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-800",
    suspended: "border-rose-200 bg-rose-50 text-rose-800",
  };
  const dot: Record<string, string> = { active: "bg-emerald-500", suspended: "bg-rose-500" };

  return (
    <div aria-hidden className="hidden lg:block">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="ml-2 text-[11px] text-slate-400">udyogpay — merchants</span>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.code} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{row.name}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${tone[row.status]}`}
              >
                <span className={`size-1 rounded-full ${dot[row.status]}`} />
                {row.status}
              </span>
              <span className="nums shrink-0 text-right text-xs font-medium text-slate-900">{row.amount}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
