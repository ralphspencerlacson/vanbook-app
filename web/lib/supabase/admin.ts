import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";
export function hasAdminKey() { return !!process.env.SUPABASE_SECRET_KEY?.trim(); }
export function createAdminClient() {
 const key=process.env.SUPABASE_SECRET_KEY?.trim();
 if(!key) throw new Error("Server account provisioning is not configured.");
 return createClient(getSupabaseConfig().url,key,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}
