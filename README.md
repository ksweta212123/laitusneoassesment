# Udyogpay operator console

Three screens: sign in, merchant list, merchant detail. Everything interesting is in the layer that keeps an operator signed in. See [NOTES.md](./NOTES.md) for the reasoning; this file is how to run it and how to see each case.

**Deployed URL:** _see the covering email_ (fill in after `vercel deploy`, section "Deploying").

## Accounts

| Role   | Email                   | Password      | Can                                                  |
| ------ | ----------------------- | ------------- | ---------------------------------------------------- |
| admin  | `admin@udyogpay.test`   | `Admin#2026`  | view merchants, **suspend / reinstate** a merchant   |
| viewer | `viewer@udyogpay.test`  | `Viewer#2026` | view merchants only (the suspend action returns 403) |

## Run it locally

```bash
npm install
npm run db:setup     # migrations + seed into an embedded Postgres (PGlite) under ./.data
npm run dev          # http://localhost:3000
```

No `.env` is needed locally: without `DATABASE_URL` the app uses PGlite (Postgres compiled to WASM, persisted on disk), and without `AUTH_SECRET` it uses a fixed development signing key. Production refuses to start without `AUTH_SECRET`.

Other scripts:

```bash
npm test             # token layer + money formatting + client fetch wrapper (vitest)
npm run test:e2e     # 14 browser tests of the cases below (Playwright; starts the dev server if needed, ~2 min)
npm run typecheck
npm run lint
npm run build
./scripts/token-demo.sh [base-url]   # drives every server-side auth case with curl (see below)
```

## Stack

- Next.js 16 App Router, TypeScript, Tailwind (unstyled-ish on purpose).
- Backend: route handlers in the same app under `app/api/`. They are the only code that touches the database.
- Database: Postgres via Drizzle. Neon (hosted) in production, PGlite (embedded) locally. Same schema, same migrations.
- Tokens: signed JWT access token (HS256 via `jose`, 60 s by default) + opaque refresh token (SHA-256 stored, 7 days, rotated on every use). Both in `httpOnly` cookies. The lifecycle (`lib/server/auth/tokens.ts`) is our code; `jose` only signs and verifies.

## Where things are

```
proxy.ts                         optimistic gate for page navigations (no DB access)
lib/server/auth/tokens.ts        the token lifecycle: issue, rotate, grace window, reuse detection
lib/server/auth/jwt.ts           access token sign/verify
lib/server/auth/store.ts         persistence interface + memory-store.ts (tests) + drizzle-store.ts (runtime)
lib/server/auth/authenticate.ts  per-request auth for the API, withAuth(handler, { role })
lib/server/auth/cookies.ts       cookie names and attributes
lib/client/api.ts                the one fetch wrapper: 401 -> refresh once -> retry once, single-flight across tabs
lib/client/session-channel.ts    cross-tab sign-out / refresh announcements
lib/client/use-api-query.ts      data hook: refetch on focus, keep stale data on failure
lib/money/money.ts               Money type, BigInt arithmetic, Indian formatting
app/api/**                       the backend
app/(console)/**                 merchant list + detail
tests/**                         token rotation, money, client wrapper
```

## Configuration

| Variable                       | Default   | Meaning                                                                   |
| ------------------------------ | --------- | ------------------------------------------------------------------------- |
| `AUTH_SECRET`                  | dev key   | HS256 key for access tokens. Required (≥32 chars) in production.          |
| `DATABASE_URL`                 | unset     | Postgres URL. Unset = PGlite in `./.data/pglite`.                          |
| `ACCESS_TOKEN_TTL_SECONDS`     | `60`      | Deliberately short so the refresh path is visible.                         |
| `REFRESH_TOKEN_TTL_SECONDS`    | `604800`  | 7 days, sliding (each rotation issues a fresh 7-day token).                |
| `SESSION_ABSOLUTE_TTL_SECONDS` | `2592000` | 30 days from sign-in, regardless of activity.                              |
| `REFRESH_GRACE_SECONDS`        | `15`      | Window in which a just-rotated token is treated as concurrent, not stolen. |

## How to observe each case

Most of these are invisible in ordinary use. Open DevTools → Network (tick "Preserve log") for the browser ones. The access token lives 60 seconds, so "wait for expiry" means about a minute. Every row in the browser table except double-submit is also an automated test in `e2e/console.spec.ts`, so `npm run test:e2e` is the fastest way to see them pass; the manual steps are for watching one happen.

### Server-side, from the terminal

`./scripts/token-demo.sh` (or `./scripts/token-demo.sh https://<deployed-url>`) runs the sequence below and prints each response. It takes about 20 seconds because step 5 waits out the grace window.

| #   | Case                                                        | What you will see                                                                                          |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Sign in                                                     | `200`, two `Set-Cookie` headers: `udy_access` (JWT) and `udy_refresh` (opaque).                            |
| 3   | Refresh rotates the refresh token                           | `rotated: true`, a new `refreshToken.id`; the cookie value changes.                                        |
| 4   | Same old token presented again within 15 s (two tabs)       | `200`, `rotated: false`: a new access token, no new refresh token, nobody signed out.                      |
| 5   | Same old token presented after 15 s (theft or a lost reply) | `401 refresh_reuse_detected`.                                                                              |
| 6   | The newest token in that family                             | `401 session_revoked`: the whole family died with it.                                                      |
| 7   | An access token that was valid a moment ago                 | `401 session_revoked`: the API checks the session in the database on every request, not just the signature. |
| 8   | Viewer calls the admin-only action                          | `403 forbidden`, and `/api/auth/me` still works: a permission failure is never a sign-out.                  |
| 9   | Forged / missing access token                               | `401 token_invalid` / `401 no_token`, each named.                                                          |
| 10  | Sign out, then present the refresh token                    | `401 session_revoked`.                                                                                     |

Extra ones you can do by hand:

- **Cross-site request forgery guard**: `curl -X POST -H 'sec-fetch-site: cross-site' <url>/api/auth/refresh` → `403 cross_site_request`. Cookies are also `SameSite=Lax`, so a browser would not have attached them in the first place.
- **Timing-safe login**: a wrong password and an unknown email both take one scrypt verification and return the same `401 invalid_credentials`.
- **Signing key rotation**: change `AUTH_SECRET` and restart. Existing access tokens fail with `token_invalid`; the next request refreshes and carries on. (Locally: `AUTH_SECRET=$(openssl rand -base64 32) npm run dev` after signing in.)
- **Server restart / redeploy mid-session**: stop and start `npm run dev`. Sessions and refresh tokens are in the database, so nothing is lost.

### In the browser

| Case                                              | Steps                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token expires mid-session                  | Sign in, wait 60 s, click a merchant. Network shows `GET /api/merchants/… 401`, `POST /api/auth/refresh 200`, then the same `GET 200`. The page never flickers to login.                                                                                                                 |
| Two tabs refresh at once                          | Sign in, open the list in two tabs, wait 60 s, focus each tab quickly. Only one `POST /api/auth/refresh` per tab at most, and if the second tab's request started after the first tab's refresh it skips its own refresh (Web Locks + a shared `refreshedAt` timestamp in localStorage). |
| Sign out in one tab                               | Two tabs; sign out in one. The other navigates to `/login?reason=signed_out` immediately (BroadcastChannel).                                                                                                                                                                             |
| Session revoked elsewhere                         | Sign in in the browser, then run `./scripts/token-demo.sh` (it signs in as the viewer and gets that account's *new* session revoked; your browser session is a different family and survives). To revoke your own: copy the `udy_refresh` cookie value and POST it twice, 16 s apart, via `curl -H 'authorization: Bearer <value>' -X POST /api/auth/refresh`. Your next click lands on `/login?reason=refresh_reuse_detected` with an explanation. |
| Tab left open overnight                           | Leave the list open, suspend a merchant from another tab, switch back. The list refetches on focus/visibility and shows the new status.                                                                                                                                                  |
| Server unreachable                                | Stop `npm run dev` while on the list, click Retry / refocus the tab. The old data stays with a "showing data as of …; the latest reload failed" banner. Start the server again, Retry: data reloads. No sign-out.                                                                          |
| Viewer tries the admin action                     | The button is not rendered for the viewer. Call it anyway: `curl` step 8 above. The UI equivalent for an admin whose role is downgraded in the DB mid-session is a red "You do not have permission" under the button, still signed in.                                                    |
| Deep link while signed out                        | Visit `/merchants/<id>` in a fresh window → `/login?next=/merchants/<id>`; after sign-in you land on that merchant.                                                                                                                                                                       |
| Deep link while signed in but access token expired | Wait 60 s, paste a merchant URL in a new tab. The proxy lets it through on the refresh cookie; the page's first API call refreshes.                                                                                                                                                       |
| Visiting `/login` while signed in                  | Redirects to `/merchants` (or `?next=`).                                                                                                                                                                                                                                                 |
| Double-submit on login                            | The button disables while the request is in flight.                                                                                                                                                                                                                                       |
| Wrong URL / bad merchant id                       | `/merchants/nope` shows "Not found." with the list link; `404`, not a sign-out.                                                                                                                                                                                                          |

### Money

`npm test` runs `tests/money.test.ts`. In the UI, Nandini Textiles shows a settled total of ₹12,59,56,789.01 (the seed contains 12345678901 + 250000000 paise), Chennai Cycle Works includes a −₹3,200.00 refund, and Dilli Book Depot's total is ₹0.99. Amounts travel as `{ amount: "12345678901", currency: "INR", exponent: 2 }`, are summed with `BigInt` (or `sum(bigint)` in Postgres) and formatted digit-by-digit; `grep -rn "parseFloat\|Number(" lib/money` returns nothing.

## Deploying

1. Create a Postgres database (Neon free tier works) and note the connection string.
2. Import the repo into Vercel. Set `AUTH_SECRET` (`openssl rand -base64 32`) and `DATABASE_URL`.
3. Run migrations and seed once against that database: `DATABASE_URL=… npm run db:setup`.
4. Deploy. The proxy and route handlers run on Node.

## Tests

```
tests/tokens.test.ts       rotation, expiry, absolute lifetime, revocation, concurrent grace, reuse detection
tests/client-api.test.ts   401 → refresh → retry, single-flight, cross-tab skip, which failures sign out and which do not
tests/money.test.ts        Indian grouping, paise exactness, negatives, exponents 0/2/3, rejection of decimals
e2e/console.spec.ts        real browser: expiry mid-session (simulated and real 60 s), two tabs, cross-tab sign-out,
                           grace window, reuse detection, deep links, 403 for viewer, stale banner on server failure,
                           refetch on focus, not-found
```
The browser suite needs Chromium: `npx playwright install chromium` once, if it is not already present.
