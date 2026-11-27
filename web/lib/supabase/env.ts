export function getSupabaseConfig() {
  // Read only on the server or during build validation. Nothing is inlined into
  // browser bundles; sign-in and document uploads run through server actions.
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the deployment environment (or web/.env.local for local development), then redeploy.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL must be a valid project URL.");
  }

  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsedUrl.hostname,
  );
  if (
    parsedUrl.protocol !== "https:" &&
    !(parsedUrl.protocol === "http:" && isLocal)
  ) {
    throw new Error(
      "SUPABASE_URL must use HTTPS (HTTP is allowed for local Supabase).",
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "SUPABASE_URL must be the project origin without credentials, a path, query, or fragment.",
    );
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key. Do not use a secret or service-role key.",
    );
  }

  return { url, publishableKey };
}
