import { AuthShell } from "@/components/auth-shell";
import { CustomerRegistrationPreview } from "@/components/customer-registration-preview";
export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Your next group journey starts here."
      tab="register"
    >
      <CustomerRegistrationPreview />
    </AuthShell>
  );
}
