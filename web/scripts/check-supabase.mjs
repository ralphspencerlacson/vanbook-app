import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in web/.env.local.",
  );
  process.exitCode = 1;
} else {
  try {
    // Read-only: no users, business records, or database changes.
    const response = await fetch(new URL("/auth/v1/settings", url), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Supabase Auth returned HTTP ${response.status}.`);
    }
    console.log("Supabase Auth connection and publishable key verified (HTTP 200).");
    console.log(
      "This check does not inspect database tables, RLS policies, or storage buckets.",
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Supabase connection failed.",
    );
    process.exitCode = 1;
  }
}
