export function getSupabaseConfig() {
  // Keep direct process.env references so Next.js can inline browser values.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the deployment environment (or web/.env.local for local development), then rebuild. NEXT_PUBLIC_ variables use visibility: config in Vercel.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid project URL.");
  }

  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsedUrl.hostname,
  );
  if (
    parsedUrl.protocol !== "https:" &&
    !(parsedUrl.protocol === "http:" && isLocal)
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must use HTTPS (HTTP is allowed for local Supabase).",
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
      "NEXT_PUBLIC_SUPABASE_URL must be the project origin without credentials, a path, query, or fragment.",
    );
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key. Do not use a secret or service-role key.",
    );
  }

  return { url, publishableKey };
}
