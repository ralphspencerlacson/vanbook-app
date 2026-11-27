import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "./env";
import { canEnter, destinationFor, readAccess } from "@/lib/auth/access";
import { safeNext } from "@/lib/auth/forms";

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        // Preserve earlier writes if the SDK calls setAll more than once.
        const previousCookies = response.cookies.getAll();
        const previousHeaders = new Headers(response.headers);
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        for (const header of ["cache-control", "expires", "pragma"]) {
          const value = previousHeaders.get(header);
          if (value) response.headers.set(header, value);
        }
        Object.entries(cacheHeaders).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // Refresh and verify the token before rendering. Pages/actions still verify
  // the current user and role, and private data remains protected by RLS.
  const { data } = await supabase.auth.getClaims();
  function redirectTo(path: string) {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    // Preserve refreshed/cleared session cookies even when changing routes.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
    redirect.headers.set("Pragma", "no-cache");
    redirect.headers.set("Referrer-Policy", "no-referrer");
    return redirect;
  }
  const privateRoute = /^\/(account|operator|admin)(\/|$)/.test(
    request.nextUrl.pathname,
  );
  if (privateRoute && !data?.claims?.sub) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/sign-in";
    destination.search = "";
    destination.searchParams.set(
      "next", request.nextUrl.pathname + request.nextUrl.search,
    );
    destination.searchParams.set("notice", "session-expired");
    return redirectTo(destination.pathname + destination.search);
  }

  const guestRoute = [
    "/sign-in", "/sign-in/password", "/register", "/register/operator",
  ].includes(request.nextUrl.pathname);
  if (request.method === "GET" && guestRoute && data?.claims?.sub) {
    const { data: identity } = await supabase.auth.getUser();
    if (identity.user?.email_confirmed_at) {
      let access;
      try {
        access = await readAccess(supabase);
      } catch {
        // The page's verified account guard displays the recovery error.
      }
      if (access && canEnter(access))
        return redirectTo(destinationFor(
          access, safeNext(request.nextUrl.searchParams.get("next")),
        ));
    }
  }

  if (
    data?.claims?.sub || /^\/(account|auth|register|sign-in|forgot-password|reset-password|operator|admin)(\/|$)/.test(
      request.nextUrl.pathname,
    )
  ) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}
