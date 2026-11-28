import { test, expect, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3242";
test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/test/reset`);
  await request.post(`${fixture}/test/account/create`, {
    data: { email: "admin@example.test", password: "strong test password" },
  });
  await page.goto("/sign-in");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("admin@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("strong test password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /^Filters/ });
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
}

test("user columns sort the full filtered dataset and reset pagination while keeping filters", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/test/users/seed`);
  await page.goto("/admin/users");
  await expect(page.getByRole("button", { name: /^Filters/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await openFilters(page);
  await page
    .getByRole("searchbox", { name: "Search users" })
    .fill("Directory Person");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  const user = page.getByRole("columnheader", { name: "User", exact: true });
  await user.getByRole("link").click();
  await expect(user).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator(".users-table tbody tr").first()).toContainText(
    "Directory Person 01",
  );
  await page.getByRole("link", { name: "Next →", exact: true }).click();
  await expect(page.locator(".users-table tbody tr")).toHaveCount(5);
  await user.getByRole("link").click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page).toHaveURL(/search=Directory\+Person/);
  await expect(page.locator(".users-table tbody tr").first()).toContainText(
    "Directory Person 30",
  );
  const role = page.getByRole("columnheader", { name: "Role", exact: true });
  await role.getByRole("link").click();
  await expect(
    page.locator(".users-table .user-role-badge").first(),
  ).toHaveText("Admin");
  await role.getByRole("link").click();
  await expect(
    page.locator(".users-table .user-role-badge").first(),
  ).toHaveText("Operator");
  const email = page.getByRole("columnheader", {
    name: "Email status",
    exact: true,
  });
  await email.getByRole("link").click();
  await expect(
    page.locator(".users-table .user-verification").first(),
  ).toContainText("Email verified");
  await email.getByRole("link").click();
  await expect(
    page.locator(".users-table .user-verification").first(),
  ).toContainText("Email not verified");
  await page
    .getByRole("columnheader", { name: "Joined", exact: true })
    .getByRole("link")
    .click();
  await expect(page.locator(".users-table tbody tr").first()).toContainText(
    "Directory Person 01",
  );
  await openFilters(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search users" }),
  ).not.toBeVisible();
  await expect(page.locator(".users-table tbody tr")).toHaveCount(25);
  await openFilters(page);
  await expect(
    page.getByRole("searchbox", { name: "Search users" }),
  ).toHaveValue("Directory Person");
});

test("verification sorts every column including exact van counts without dropping its status filter", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/test/verification/seed`);
  await page.goto("/admin?status=all");
  const first = page.locator(".operator-queue-table tbody tr").first();
  for (const [column, expected] of [
    ["Operator", "Bayanihan Transport"],
    ["Area", "Northstar Travel Co."],
    ["Vans", "Southbound Tours"],
    ["Submitted", "Northstar Travel Co."],
    ["Status", "Northstar Travel Co."],
  ]) {
    const header = page.getByRole("columnheader", {
      name: column,
      exact: true,
    });
    await header.getByRole("link").click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(first).toContainText(expected);
    await expect(page).toHaveURL(/status=all/);
  }
  const vans = page.getByRole("columnheader", { name: "Vans", exact: true });
  await vans.getByRole("link").click();
  await expect(vans).toHaveAttribute("aria-sort", "ascending");
  await vans.getByRole("link").click();
  await expect(vans).toHaveAttribute("aria-sort", "descending");
  await expect(first).toContainText("Island Road Van Rental");
  await openFilters(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Application status")).not.toBeVisible();
  await openFilters(page);
  await expect(page.getByLabel("Application status")).toHaveValue("all");
  await page.screenshot({
    path: "test-results/verification-listing-controls.png",
    fullPage: true,
  });
});

test("all empty admin listings expose sortable columns and collapsible date controls", async ({
  page,
}) => {
  for (const section of ["bookings", "fees", "complaints", "reports"]) {
    await page.goto(`/admin/${section}`);
    await expect(
      page.getByRole("button", { name: /^Filters/ }),
    ).toHaveAttribute("aria-expanded", "false");
    const headers = page.getByRole("columnheader");
    for (const header of await headers.all())
      await expect(header.getByRole("link")).toBeVisible();
    await openFilters(page);
    await page.getByRole("link", { name: "This month", exact: true }).click();
    await expect(page.getByRole("link", { name: "This month", exact: true })).toHaveAttribute("aria-current", "page");
    const header = headers.first();
    await header.getByRole("link").click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await header.getByRole("link").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(page).toHaveURL(/period=month/);
    await expect(page.locator(".admin-empty-state")).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});
