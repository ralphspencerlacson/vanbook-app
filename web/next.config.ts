import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { getSupabaseConfig } from "./lib/supabase/env";
import { parseSiteUrl } from "./lib/auth/site-origin";

const nextConfig: NextConfig = {
  distDir: process.env.VANBOOK_E2E === "1" ? ".next-e2e" : ".next",
  typescript: {
    tsconfigPath:
      process.env.VANBOOK_E2E === "1" ? "tsconfig.e2e.json" : "tsconfig.json",
  },
  /* config options here */
  experimental: {
    serverActions: { bodySizeLimit: "3.5mb" },
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function configureNext(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    // NEXT_PUBLIC_ values are embedded at build time. Reject a deployment with
    // missing settings before its request proxy can fail on every page.
    getSupabaseConfig();
    parseSiteUrl(process.env.SITE_URL, {
      allowLocal: process.env.VERCEL !== "1",
    });
  }
  return nextConfig;
}
