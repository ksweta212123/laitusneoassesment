import { ButtonLink, Logo } from "./_ui";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Logo className="mb-8 justify-center" />
        <p className="nums text-sm font-medium text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">This page does not exist.</h1>
        <p className="mt-3 text-slate-600">
          The link may be out of date, or the address may have a typo in it.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/merchants">Go to merchants</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
