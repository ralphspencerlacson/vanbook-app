"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  authErrorMessage,
  readCredentials,
  readEmail,
  safeNext,
  type AuthResult,
} from "@/lib/auth/forms";
import { readAccess, canEnter, destinationFor, pendingMessage } from "@/lib/auth/access";
import { getSiteUrl } from "@/lib/auth/site-url";

export async function requestPasswordReset(
  form: FormData,
): Promise<AuthResult> {
  const { email, error: emailError } = readEmail(form);
  if (emailError)
    return {
      errors: { email: emailError },
      message: "Check your email address.",
    };
  try {
    const supabase = await createClient();
    const callback = new URL("/auth/callback", getSiteUrl());
    callback.searchParams.set("next", "/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callback.toString(),
    });
    if (error) return { message: authErrorMessage(error) };
    return {
      success: true,
      message:
        "If this address has an account, a password reset link is on its way. Check your inbox and spam folder, then open it in this browser.",
    };
  } catch {
    return {
      message:
        "We couldn't request a password reset. Check your connection and try again.",
    };
  }
}

export async function updatePassword(form: FormData): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.email_confirmed_at || !user.email)
      return {
        message:
          "Your reset session is no longer valid. Request a new password reset link.",
      };
    const validation = new FormData();
    validation.set("email", user.email);
    validation.set("password", String(form.get("password") ?? ""));
    validation.set(
      "confirmPassword",
      String(form.get("confirmPassword") ?? ""),
    );
    const { password, errors } = readCredentials(validation, true);
    if (Object.keys(errors).length)
      return { errors, message: "Please check the highlighted fields." };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { message: authErrorMessage(error) };
    revalidatePath("/", "layout");
    return {
      success: true,
      message:
        "Your password has been updated. Use your new password the next time you sign in.",
    };
  } catch {
    return {
      message:
        "We couldn't update your password. Check your connection and try again.",
    };
  }
}

export async function register(form: FormData): Promise<AuthResult> {
  if(String(form.get("email")??"").trim().toLowerCase()==="admin@vanbook.ph") return {message:"Administrator accounts are created by the super administrator."};
  const { email, password, errors } = readCredentials(form, true);
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  try {
    const supabase = await createClient();
    const callback = new URL("/auth/callback", getSiteUrl());
    callback.searchParams.set("next", safeNext(form.get("next")));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callback.toString() },
    });
    // Supabase intentionally obscures whether an account already exists.
    if (error && error.code !== "user_already_exists")
      return { message: authErrorMessage(error) };
    if (data.session) {
      // Also supports projects where confirmation has been disabled. The
      // configured project currently requires confirmation.
      revalidatePath("/", "layout");
      return { success: true, redirectTo: safeNext(form.get("next")) };
    }
    return {
      success: true,
      message:
        "If this address can be registered, a confirmation email is on its way. Check your inbox and spam folder, then open the link in this browser. If you already have an account, sign in instead.",
    };
  } catch {
    return {
      message:
        "We couldn't create your account. Check your connection and try again.",
    };
  }
}

export async function signIn(form: FormData): Promise<AuthResult> {
  const { email, password, errors } = readCredentials(form);
  if (Object.keys(errors).length)
    return { errors, message: "Please check the highlighted fields." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { message: authErrorMessage(error) };
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      return { message: authErrorMessage({ code: "email_not_confirmed" }) };
    }
    let access;
    try { access=await readAccess(supabase); } catch {
      await supabase.auth.signOut({scope:"local"});
      return {message:"Account permissions are not configured yet. Please contact VANBOOK PH support."};
    }
    if(!canEnter(access)) {
      await supabase.auth.signOut({scope:"local"});
      return {message:access.role==="agent" ? "Support accounts are not enabled yet." : access.status === "rejected" ? "Your operator application was not approved. Contact VANBOOK PH support." : pendingMessage};
    }
    revalidatePath("/", "layout");
    return {success:true,redirectTo:destinationFor(access,safeNext(form.get("next")))};
  } catch {
    return {
      message: "We couldn't sign you in. Check your connection and try again.",
    };
  }
}

export async function resendConfirmation(form: FormData): Promise<AuthResult> {
  const email = String(form.get("email") ?? "").trim();
  const validation = new FormData();
  validation.set("email", email);
  validation.set("password", "not-used");
  const { errors } = readCredentials(validation);
  if (errors.email)
    return {
      errors: { email: errors.email },
      message: "Enter your email address first.",
    };
  try {
    const supabase = await createClient();
    const callback = new URL("/auth/callback", getSiteUrl());
    callback.searchParams.set("next", safeNext(form.get("next")));
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callback.toString() },
    });
    if (error) return { message: authErrorMessage(error) };
    return {
      success: true,
      message:
        "If this address needs confirmation, a new email has been requested. Open the latest link in this browser.",
    };
  } catch {
    return {
      message:
        "We couldn't request another email. Check your connection and try again.",
    };
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { message: authErrorMessage(error) };
    revalidatePath("/", "layout");
    return { success: true, redirectTo: "/sign-in?notice=signed-out" };
  } catch {
    return {
      message: "We couldn't sign you out. Check your connection and try again.",
    };
  }
}
