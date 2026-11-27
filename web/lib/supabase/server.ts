import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabaseConfig } from "./env";

export async function createClient() {
  // Auth SDK initialization reads the current time. Keep it entirely at
  // request time when Cache Components attempts to prerender this subtree.
  await connection();
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them
          // before rendering; Server Actions and Route Handlers can write here.
        }
      },
    },
  });
}
