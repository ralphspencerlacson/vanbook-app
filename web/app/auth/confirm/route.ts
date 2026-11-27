import {NextResponse,type NextRequest} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {readAccess,isAdminRole} from "@/lib/auth/access";
import {getSiteUrl} from "@/lib/auth/site-url";
// Invitation links cross browsers, so they use a hashed one-time token instead of PKCE.
export async function GET(request:NextRequest) {
 let destination="/sign-in?notice=confirmation-failed";
 const token=request.nextUrl.searchParams.get("token_hash");
 if(token && token.length<=4096 && request.nextUrl.searchParams.get("type")==="invite") {
  try {const client=await createClient();const {error}=await client.auth.verifyOtp({token_hash:token,type:"invite"});
   if(!error) {const access=await readAccess(client);if(isAdminRole(access)) destination="/reset-password";else await client.auth.signOut({scope:"local"});}
  } catch {/* No token or provider error is included in redirects. */}
 }
 const response=NextResponse.redirect(new URL(destination,getSiteUrl()),303);
 response.headers.set("Cache-Control","private, no-store, max-age=0");response.headers.set("Referrer-Policy","no-referrer");return response;
}
