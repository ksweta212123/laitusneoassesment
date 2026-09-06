import { expect, request, test, type BrowserContext, type Page } from "@playwright/test";

const ADMIN = { email: "admin@udyogpay.test", password: "Admin#2026" };
const VIEWER = { email: "viewer@udyogpay.test", password: "Viewer#2026" };
const GRACE_SECONDS = Number(process.env.REFRESH_GRACE_SECONDS ?? 15);

async function login(page: Page, who = ADMIN, path = "/login") {
  await page.goto(path);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  const response = page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
  await page.getByRole("button", { name: "Sign in" }).click();
  await response;
}

/** Our banners, excluding Next's route announcer which also carries role="alert". */
function alert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

/** Simulates the access token expiring: the browser stops sending it, the refresh cookie remains. */
async function expireAccessToken(context: BrowserContext) {
  await context.clearCookies({ name: "udy_access" });
}

async function refreshCookie(context: BrowserContext) {
  const c = (await context.cookies()).find((c) => c.name === "udy_refresh");
  if (!c) throw new Error("no refresh cookie");
  return c.value;
}

/** Records every call to the API so a test can assert on the exact sequence. */
function recordApi(page: Page) {
  const log: string[] = [];
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (url.pathname.startsWith("/api/")) log.push(`${res.request().method()} ${url.pathname} ${res.status()}`);
  });
  return log;
}

test("sign in, list renders exact paise, detail opens, admin can suspend and reinstate", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/merchants$/);
  await expect(page.getByRole("heading", { name: "Merchants" })).toBeVisible();
  // 12345678901 + 250000000 paise, grouped the Indian way.
  await expect(page.getByRole("cell", { name: "₹12,59,56,789.01" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "₹0.99" })).toBeVisible();
  await expect(page.getByText("Asha Rao")).toBeVisible();

  await page.getByRole("link", { name: "Chennai Cycle Works" }).click();
  await expect(page).toHaveURL(/\/merchants\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("cell", { name: "-₹3,200.00" })).toBeVisible();

  const button = page.getByRole("button", { name: /Reinstate merchant|Suspend merchant/ });
  await expect(button).toHaveText("Reinstate merchant"); // seeded as suspended
  await button.click();
  await expect(page.getByRole("button", { name: "Suspend merchant" })).toBeVisible();
  await page.getByRole("button", { name: "Suspend merchant" }).click();
  await expect(page.getByRole("button", { name: "Reinstate merchant" })).toBeVisible();
});

test("viewer sees no suspend button and gets 403, not a sign-out, when calling the API anyway", async ({ page }) => {
  await login(page, VIEWER);
  await page.getByRole("link", { name: "Sharma Sweets" }).click();
  await expect(page.getByText("Sharma Sweets Private Limited")).toBeVisible();
  await expect(page.getByRole("button", { name: /Suspend merchant/ })).toHaveCount(0);

  const id = page.url().split("/").pop()!;
  const res = await page.request.post(`/api/merchants/${id}/status`, { data: { status: "suspended" } });
  expect(res.status()).toBe(403);
  await page.reload();
  await expect(page.getByText("Vikram Shah")).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
});

test("access token expiry mid-session is invisible: 401 -> refresh -> retry, no login page", async ({ page, context }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Merchants" })).toBeVisible();
  await expireAccessToken(context);
  const log = recordApi(page);
  await page.getByRole("link", { name: "Sharma Sweets" }).click();
  await expect(page.getByText("Sharma Sweets Private Limited")).toBeVisible();
  const detail = log.filter((l) => l.includes("/api/merchants/"));
  expect(detail[0]).toMatch(/401$/);
  expect(log).toContain("POST /api/auth/refresh 200");
  expect(detail[detail.length - 1]).toMatch(/200$/);
  await expect(page).not.toHaveURL(/login/);
});

test("real expiry: after the 60 s access TTL the next request refreshes transparently", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await expect(page.getByRole("heading", { name: "Merchants" })).toBeVisible();
  await page.waitForTimeout(66_000);
  const log = recordApi(page);
  await page.getByRole("link", { name: "Dilli Book Depot" }).click();
  await expect(page.getByText("GSTIN 07AABPD4567H1Z6")).toBeVisible();
  expect(log).toContain("POST /api/auth/refresh 200");
  await expect(page).not.toHaveURL(/login/);
});

test("two tabs with an expired access token: at most one refresh rotates, nobody is signed out", async ({ page, context }) => {
  await login(page);
  const other = await context.newPage();
  await other.goto("/merchants");
  await expect(other.getByRole("heading", { name: "Merchants" })).toBeVisible();

  await expireAccessToken(context);
  const logA = recordApi(page);
  const logB = recordApi(other);
  await Promise.all([page.reload(), other.reload()]);
  await expect(page.getByRole("cell", { name: "₹0.99" })).toBeVisible();
  await expect(other.getByRole("cell", { name: "₹0.99" })).toBeVisible();
  const refreshes = [...logA, ...logB].filter((l) => l.startsWith("POST /api/auth/refresh"));
  expect(refreshes.length).toBeGreaterThanOrEqual(1);
  expect(refreshes.length).toBeLessThanOrEqual(2);
  for (const r of refreshes) expect(r).toMatch(/200$/);
  await expect(page).not.toHaveURL(/login/);
  await expect(other).not.toHaveURL(/login/);
});

test("sign out in one tab signs out the other tab immediately", async ({ page, context }) => {
  await login(page);
  const other = await context.newPage();
  await other.goto("/merchants");
  await expect(other.getByRole("heading", { name: "Merchants" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed_out/);
  await expect(other).toHaveURL(/\/login\?reason=signed_out/);
  await expect(other.getByText("You signed out.")).toBeVisible();
});

test("a refresh token rotated elsewhere within the grace window keeps this browser signed in", async ({ page, context }) => {
  await login(page);
  const old = await refreshCookie(context);
  const api = await request.newContext({ baseURL: "http://localhost:3000" });
  const rotated = await api.post("/api/auth/refresh", { headers: { authorization: `Bearer ${old}` } });
  expect((await rotated.json()).rotated).toBe(true);

  await expireAccessToken(context);
  const log = recordApi(page);
  await page.reload();
  await expect(page.getByRole("cell", { name: "₹0.99" })).toBeVisible(); // data, not just the heading
  expect(log).toContain("POST /api/auth/refresh 200");
  await expect(page).not.toHaveURL(/login/);
  await api.dispose();
});

test("refresh token reuse after the grace window signs out with an explanation", async ({ page, context }) => {
  await login(page);
  const old = await refreshCookie(context);
  const api = await request.newContext({ baseURL: "http://localhost:3000" });
  await api.post("/api/auth/refresh", { headers: { authorization: `Bearer ${old}` } });
  await page.waitForTimeout((GRACE_SECONDS + 2) * 1000);

  await expireAccessToken(context);
  await page.reload();
  await expect(page).toHaveURL(/\/login\?reason=refresh_reuse_detected/);
  await expect(page.getByText(/presented twice/)).toBeVisible();
  await api.dispose();
});

test("deep link while signed out returns the operator to that page after sign-in", async ({ page }) => {
  await page.goto("/merchants");
  await expect(page).toHaveURL(/\/login\?next=%2Fmerchants/);
  await login(page, ADMIN, page.url());
  await expect(page).toHaveURL(/\/merchants$/);
  await page.getByRole("link", { name: "Kerala Spice Traders" }).click();
  await expect(page).toHaveURL(/\/merchants\/[0-9a-f-]{36}$/);
  const deep = page.url();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(deep);
  await expect(page).toHaveURL(/\/login\?next=%2Fmerchants%2F/);
  await login(page, ADMIN, page.url());
  await expect(page).toHaveURL(deep);
  await expect(page.getByRole("heading", { name: /Kerala Spice Traders/ })).toBeVisible();
});

test("/login while signed in redirects into the console", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/merchants$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/merchants$/);
});

test("wrong password is a plain error; the form is not stuck", async ({ page }) => {
  await login(page, { email: ADMIN.email, password: "nope" });
  await expect(alert(page)).toHaveText("Incorrect email or password.");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("server failure keeps the last good data on screen, labelled stale, and never signs out", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("cell", { name: "₹0.99" })).toBeVisible();
  await page.route("**/api/merchants", (route) => route.abort("connectionrefused"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(alert(page)).toContainText("Showing data as of");
  await expect(alert(page)).toContainText("Could not reach the server");
  await expect(page.getByRole("cell", { name: "₹0.99" })).toBeVisible();
  await page.unroute("**/api/merchants");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(alert(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/login/);
});

test("a tab left open picks up a status change when it regains focus", async ({ page, context }) => {
  await login(page);
  const row = page.getByRole("row", { name: /Mumbai Tiffin Co/ });
  await expect(row).toContainText("active");
  const admin = await context.newPage();
  await admin.goto("/merchants");
  await admin.getByRole("link", { name: "Mumbai Tiffin Co" }).click();
  await admin.getByRole("button", { name: "Suspend merchant" }).click();
  await expect(admin.getByRole("button", { name: "Reinstate merchant" })).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(row).toContainText("suspended");
  await admin.getByRole("button", { name: "Reinstate merchant" }).click(); // restore seed state
  await expect(admin.getByRole("button", { name: "Suspend merchant" })).toBeVisible();
});

test("unknown merchant id shows Not found, not a sign-out", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/merchants$/);
  await page.goto("/merchants/not-a-real-id");
  await expect(alert(page)).toContainText("Not found.");
  await expect(page).not.toHaveURL(/login/);
});
