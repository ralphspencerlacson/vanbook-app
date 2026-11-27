import type { SupabaseClient } from "@supabase/supabase-js";
export type AccountAccess = {
  role: "customer" | "operator" | "admin" | "super_admin" | "agent";
  approved: boolean;
  status: string | null;
};
export async function readAccess(
  client: SupabaseClient,
): Promise<AccountAccess> {
  const { data, error } = await client.rpc("account_access");
  if (
    error ||
    !data ||
    !["customer", "operator", "admin", "super_admin", "agent"].includes(
      data.role,
    )
  )
    throw new Error("Account permissions are unavailable.");
  return data as AccountAccess;
}
export function isAdminRole(access: AccountAccess) {
  return ["admin", "super_admin"].includes(access.role);
}
export function homeFor(access: AccountAccess) {
  return access.role === "customer"
    ? "/account"
    : access.role === "operator"
      ? access.approved ? "/operator/requests" : "/operator"
      : "/admin";
}
export function canEnter(access: AccountAccess) {
  return access.role !== "agent";
}
export function destinationFor(access: AccountAccess, next: string) {
  if (next === "/reset-password") return next;
  if (next === "/") return next;
  if (
    access.role === "operator" &&
    (next === "/operator" || next.startsWith("/operator/"))
  )
    return next;
  return isAdminRole(access) &&
    (next === "/admin" || next.startsWith("/admin/"))
    ? next
    : homeFor(access);
}
export const pendingMessage =
  "Your operator application is awaiting review. Confirm your email and sign in to track its status.";
