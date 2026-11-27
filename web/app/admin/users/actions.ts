"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/operators/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/auth/site-url";
import { readEmail } from "@/lib/auth/forms";
export async function inviteAdministrator(form:FormData) {
 const actor=await getActor();
 if(!actor.user || !actor.ready || !actor.isSuperAdmin) return {message:"Only the super administrator can add admin users."};
 const {email,error}=readEmail(form);
 if(error || email.toLowerCase()==="admin@vanbook.ph") return {message:"Enter a valid email for a new administrator."};
 try {
  const admin=createAdminClient();
  const reserved=await admin.rpc("reserve_admin_invitation",{p_email:email,p_actor:actor.user.id});
  if(reserved.error) return {message:"This address already has an account or invitation. Use a new email address."};
  const invitation=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:new URL("/reset-password",getSiteUrl()).toString()});
  if(invitation.error) {
   await admin.rpc("release_admin_invitation",{p_email:email,p_actor:actor.user.id});
   return {message:"The invitation could not be sent. Try again later."};
  }
  revalidatePath("/admin/users");
  return {success:true,message:"Administrator added. An invitation email lets them verify their address and set a password."};
 } catch {return {message:"Admin invitations are not configured yet. Please contact the super administrator."};}
}
