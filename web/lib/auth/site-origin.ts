// Shared by server-side callbacks and Next's build configuration. Keep this
// parser free of server-only imports so deployment settings can be checked early.
export function parseSiteUrl(
  configured: string | undefined,
  { allowLocal = true }: { allowLocal?: boolean } = {},
) {
  if (!configured?.trim()) {
    throw new Error(
      "Set SITE_URL to the application's public HTTPS origin before building or deploying.",
    );
  }

  let url: URL;
  try {
    url = new URL(configured.trim());
  } catch {
    throw new Error("SITE_URL must be a valid HTTPS origin.");
  }

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" &&
      !(allowLocal && local && url.protocol === "http:")) ||
    (!allowLocal && local) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      allowLocal
        ? "SITE_URL must be an HTTPS origin (local HTTP is allowed)."
        : "SITE_URL must be the deployed HTTPS origin when running on Vercel.",
    );
  }
  return url.origin;
}
