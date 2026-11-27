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
    // Validate the server environment before its request proxy handles traffic.
    getSupabaseConfig();
    parseSiteUrl(process.env.SITE_URL, {
      allowLocal: process.env.VERCEL !== "1",
    });
  }
  return nextConfig;
}
