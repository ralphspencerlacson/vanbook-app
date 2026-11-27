"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/operators/server";
import { readContactProfile, type AccountProfileResult } from "@/lib/auth/account-profile";

export async function loadAccountProfile(): Promise<AccountProfileResult> {
  try {
    const actor = await getActor();
    if (!actor.user || !actor.ready || !actor.access)
      return { message: "Sign in again to view your account details." };
    const user = await actor.supabase.from("users")
      .select("full_name,email,role,email_confirmed_at,created_at")
      .eq("id", actor.user.id).single();
    if (user.error || !user.data) return { message: "Your account details could not be loaded. Please try again." };
    const profile = {
      name: user.data.full_name, email: user.data.email,
      role: actor.access.role, confirmed: !!user.data.email_confirmed_at,
      joinedAt: user.data.created_at,
    };
    if (actor.access.role !== "operator") return { profile };
    const application = await actor.supabase.from("operator_applications")
      .select("contact_name,contact_phone,contact_email,version")
      .eq("owner_id", actor.user.id).single();
    if (application.error || !application.data)
      return { message: "Your operator contact details could not be loaded. Please try again." };
    return { profile: {
      ...profile, name: application.data.contact_name, phone: application.data.contact_phone,
      contactEmail: application.data.contact_email, version: application.data.version,
    } };
  } catch {
    return { message: "We couldn't load your account. Check your connection and try again." };
  }
}

export async function saveOperatorProfile(form: FormData): Promise<AccountProfileResult> {
  const input = readContactProfile(form);
  if (Object.keys(input.errors).length) return { errors: input.errors, message: "Check the highlighted fields." };
  if (!Number.isSafeInteger(input.version) || input.version < 1)
    return { message: "Reload your account details before saving." };
  try {
    const actor = await getActor();
    if (!actor.user || !actor.ready || actor.access?.role !== "operator")
      return { message: "Sign in with your operator account to edit these details." };
    const result = await actor.supabase.rpc("update_operator_contact_profile", {
      p_version: input.version, p_name: input.name,
      p_phone: input.phone, p_contact_email: input.contactEmail,
    });
    if (result.error) return { message: result.error.code === "40001"
      ? "Your account details changed. Close and reopen this window before saving again."
      : "We couldn't save your contact details. Your entries are still here. Please try again." };
    revalidatePath("/operator", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/");
    return {
      success: true, message: "Your contact details have been updated.",
      profile: {
        name: input.name, phone: input.phone, contactEmail: input.contactEmail,
        version: result.data as number, role: "operator", email: actor.user.email ?? "",
        confirmed: true, joinedAt: actor.user.created_at,
      },
    };
  } catch {
    return { message: "We couldn't save your contact details. Your entries are still here. Please try again." };
  }
}
