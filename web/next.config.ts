import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VANBOOK_E2E === "1" ? ".next-e2e" : ".next",
  typescript: {
    tsconfigPath:
      process.env.VANBOOK_E2E === "1" ? "tsconfig.e2e.json" : "tsconfig.json",
  },
  /* config options here */
  experimental: {
    serverActions: {bodySizeLimit:"3.5mb"},
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

export default nextConfig;
