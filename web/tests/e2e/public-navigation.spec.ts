import { test, expect } from "@playwright/test";

test("mobile navigation supports links, account access, keyboard dismissal and resizing", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const header = page.locator(".site-header");
  const toggle = header.getByRole("button", { name: /navigation menu/ });
  const nav = header.getByRole("navigation", { name: "Main navigation" });
  await expect(toggle).toBeVisible();
  await expect(nav).not.toBeVisible();
  await expect(header.getByRole("link", { name: "Get quotes", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-navigation-closed.png", animations: "disabled" });

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(header.getByRole("link", { name: "Sign up", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-navigation-open.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(nav).not.toBeVisible();
  await expect(toggle).toBeFocused();

  await toggle.click();
  await page.locator(".landing-hero-art").click();
  await expect(nav).not.toBeVisible();
  await toggle.click();
  await nav.getByRole("link", { name: "Popular routes", exact: true }).click();
  await expect(page).toHaveURL(/\/#popular-routes$/);
  await expect(nav).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Popular routes", exact: true })).toBeInViewport();
  expect((await header.boundingBox())!.y).toBeCloseTo(0, 0);

  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 812 });
    await toggle.click();
    await expect(nav).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
  }
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).not.toBeVisible();
  await expect(nav).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(nav).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await toggle.click();
  await expect(page.locator(".site-navigation-panel")).toHaveCSS("animation-name", "none");
  await header.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
});
