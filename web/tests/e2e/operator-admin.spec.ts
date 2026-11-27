import { test, expect, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:3242";
const operatorEmail = "traveller@example.test",
  adminEmail = "admin@example.test",
  password = "strong test password";
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/test/reset`);
});
async function register(page: Page, email: string, destination = "/account") {
  await page.goto("/register");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("confirmation email");
  await page.goto("/auth/callback?code=test-confirmation-code&next=%2Faccount");
  await expect(page).toHaveURL(new RegExp(destination + "$"));
}
async function signIn(page: Page, email: string, destination = "/account") {
  await page.goto("/sign-in");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(destination + "$"));
}
async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/notice=signed-out/);
}

test("roles separate customer, pending operator and administrator access, with a responsive user list", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await register(page, operatorEmail);
  await expect(
    page.getByRole("link", { name: "Administration", exact: true }),
  ).not.toBeVisible();
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await request.post(fixture + "/test/operator/pending");
  await signOut(page);
  await page.getByLabel("Email address", { exact: true }).fill(operatorEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "awaiting approval" }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/sign-in/);
  await request.post(fixture + "/test/operator/approve");
  await signIn(page, operatorEmail, "/admin");
  await expect(
    page.getByRole("heading", { name: "My business", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).not.toBeVisible();
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await signOut(page);
  // The fixture's admin membership is seeded by trusted database setup, not signup metadata.
  await register(page, adminEmail, "/admin");
  await page.getByRole("link", { name: "Users", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(operatorEmail, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add an administrator" }),
  ).toBeVisible();
  await page
    .getByLabel("Account role", { exact: true })
    .selectOption("operator");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "User accounts (1)" }),
  ).toBeVisible();
  for (const [width, height] of [
    [320, 844],
    [375, 812],
    [783, 909],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 375 || width === 1440)
      await page.screenshot({
        path: "test-results/users-" + width + ".png",
        fullPage: true,
      });
  }
});

test("password reset uses a verified session and changes the sign-in password", async ({
  page,
}) => {
  await register(page, operatorEmail);
  await page.goto("/account");
  await signOut(page);
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/forgot-password/);
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(operatorEmail);
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("password reset link");
  await page.goto(
    "/auth/callback?code=test-confirmation-code&next=%2Freset-password",
  );
  await expect(page).toHaveURL(/reset-password/);
  await page
    .getByLabel("New password", { exact: true })
    .fill("new strong password");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("new strong password");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "password has been updated",
  );
  await page.getByRole("link", { name: "Return to your account" }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await signOut(page);
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(operatorEmail);
  await page
    .getByLabel("Password", { exact: true })
    .fill("new strong password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("admin verification follows the prototype, saves decisions, and shows an accessible animated loader", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await register(page, adminEmail, "/admin");
  await request.post(fixture + "/test/verification/seed");
  await request.post(fixture + "/test/verification/slow");
  await page.goto("/admin?status=all", { waitUntil: "commit" });
  const loader = page.locator(".van-loading-screen").first();
  await expect(loader).toBeVisible();
  await expect(page.locator(".van-scene-vehicle").first()).toHaveCSS(
    "animation-name",
    "van-drive-wave",
  );
  await page.screenshot({ path: "test-results/van-loading-desktop.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/van-loading-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".van-scene-vehicle").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(
    page.getByRole("heading", { name: "Operator verification", exact: true }),
  ).toBeVisible();
  await request.post(fixture + "/test/verification/fast");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const verification = page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("link", { name: /Verification/ });
  await expect(verification).toHaveAttribute("aria-current", "page");
  await expect(verification).toHaveCSS("height", "42px");
  await expect(page.locator(".admin-sidebar")).toHaveCSS(
    "background-color",
    "rgb(18, 33, 43)",
  );
  await expect(
    page.getByRole("heading", { name: "Lakbay Luzon Travel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View LTFRB franchise (CPC)", exact: true }),
  ).toBeVisible();
  const documentHref = await page
    .getByRole("link", { name: "View LTFRB franchise (CPC)", exact: true })
    .getAttribute("href");
  expect(
    (await page.request.get(documentHref!, { maxRedirects: 0 })).status(),
  ).toBe(303);
  await page.screenshot({
    path: "test-results/admin-verification-desktop.png",
    fullPage: true,
  });
  for (const [width, height] of [
    [320, 844],
    [375, 812],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 375) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(verification).toBeVisible();
      await expect(verification).toHaveCSS("height", "42px");
      await page
        .getByRole("button", { name: "Close menu", exact: true })
        .click();
      await page.screenshot({
        path: "test-results/admin-verification-mobile.png",
        fullPage: true,
      });
    }
  }
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Add a note" }),
  ).toBeVisible();
  await page
    .getByLabel("Note to operator", { exact: true })
    .fill("Please provide a current insurance certificate.");
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await expect(page.locator(".admin-review-result")).toContainText(
    "Changes requested",
  );
  await expect(page.locator(".admin-review-result")).toContainText(
    "current insurance certificate",
  );
  await page
    .getByRole("searchbox", { name: "Search operator or registration number" })
    .fill("CPC-2026-0002");
  await page
    .getByRole("searchbox", { name: "Search operator or registration number" })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Bayanihan Transport", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Bookings and escalations", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Bookings and escalations",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "This month", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "This month", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({
    path: "test-results/admin-bookings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
