import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseConfig} from "./env";
// Public catalog queries never reuse a visitor's session or a privileged key.
export function createPublicClient(){const {url,publishableKey}=getSupabaseConfig();return createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
