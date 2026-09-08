# NOTES

## 1. What I decided the requirements were

"Never signed out, blocked, or shown wrong information for a reason they did not cause" splits into three failure classes plus a fourth that is the operator's doing but must still be explained.

**Signed out.** (a) Access token expires while working. (b) Expires while a request is in flight. (c) Two tabs refresh with the same token, and rotation makes the loser look like a thief. (d) The refresh reply is lost after the server has rotated, so the client keeps the old token. (e) Network drop or 5xx during a refresh. (f) Redeploy or restart wipes in-memory sessions or keys. (g) Signing key rotated. (h) Laptop asleep overnight. (i) Following a link from email with `SameSite=Strict` cookies. (j) A permission failure treated as an authentication failure. (k) Client and server clocks disagree.

**Blocked.** (l) Deep links while signed out lose the destination. (m) Visiting `/login` while signed in. (n) Sign-out failing because the access token already expired. (o) Double-submitted login.

**Wrong information.** (p) A tab left open shows yesterday's merchant status. (q) A failed reload blanks the screen, or silently keeps stale data. (r) The previous merchant flashes under the next merchant's URL. (s) Identity or role read from a cached token after they changed. (t) Money through a float.

**Their fault, explain it.** (u) Seven days idle. (v) Thirty days since sign-in. (w) A refresh token genuinely reused, meaning copied. (x) Session revoked or account disabled by an administrator.

## 2. How each was handled

(a, b, h) The single fetch wrapper in `lib/client/api.ts` treats any 401 as "refresh once, retry once". The UI never reads expiry; it reacts to the server. (c) Two layers: a Web Lock makes refresh single-flight across tabs, and a tab skips refreshing if another tab's `refreshedAt` is newer than its request. On the server, claiming a token is `UPDATE ... WHERE used_at IS NULL`, so Postgres decides the race; the loser gets a fresh access token and no cookie change if it arrives within a fifteen second grace window. (d) Partly: the grace window covers a lost reply if the retry comes within fifteen seconds; after that it is indistinguishable from theft and treated as such, with the reason shown at login. (e) A 5xx or fetch failure during refresh shows a banner and Retry; only a 401 from the refresh endpoint signs out. (f) Sessions and hashed refresh tokens live behind `SessionStore`: in memory by default, in Postgres when `DATABASE_URL` is set. (g) A new key invalidates access tokens only; the next request refreshes and continues. (i) `SameSite=Lax`. (j) Role failures are 403; the client never refreshes or signs out on 403. (k) Only the server clock is consulted, with five seconds tolerance for multi-instance skew.

(l) The proxy redirects with `?next=`, validated as an in-app path. (m) The proxy sends anyone holding a credential into the console; a dead refresh cookie is refused by the API, which clears both cookies and returns them with the reason, so no loop. (n) Logout finds the session via the refresh cookie and clears cookies regardless. (o) The button disables while pending.

(p) Refetch on focus and visibility. (q) Previous data stays, with a banner naming its load time and why the reload failed. (r) Query state resets during render on path change. (s) The JWT carries only user and session ids; role, disabled flag and revocation are read from the data source on every API call, and the UI takes identity from `/api/auth/me`, never the cookie. (t) Money is `{amount: string, currency, exponent}`; sums are BigInt or Postgres `sum(bigint)`; formatting groups digits on strings. Tests cover 2^53+1 paise.

(u to x) Each has its own reason code; the refresh endpoint clears cookies and the login page explains. Reuse revokes the whole family, newest token included.

Not handled: login rate limiting; a merchant deleted mid-view is reported as "not found" with no more context.

## 3. Where the access token lives, and what breaks otherwise

Both tokens are `httpOnly`, `Secure`, `SameSite=Lax` cookies with `path=/`.

*localStorage*: any cross-site scripting bug, including in a third-party script, reads and replays the token. *A readable cookie*: same. *Memory only*: every reload or new tab must round-trip a refresh before rendering, and the refresh token still needs a home. *One long-lived cookie*: no rotation, so a copied credential works until expiry and theft is undetectable, which is the mechanism the brief exists to test. *Refresh cookie scoped to the refresh path*: narrower exposure, but the proxy could no longer tell a signed-out visitor from one who merely needs a refresh and would bounce the latter to login. With `path=/` the refresh token rides on every request, ignored.

Cookies do not stop cross-site request forgery, so state-changing routes also check `Sec-Fetch-Site` and `Origin`. Nothing here stops a same-site XSS from calling the API in the victim's browser.

## 4. Why the backend is built this way, and the cost

Route handlers in the same Next app. One repo and one deploy keeps the submission comparable.

The data source is a switch (`lib/server/data-source.ts`): in-memory mock data by default, Drizzle on Postgres when `DATABASE_URL` is set. Mock is the default because this is a frontend submission -- a reviewer should be able to open the deployed URL and sign in, with no database to provision, seed or pay for. It is also the only thing that runs unmodified on a serverless filesystem: the previous PGlite fallback wrote to `./.data`, which is read-only on Vercel, so every login returned a 500.

The Postgres path stayed. It is what makes the rotation race honest -- `UPDATE ... WHERE used_at IS NULL` lets the database settle a concurrent refresh -- and `SessionStore` is the seam that let both exist without the token lifecycle knowing which one it has.

The cost: no service boundary; only convention (`lib/server/**`, `server-only`) stops a page importing the repository directly. The screens are client-rendered and call the API over HTTP, forgoing server components; I accepted that because every byte is per-operator and it leaves exactly one refresh path. Two data sources must now be kept in step, and the mock one makes the atomicity of `claimRefreshToken` a property of JavaScript's single thread rather than of Postgres.

## 5. Where this is not production ready

No login rate limiting or lockout. HS256 with one shared secret and no key id, so key rotation is a hard cutover. The database is consulted on every API call, which makes the short access token mostly ceremonial for the API; its value is confined to the proxy. After fifteen seconds the reuse detector cannot tell a lost reply from theft. No audit log of who suspended what. The list is unpaginated and the detail view caps at fifty transactions silently. `Secure` is set only under `NODE_ENV=production`. Logout while the server is unreachable clears nothing server-side. Refetch on every focus is chatty. The browser tests run against the dev server serially, so they are slow and not yet wired into CI.

In mock mode specifically: state is per serverless instance and not durable. Suspending a merchant updates only the instance that served the request, and a cold start restores the seeded status and signs open sessions out. That is a demo-hosting property, not a design position -- setting `DATABASE_URL` removes it without touching the token code.

## 6. What AI wrote and what I changed

I used Claude Code throughout. It drafted the case list, which I regrouped, plus the file layout, every module, the unit and browser tests and this document.

What changed: it first put refresh inside the proxy with database access, creating a second refresh path; I made the proxy stateless. Its first grace-window design tried to re-issue the same replacement token, impossible when only hashes are stored; "issue an access token, leave the cookies alone" replaced it. Its login page probed `/api/auth/me` on load, which looped fresh visitors through `/login?reason=`; the proxy rule in 2(m) replaced it. It wrote a money test with the wrong expected grouping, which the formatter caught. React's compiler lint rejected its data hook twice, for refs during render and setState in effects; the final version derives state during render. I had it drop `Intl.NumberFormat` for Indian grouping so output does not depend on the runtime's ICU data. Its first browser tests raced the app, asserting before login or data had landed; every failure was in the tests, not the app.
