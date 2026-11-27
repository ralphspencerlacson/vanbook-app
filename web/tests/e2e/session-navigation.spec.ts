import { test, expect, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3242";
const email = "traveller@example.test";
const password = "strong test password";

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/test/reset`);
});

async function login(page: Page, address = email) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill(address);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("signed-out portal requests redirect before any portal UI is returned", async ({ page, request }) => {
  for (const path of [
    "/operator", "/operator/requests", "/operator/quoted", "/operator/booked",
    "/operator/calendar", "/operator/earnings", "/operator/vans",
    "/operator/documents", "/operator/application", "/admin", "/account",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const destination = new URL(response.headers().location, response.url());
    expect(destination.pathname).toBe("/sign-in");
    expect(destination.searchParams.get("next")).toBe(path);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.text()).not.toContain("van-loading-screen");
  }
  await page.goto("/");
  await page.getByRole("link", { name: "Operator portal", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
  await expect(page.locator(".operator-workspace")).toHaveCount(0);
});

test("customer sessions skip signup and login, and public headers show the account", async ({ page, request }) => {
  await request.post(`${fixture}/test/account/create`, { data: { email, password } });
  await login(page);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/");
  const header = page.locator(".site-header");
  await expect(header.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Log in", exact: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Sign up", exact: true })).toHaveCount(0);
  for (const path of ["/sign-in", "/register", "/register/operator", "/sign-in?next=%2Foperator%2Fvans", "/operator/vans"]) {
    if (!path.startsWith("/operator/")) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
    }
    await page.goto(path);
    await expect(page).toHaveURL(/\/account$/);
  }
  await page.goto("/");
  await header.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/notice=signed-out/);
  await page.goto("/operator/vans");
  await expect(page).toHaveURL(/\/sign-in\?/);
});

test("operator sessions keep their portal across navigation and guest routes", async ({ page, request }) => {
  await request.post(`${fixture}/test/account/create`, { data: { email, password } });
  await request.post(`${fixture}/test/operator/pending`);
  await login(page);
  await expect(page).toHaveURL(/\/operator$/);
  await expect(page.getByText("Test Operator Business", { exact: true })).toBeVisible();
  for (const path of ["/sign-in", "/register", "/register/operator"]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    await page.goto(path);
    await expect(page).toHaveURL(/\/operator$/);
    await expect(page.getByRole("heading", { name: "Application submitted", exact: true })).toBeVisible();
  }
  await page.goto("/");
  const header = page.locator(".site-header");
  await expect(header.getByRole("link", { name: "Go to operator dashboard", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Log in", exact: true })).toHaveCount(0);
  await header.getByRole("link", { name: "Go to operator dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/operator$/);
  await page.goto("/sign-in?next=%2Foperator%2Fdocuments");
  await expect(page).toHaveURL(/\/operator\/documents$/);
  await expect(page.locator(".site-header").getByRole("link", { name: "Operator log in", exact: true })).toHaveCount(0);

  await request.post(`${fixture}/test/operator/approve`);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/operator\/requests$/);
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "My vans", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My vans", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "My vans", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/notice=signed-out/);
  const denied = await page.request.get("/operator/vans", { maxRedirects: 0 });
  expect(denied.status()).toBe(307);
});

test("initial operator session checks use the animated van, while tabs keep the portal header", async ({ page, request }) => {
  test.setTimeout(60000);
  await request.post(`${fixture}/test/account/create`, { data: { email, password } });
  await request.post(`${fixture}/test/operator/approve`);
  await login(page);
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible();
  await request.post(`${fixture}/test/verification/slow`);
  await page.goto("/operator/requests", { waitUntil: "commit" });
  const loader = page.locator(".van-loading-screen");
  await expect(loader).toBeVisible();
  await expect(loader.getByRole("heading", { name: "Checking your session" })).toBeVisible();
  await expect(loader.locator(".van-scene-vehicle")).toHaveCSS("animation-name", "van-drive-wave");
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible();
  await expect(loader).not.toBeVisible();
  await page.getByRole("link", { name: "My vans", exact: true }).click();
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(loader).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "My vans", exact: true })).toBeVisible();
  await request.post(`${fixture}/test/verification/fast`);
});

test("administrator sessions skip guest forms and cannot be routed into an operator account", async ({ page, request }) => {
  const address = "admin@example.test";
  await request.post(`${fixture}/test/account/create`, { data: { email: address, password } });
  await login(page, address);
  await expect(page).toHaveURL(/\/admin$/);
  for (const path of ["/sign-in", "/register", "/register/operator", "/operator/vans"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin$/);
  }
  await page.goto("/");
  await expect(page.locator(".site-header").getByRole("link", { name: "Go to admin dashboard", exact: true })).toBeVisible();
});
