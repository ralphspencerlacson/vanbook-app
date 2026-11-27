import { AuthShell } from "@/components/auth-shell";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your email and we'll send a password reset link."
    >
      <PasswordRecoveryForm mode="request" />
    </AuthShell>
  );
}
