import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/forms";

export const getActor = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (
    error &&
    error.name !== "AuthSessionMissingError" &&
    error.status !== 401 &&
    error.status !== 403
  )
    throw new Error("Unable to verify the current account.");
  if (!user?.email_confirmed_at)
    return { supabase, user: null, isAdmin: false, isSuperAdmin:false, access:null, ready: true };
  const { readAccess, canEnter, isAdminRole } = await import("@/lib/auth/access");
  let access;
  try { access = await readAccess(supabase); }
  catch { return { supabase, user, isAdmin:false, isSuperAdmin:false, access:null, ready:false }; }
  if(!canEnter(access)) return {supabase,user:null,isAdmin:false,isSuperAdmin:false,access,ready:true};
  return { supabase, user, isAdmin:isAdminRole(access), isSuperAdmin:access.role==="super_admin", access, ready:true };
});

export async function requireWorkspace(path: string) {
  const actor = await getActor();
  if (!actor.user)
    return redirect(
      `/sign-in?next=${encodeURIComponent(safeNext(path))}&notice=${actor.access?.role === "operator" ? "operator-pending" : "session-expired"}`,
    );
  return { ...actor, user: actor.user };
}
