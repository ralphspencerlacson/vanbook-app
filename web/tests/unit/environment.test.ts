import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants";
import configureNext from "../../next.config";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { parseSiteUrl } from "@/lib/auth/site-origin";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_fixture-only",
  );
  vi.stubEnv("SITE_URL", "https://vanbook.example");
  vi.stubEnv("VERCEL", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("production deployment settings", () => {
  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SITE_URL",
  ])(
    "rejects missing %s during the build instead of publishing a broken app",
    (name) => {
      vi.stubEnv(name, "");
      expect(() => configureNext(PHASE_PRODUCTION_BUILD)).toThrow(name);
    },
  );

  it("rejects a server secret in the browser key without echoing its value", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_secret_fixture-only",
    );
    let message = "";
    try {
      configureNext(PHASE_PRODUCTION_BUILD);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("publishable key");
    expect(message).not.toContain("sb_secret_fixture-only");
  });

  it.each([
    "http://example.supabase.co",
    "https://example.supabase.co/auth/v1",
    "https://user:password@example.supabase.co",
    "https://example.supabase.co?key=fixture",
  ])("rejects an invalid public project origin", (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    expect(() => getSupabaseConfig()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("requires the real site origin on Vercel, while allowing localhost locally", () => {
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    expect(() => configureNext(PHASE_PRODUCTION_BUILD)).toThrow(
      "deployed HTTPS origin",
    );
    vi.stubEnv("VERCEL", "");
    expect(configureNext(PHASE_PRODUCTION_BUILD).cacheComponents).toBe(true);
  });

  it("accepts configured production settings without requiring the optional admin secret", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(configureNext(PHASE_PRODUCTION_BUILD).cacheComponents).toBe(true);
  });

  it("does not prevent starting local development before environment setup", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(configureNext(PHASE_DEVELOPMENT_SERVER).cacheComponents).toBe(true);
  });

  it("rejects callback paths and malformed site URLs without disclosing the input", () => {
    expect(() => parseSiteUrl("https://vanbook.example/auth/callback")).toThrow(
      "origin",
    );
    expect(() => parseSiteUrl("not-a-url-secret")).toThrow(
      "valid HTTPS origin",
    );
    expect(parseSiteUrl(" https://vanbook.example/ ")).toBe(
      "https://vanbook.example",
    );
  });
});
