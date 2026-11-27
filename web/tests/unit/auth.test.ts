import { beforeEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage, readCredentials, safeNext } from "@/lib/auth/forms";

const { auth, rpc, revalidatePath } = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resend: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
  },
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth, rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/site-url", () => ({
  getSiteUrl: () => "http://localhost:3000",
}));
import {
  register,
  signIn,
  signOut,
  resendConfirmation,
  requestPasswordReset,
  updatePassword,
} from "@/app/auth/actions";
import { GET } from "@/app/auth/callback/route";
import { NextRequest } from "next/server";

function credentials(extra: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    email: "  traveller@example.test  ",
    password: "strong test password",
    confirmPassword: "strong test password",
    ...extra,
  }))
    form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({
    data: { role: "customer", approved: false, status: null },
    error: null,
  });
  auth.signOut.mockResolvedValue({ error: null });
});

describe("password recovery", () => {
  it("requests a reset link without disclosing account existence", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await requestPasswordReset(credentials());
    expect(result.success).toBe(true);
    expect(result.message).toContain("If this address has an account");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "traveller@example.test",
      {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Freset-password",
      },
    );
  });
  it("does not send email for invalid input", async () => {
    expect(
      (await requestPasswordReset(credentials({ email: "invalid" }))).errors
        ?.email,
    ).toBeTruthy();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("requires server-verified identity before changing a password", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await updatePassword(credentials())).success).toBeUndefined();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("validates matching passwords and never returns them", async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          email: "traveller@example.test",
          email_confirmed_at: "2026-11-27",
        },
      },
      error: null,
    });
    const result = await updatePassword(
      credentials({ confirmPassword: "different" }),
    );
    expect(result.errors?.confirmPassword).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("strong test password");
  });
  it("updates the current account instead of trusting a submitted email", async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          email: "traveller@example.test",
          email_confirmed_at: "2026-11-27",
        },
      },
      error: null,
    });
    auth.updateUser.mockResolvedValue({ error: null });
    expect(
      (
        await updatePassword(
          credentials({ email: "somebody-else@example.test" }),
        )
      ).success,
    ).toBe(true);
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "strong test password",
    });
  });
});

describe("redirects and credentials", () => {
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/x/..//evil.test",
    "/%5cevil.test",
    "/%0aevil.test",
    "/auth/callback",
    "/x/../auth/callback",
    "/sign-in",
    "/%zz",
  ])("rejects unsafe return path %s", (value) => {
    expect(safeNext(value)).toBe("/account");
  });
  it("preserves a local path and query", () =>
    expect(safeNext("/account?tab=details")).toBe("/account?tab=details"));
  it("trims emails but preserves password whitespace", () => {
    const result = readCredentials(
      credentials({
        password: "  eight chars  ",
        confirmPassword: "  eight chars  ",
      }),
      true,
    );
    expect(result.email).toBe("traveller@example.test");
    expect(result.password).toBe("  eight chars  ");
    expect(result.errors).toEqual({});
  });
  it("validates signup fields independently", () => {
    expect(
      readCredentials(
        credentials({
          email: "bad",
          password: "short",
          confirmPassword: "different",
        }),
        true,
      ).errors,
    ).toEqual({
      email: expect.any(String),
      password: expect.any(String),
      confirmPassword: expect.any(String),
    });
  });
  it("does not disclose raw provider errors", () => {
    expect(authErrorMessage({ code: "internal_db_secret" })).not.toContain(
      "internal_db_secret",
    );
    expect(authErrorMessage({ status: 429 })).toContain("wait");
  });
});

describe("authentication actions", () => {
  it("does not call Supabase for invalid input or return passwords", async () => {
    const result = await register(
      credentials({ confirmPassword: "different" }),
    );
    expect(result.errors?.confirmPassword).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("strong test password");
  });
  it("requests email confirmation with an origin-controlled callback", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await register(credentials({ next: "https://evil.test" }));
    expect(result.success).toBe(true);
    expect(result.redirectTo).toBeUndefined();
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo:
            "http://localhost:3000/auth/callback?next=%2Faccount",
        },
      }),
    );
  });
  it("uses the same response for duplicate registration", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const first = await register(credentials());
    auth.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { code: "user_already_exists" },
    });
    expect(await register(credentials())).toEqual(first);
  });
  it("keeps unconfirmed users out", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { email_confirmed_at: null } },
      error: null,
    });
    auth.signOut.mockResolvedValue({ error: null });
    expect((await signIn(credentials())).redirectTo).toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("invalidates router state after confirmed sign-in", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { email_confirmed_at: "2026-11-27" } },
      error: null,
    });
    expect((await signIn(credentials())).redirectTo).toBe("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("shows invalid credentials and provider rate limits", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: "invalid_credentials" },
    });
    expect((await signIn(credentials())).message).toContain("incorrect");
    auth.resend.mockResolvedValue({ error: { status: 429 } });
    expect((await resendConfirmation(credentials())).message).toContain("wait");
  });
  it("does not claim logout succeeded when the provider fails", async () => {
    auth.signOut.mockResolvedValue({ error: { status: 503 } });
    expect((await signOut()).redirectTo).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("signs out the current browser", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    expect((await signOut()).redirectTo).toBe("/sign-in?notice=signed-out");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("handles transport errors without exposing credentials", async () => {
    auth.signInWithPassword.mockRejectedValue(
      new Error("private provider detail"),
    );
    const result = await signIn(credentials());
    expect(result.message).toContain("connection");
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });
});

describe("confirmation callback", () => {
  it("redirects successful confirmation locally and prevents caching", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { email_confirmed_at: "2026-11-27" } },
      error: null,
    });
    const response = await GET(
      new NextRequest(
        "http://untrusted.test/auth/callback?code=test-code&next=//evil.test",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/account",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it.each(["", "?error=access_denied", "?code=expired-code"])(
    "recovers from missing or invalid confirmation %s",
    async (query) => {
      auth.exchangeCodeForSession.mockResolvedValue({
        data: { user: null },
        error: { code: "otp_expired" },
      });
      const response = await GET(
        new NextRequest("http://localhost:3000/auth/callback" + query),
      );
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/sign-in?notice=confirmation-failed",
      );
      expect(response.headers.get("location")).not.toContain("expired-code");
    },
  );
});
