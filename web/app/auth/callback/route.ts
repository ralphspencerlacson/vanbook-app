import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readAccess, canEnter, destinationFor } from "@/lib/auth/access";
import { safeNext } from "@/lib/auth/forms";
import { getSiteUrl } from "@/lib/auth/site-url";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/sign-in?notice=confirmation-failed";
  if (code && code.length <= 4096) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user?.email_confirmed_at) {
        try {
          const access=await readAccess(supabase);
          if(!canEnter(access)) { await supabase.auth.signOut({scope:"local"}); destination="/sign-in?notice=operator-pending"; }
          else destination=destinationFor(access,safeNext(request.nextUrl.searchParams.get("next")));
        } catch { await supabase.auth.signOut({scope:"local"}); destination="/sign-in?notice=permissions-unavailable"; }
      }
    } catch {
      // Never echo provider errors or the one-time code into a redirect.
    }
  }
  const response = NextResponse.redirect(
    new URL(destination, getSiteUrl()),
    303,
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
