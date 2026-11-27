import type { SupabaseClient } from "@supabase/supabase-js";
export type AccountAccess = { role: "customer" | "operator" | "admin" | "super_admin" | "agent"; approved: boolean; status: string | null };
export async function readAccess(client: SupabaseClient): Promise<AccountAccess> {
 const {data,error}=await client.rpc("account_access");
 if(error || !data || !["customer","operator","admin","super_admin","agent"].includes(data.role)) throw new Error("Account permissions are unavailable.");
 return data as AccountAccess;
}
export function isAdminRole(access: AccountAccess) { return ["admin","super_admin"].includes(access.role); }
export function homeFor(access: AccountAccess) { return access.role === "customer" ? "/account" : "/admin"; }
export function canEnter(access: AccountAccess) { return access.role !== "agent" && (access.role !== "operator" || access.approved); }
export function destinationFor(access: AccountAccess, next: string) {
 if(next==="/reset-password") return next;
 if(next==="/") return next;
 return isAdminRole(access) && (next==="/admin" || next.startsWith("/admin/")) ? next : homeFor(access);
}
export const pendingMessage="Your operator account is awaiting approval. You can sign in after your email is verified and an administrator approves your application.";
