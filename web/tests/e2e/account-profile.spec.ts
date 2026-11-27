import { expect, test, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:3242";
const password = "strong test password";
async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test.beforeEach(async ({ request }) => { await request.post(`${fixture}/test/reset`); });

test("admin account control opens read-only details without navigating", async ({ page, request }) => {
  await request.post(`${fixture}/test/account/create`, { data: { email: "admin@example.test", password } });
  await login(page, "admin@example.test");
  await expect(page).toHaveURL(/\/admin$/);
  const trigger = page.getByRole("button", { name: "Manage your account", exact: true });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "My account", exact: true });
  await expect(modal.getByText("admin@example.test", { exact: true })).toBeVisible();
  await expect(modal.getByText("Super administrator", { exact: true })).toBeVisible();
  await expect(modal.getByRole("textbox")).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin$/);
  await page.screenshot({ path: "test-results/admin-account-modal.png", animations: "disabled" });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(modal).toBeVisible();
  expect((await modal.boundingBox())!.width).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("approved operators edit contacts in a responsive modal while keeping approval and sign-in email", async ({ page, request }) => {
  test.setTimeout(60000);
  const email = "traveller@example.test";
  await request.post(`${fixture}/test/account/create`, { data: { email, password } });
  await request.post(`${fixture}/test/operator/approve`);
  await login(page, email);
  await expect(page).toHaveURL(/\/operator\/requests$/);
  await page.getByRole("button", { name: "Manage your account", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "My account", exact: true });
  await expect(modal.getByLabel("Full name", { exact: true })).toHaveValue("Test Operator");
  await modal.getByLabel("Full name", { exact: true }).fill("Updated Operator Name");
  await modal.getByLabel("Mobile number", { exact: true }).fill("+639181234567");
  await modal.getByLabel("Contact email", { exact: true }).fill("new.contact@example.test");
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    expect((await modal.boundingBox())!.width).toBeLessThanOrEqual(width);
    expect(await modal.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await modal.getByRole("button", { name: "Save changes", exact: true }).scrollIntoViewIfNeeded();
    await expect(modal.getByRole("button", { name: "Save changes", exact: true })).toBeInViewport();
    if (width === 375) await page.screenshot({ path: "test-results/operator-account-modal-mobile.png", animations: "disabled" });
  }
  await modal.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(modal.getByRole("status")).toContainText("updated");
  await expect(modal.getByText(email, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/operator\/requests$/);
  await modal.getByRole("button", { name: "Close account details", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Manage your account", exact: true }).click();
  await expect(modal.getByLabel("Full name", { exact: true })).toHaveValue("Updated Operator Name");
  await expect(modal.getByLabel("Mobile number", { exact: true })).toHaveValue("+639181234567");
  await expect(modal.getByLabel("Contact email", { exact: true })).toHaveValue("new.contact@example.test");
  await modal.getByRole("button", { name: "Close account details", exact: true }).click();
  await page.getByRole("link", { name: "Business profile", exact: true }).click();
  await expect(page.getByText("new.contact@example.test", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business profile", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/notice=signed-out/);
  await request.post(`${fixture}/test/account/create`, { data: { email: "admin@example.test", password } });
  await login(page, "admin@example.test");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin?status=all");
  await page.getByRole("link", { name: "Test Operator Business", exact: true }).click();
  await expect(page.locator(".admin-review-panel")).toContainText("Updated Operator Name");
  await expect(page.locator(".admin-review-panel .admin-operator-update")).toContainText("Updated by operator");
});
