import { test, expect, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:3242";
test.use({ actionTimeout: 10000 });
const password = "strong test password";
const pdf = (name = "document.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\nTest document\n%%EOF"),
});
const photo = {
  name: "front.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
};
test.beforeEach(async ({ request }) => {
  await request.post(fixture + "/test/reset");
});
async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("landing and shared auth signup are responsive previews with reduced-motion support", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Legal, verified vans for group trips",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get quotes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("coming soon");
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440)
      await page.screenshot({
        path: "test-results/landing-desktop.png",
        fullPage: true,
        animations: "disabled",
      });
    if (width === 375)
      await page.screenshot({
        path: "test-results/landing-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
  }
  await page.getByRole("link", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create your account", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".auth-promo .van-scene-vehicle")).toHaveCSS(
    "animation-name",
    "van-drive-wave",
  );
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("First name").fill("Juan");
  await page.getByRole("button", { name: "Company or org" }).click();
  await expect(
    page.getByRole("button", { name: "Company or org" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/signup-shared-auth.png",
    animations: "disabled",
  });
  await page
    .getByRole("navigation", { name: "Account access" })
    .getByRole("link", { name: "Log in" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.locator(".auth-promo .van-scene-vehicle:visible"),
  ).toHaveCSS("animation-name", "none");
});
test("operator registration, document correction, admin update tracking and vehicle management", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(120000);
  await request.post(fixture + "/test/checklist/seed");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/register/operator");
  await expect(
    page.getByRole("heading", { name: "Register your vans", exact: true }),
  ).toBeVisible();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 375) await page.screenshot({ path: "test-results/operator-registration-mobile.png", fullPage: true, animations: "disabled" });
  }
  await page.getByRole("group", { name: "Popular service areas" }).getByRole("button", { name: "Metro Manila", exact: true }).click();
  await expect(page.getByLabel("Service areas (separate with commas)", { exact: true })).toHaveValue("Metro Manila");
  await page.getByRole("group", { name: "Popular service areas" }).getByRole("button", { name: "Metro Manila", exact: true }).click();
  await expect(page.getByLabel("Service areas (separate with commas)", { exact: true })).toHaveValue("");
  const fields = {
    "Registered business name": "Lakbay Test Travel",
    "Business registration number (optional)": "TEST-CPC-001",
    "Contact person": "Juan Operator",
    "Contact email": "contact@example.test",
    "Mobile number": "+639171234567",
    "Operating base": "Manila",
    "Service areas (separate with commas)": "Manila, Rizal",
    "Account email": "new.operator@example.test",
    Password: password,
    "Confirm password": password,
  };
  for (const [label, value] of Object.entries(fields))
    await page.getByLabel(label, { exact: true }).fill(value);
  for (const code of [
    "ltfrb_franchise",
    "vehicle_or_cr",
    "insurance",
    "driver_license",
    "business_permit",
  ])
    await page
      .locator(`input[name="document:${code}"]`)
      .setInputFiles(pdf(`${code}.pdf`));
  const fleet = page.locator(".operator-registration-vehicle").first();
  for (const [label, value] of Object.entries({
    Make: "Toyota",
    Model: "Hiace",
    "Plate number": "ABC 1234",
    Year: "2024",
    "Registered seats": "15",
    "Operating location": "Manila",
  }))
    await fleet.getByLabel(label, { exact: true }).fill(value);
  await fleet.getByLabel("front photo", { exact: true }).setInputFiles(photo);
  await expect(page.locator(".operator-checklist li").filter({ hasText: "Business details" })).toHaveAttribute("data-complete", "true");
  await expect(page.locator(".operator-checklist li").filter({ hasText: "Documents (5/5)" })).toHaveAttribute("data-complete", "true");
  await expect(page.locator(".operator-checklist li").filter({ hasText: "At least 1 vehicle" })).toHaveAttribute("data-complete", "true");
  await page.getByRole("button", { name: "Add another vehicle" }).click();
  await expect(page.locator(".operator-checklist li").filter({ hasText: "At least 1 vehicle" })).toHaveAttribute("data-complete", "false");
  await page.getByRole("button", { name: "Remove vehicle" }).last().click();
  await expect(page.locator(".operator-checklist li").filter({ hasText: "At least 1 vehicle" })).toHaveAttribute("data-complete", "true");
  await page.locator('input[name="agreement"]').check();
  await page.locator('input[name="declaration"]').check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/operator-registration.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator('input[name="document:insurance"]')
    .setInputFiles({
      name: "invalid.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a PDF"),
    });
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "does not match its format" }),
  ).toBeVisible();
  await page
    .locator('input[name="document:insurance"]')
    .setInputFiles(pdf("insurance.pdf"));
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register\/operator\/success\?application=/);
  const applicationId = new URL(page.url()).searchParams.get("application")!;
  await expect(
    page.getByRole("heading", { name: "Application submitted", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/operator-submitted.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(
    "/auth/callback?code=test-confirmation-code&next=%2Foperator",
  );
  await expect(page).toHaveURL(/\/operator$/);
  await expect(
    page.getByRole("heading", { name: "Application submitted", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".operator-document-status-row")
      .filter({ hasText: "Insurance" }),
  ).toContainText("Pending review");
  await page.screenshot({
    path: "test-results/operator-pending.png",
    fullPage: true,
    animations: "disabled",
  });
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.request.post(fixture + "/test/account/create", {
    data: { email: "admin@example.test", password },
  });
  await login(admin, "admin@example.test");
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.goto(`/admin?status=all&operator=${applicationId}`);
  const insurance = admin
    .locator(".admin-document-row")
    .filter({ hasText: "Insurance (CTPL + passenger)" });
  await insurance
    .getByText("Review Insurance (CTPL + passenger)", { exact: true })
    .click();
  await insurance
    .getByLabel("Review note for Insurance (CTPL + passenger)")
    .fill("Please upload a current insurance certificate.");
  await insurance
    .getByRole("button", { name: "Request replacement", exact: true })
    .click();
  await expect(insurance.locator(".admin-document-status")).toHaveText(
    "Resubmit",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Updates needed on your application" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Edit application", exact: true })
    .click();
  await page
    .getByLabel("Registered business name", { exact: true })
    .fill("Lakbay Updated Travel");
  await page
    .getByLabel("Insurance (CTPL + passenger) (required)", { exact: true })
    .setInputFiles(pdf("updated-insurance.pdf"));
  await page
    .getByRole("button", { name: "Save and resubmit application", exact: true })
    .click();
  await expect(page).toHaveURL(/\/operator$/);
  await expect(
    page.getByRole("heading", { name: "Application submitted", exact: true }),
  ).toBeVisible();
  await admin.reload();
  await expect(
    admin.getByRole("heading", { name: "Lakbay Updated Travel", exact: true }),
  ).toBeVisible();
  await expect(
    admin.locator(".admin-review-panel .admin-operator-update"),
  ).toContainText("Updated by operator");
  await expect(
    admin.locator(".admin-review-panel .admin-operator-update"),
  ).toContainText("Resubmitted");
  for (const label of [
    "LTFRB franchise (CPC)",
    "Vehicle OR/CR",
    "Insurance (CTPL + passenger)",
    "Driver's professional license",
    "DTI/SEC + mayor's permit",
  ]) {
    const row = admin.locator(".admin-document-row").filter({ hasText: label });
    await row.getByText(`Review ${label}`, { exact: true }).click();
    await row
      .getByRole("button", { name: "Approve document", exact: true })
      .click();
    await expect(row.locator(".admin-document-status")).toHaveText("Approved");
  }
  await admin.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(admin.locator(".admin-review-result")).toContainText("Approved");
  await admin
    .getByRole("button", { name: "Approve vehicle", exact: true })
    .click();
  await expect(
    admin.locator(".admin-vehicle-review article").first(),
  ).toContainText("Approved");
  await page.goto("/operator");
  await expect(page).toHaveURL(/\/operator\/requests$/);
  await expect(
    page
      .getByRole("navigation", { name: "Operator portal" })
      .getByRole("link", { name: "Requests", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "No requests yet" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Operator portal" })
    .getByRole("link", { name: "My vans", exact: true })
    .click();
  const first = page.getByRole("row").filter({ hasText: "Toyota Hiace" });
  await expect(first).toContainText("Approved");
  const toggle = first.getByRole("switch");
  await expect(toggle).toBeEnabled();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await page.getByRole("button", { name: "Add vehicle", exact: false }).click();
  const drawer = page.getByRole("dialog", { name: "Add vehicle" });
  for (const [label, value] of Object.entries({
    Make: "Nissan",
    Model: "Urvan",
    "Plate number": "DEF 5678",
    Year: "2023",
    "Registered seats": "15",
    "Operating location": "Manila",
  }))
    await drawer.getByLabel(label, { exact: true }).fill(value);
  await drawer.getByLabel("front photo", { exact: true }).setInputFiles(photo);
  await drawer
    .getByRole("button", { name: "Save vehicle", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  const second = page.getByRole("row").filter({ hasText: "Nissan Urvan" });
  await expect(second).toBeVisible();
  await expect(second.getByRole("switch")).toBeDisabled();
  await page.screenshot({
    path: "test-results/operator-vans-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 375)
      await page.screenshot({
        path: "test-results/operator-vans-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".operator-workspace-content:visible")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page
    .getByRole("button", { name: "Edit Toyota Hiace", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit vehicle" });
  await edit.getByLabel("Model", { exact: true }).fill("Hiace Premium");
  await edit.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(edit).not.toBeVisible();
  const edited = page
    .getByRole("row")
    .filter({ hasText: "Toyota Hiace Premium" });
  await expect(edited).toContainText("Pending review");
  await expect(edited.getByRole("switch")).toBeDisabled();
  await expect(edited.getByRole("switch")).not.toBeChecked();
  await adminContext.close();
});
