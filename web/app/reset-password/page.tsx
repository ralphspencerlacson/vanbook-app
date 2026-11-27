import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";
import { createClient } from "@/lib/supabase/server";

async function ResetContent() {
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
    throw new Error("Unable to verify the reset session.");
  if (!user?.email_confirmed_at) return redirect("/forgot-password");
  return <PasswordRecoveryForm mode="update" />;
}
export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Set a new, unique password for your account."
    >
      <Suspense fallback={<p role="status">Checking your reset link…</p>}>
        <ResetContent />
      </Suspense>
    </AuthShell>
  );
}
