import { test, expect } from "@playwright/test";

const fixture = "http://127.0.0.1:3242";
const email = "traveller@example.test";
const password = "strong test password";

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/test/reset`);
});

test("account tabs preserve the van and smoothly resize the shared card", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
  const van = await page.locator(".auth-promo .van-scene-vehicle").elementHandle();
  const drive = await van!.evaluateHandle((node) => node.getAnimations()[0]);
  const viewport = page.locator(".auth-card-viewport");
  const initialHeight = (await viewport.boundingBox())!.height;

  // Sample actual layout through the navigation, including intermediate heights.
  await viewport.evaluate((node) => {
    const samples: number[] = [];
    (node as HTMLElement & { heightSamples: number[] }).heightSamples = samples;
    const until = performance.now() + 2500;
    const sample = () => {
      samples.push(node.getBoundingClientRect().height);
      if (performance.now() < until) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByRole("navigation", { name: "Account access" }).getByRole("link", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect.poll(() => viewport.evaluate((node) => node.getAnimations().length)).toBe(0);
  const finalHeight = (await viewport.boundingBox())!.height;
  expect(finalHeight).toBeGreaterThan(initialHeight + 20);
  const samples = await viewport.evaluate((node) => (node as HTMLElement & { heightSamples: number[] }).heightSamples);
  expect(samples.some((height) => height > initialHeight + 3 && height < finalHeight - 3)).toBe(true);
  expect(await van!.evaluate((node) => node.isConnected)).toBe(true);
  expect(await van!.evaluate((node, animation) => node.getAnimations()[0] === animation, drive)).toBe(true);
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeDisabled();

  await page.getByRole("navigation", { name: "Account access" }).getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true }).filter({ visible: true })).toBeEnabled();
  await expect.poll(() => viewport.evaluate((node) => node.getAnimations().length)).toBe(0);
  expect((await viewport.boundingBox())!.height).toBeCloseTo(initialHeight, 0);
  expect(await van!.evaluate((node) => node.isConnected)).toBe(true);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  expect(await van!.evaluate((node) => node.isConnected)).toBe(true);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("navigation", { name: "Account access" }).getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(await viewport.evaluate((node) => node.getAnimations().length)).toBe(0);
  expect(await page.locator(".auth-form-panel").evaluate((node) => node.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("navigation", { name: "Account access" }).getByRole("link", { name: "Sign up", exact: true }).click();
  await page.getByRole("button", { name: "Create account", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("email confirmation, session restoration, token refresh and sign-out", async ({
  page,
  context,
  request,
  browser,
}) => {
  await request.post(fixture + "/test/account/create", {
    data: { email, password, confirmed: false },
  });
  await page.goto("/account");
  await expect(page).toHaveURL(/sign-in/);
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Confirm your email" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resend confirmation email" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "new email" }),
  ).toBeVisible();
  await page.goto("/auth/callback?code=test-confirmation-code&next=%2Faccount");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  const restored = await browser.newContext({
    storageState: await context.storageState(),
  });
  const restoredPage = await restored.newPage();
  await restoredPage.goto("http://127.0.0.1:3241/account");
  await expect(restoredPage.getByText(email, { exact: true })).toBeVisible();
  await restored.close();

  const expired = await (
    await request.get(`${fixture}/test/expired-session`)
  ).json();
  const cookies = await context.cookies();
  const authCookies = cookies.filter((cookie) =>
    /auth-token(?:\.\d+)?$/.test(cookie.name),
  );
  expect(authCookies.length).toBeGreaterThan(0);
  const baseName = authCookies[0].name.replace(/\.\d+$/, "");
  await context.clearCookies({
    name: new RegExp(
      `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.\\d+)?$`,
    ),
  });
  await context.addCookies([
    {
      name: baseName,
      value:
        "base64-" + Buffer.from(JSON.stringify(expired)).toString("base64url"),
      url: "http://127.0.0.1:3241",
      sameSite: "Lax",
    },
  ]);
  const response = await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  expect(
    (await (await request.get(`${fixture}/test/stats`)).json()).refreshes,
  ).toBeGreaterThan(0);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/notice=signed-out/);
  await page.goto("/account");
  await expect(page).toHaveURL(/sign-in/);
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("responsive layout fills the viewport, keeps columns close, and supports text scaling", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("textbox", { name: "Email address", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Verification code")).not.toBeVisible();
  await expect(page.getByText("Continue with Google")).not.toBeVisible();
  for (const [width, height] of [
    [320, 568],
    [320, 844],
    [375, 667],
    [375, 812],
    [768, 1024],
    [783, 909],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const layout = await page.locator(".auth-layout").boundingBox();
    const promo = await page.locator(".auth-promo").boundingBox();
    const form = await page.locator(".auth-form-area").boundingBox();
    expect(layout!.width).toBeGreaterThanOrEqual(width - 2);
    expect(layout!.x).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight + 1,
      ),
    ).toBe(true);
    if (width >= 1024) {
      expect(form!.x).toBeGreaterThanOrEqual(promo!.x + promo!.width);
      expect(form!.x - (promo!.x + promo!.width)).toBeLessThanOrEqual(49);
    } else {
      expect(form!.y).toBeGreaterThanOrEqual(promo!.y + promo!.height - 1);
    }
    if (width === 375 || width === 1440)
      await page.screenshot({
        path: `test-results/auth-${width}.png`,
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("link", { name: "Create an account", exact: true }),
  ).toBeInViewport();
});

test("confirmation resend and expired-link recovery", async ({ page }) => {
  await page.goto("/sign-in");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page.getByRole("button", { name: "Resend confirmation email" }).click();
  await expect(page.getByRole("status")).toContainText("new email");
  await page.goto("/auth/callback?code=expired-code&next=https://evil.test");
  await expect(page).toHaveURL(/notice=confirmation-failed/);
  await expect(page.getByRole("status")).toContainText("expired");
});

test("offline and invalid-password failures preserve inputs", async ({
  page,
  context,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect password");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "connection" }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "incorrect password",
  );
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "incorrect" }),
  ).toBeVisible();
});
